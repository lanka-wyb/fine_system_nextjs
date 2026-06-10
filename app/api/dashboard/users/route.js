import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// Helper to fetch the full updated users list (same as returned in dashboard/data)
async function getUpdatedUsers() {
  const allUsersRaw = await db.query(
    `SELECT u.id, u.name, u.email, u.role, u.status,
            sp.student_id, sp.gpa, sp.attendance, sp.semester, sp.schedule, sp.grades, f_stu.name as studentMajor,
            tp.teacher_id, tp.office, tp.courses_taught, f_teach.name as teacherFaculty,
            ap.admin_id, ap.clearance_level
     FROM users u
     LEFT JOIN student_profiles sp ON u.id = sp.user_id
     LEFT JOIN faculties f_stu ON sp.faculty_id = f_stu.id
     LEFT JOIN teacher_profiles tp ON u.id = tp.user_id
     LEFT JOIN faculties f_teach ON tp.faculty_id = f_teach.id
     LEFT JOIN admin_profiles ap ON u.id = ap.user_id
     ORDER BY u.id ASC`
  );

  return allUsersRaw.map(u => {
    let profile = {};
    if (u.role === 'Student') {
      profile = {
        studentId: u.student_id,
        major: u.studentMajor || 'Science',
        gpa: String(u.gpa),
        attendance: u.attendance,
        semester: u.semester,
        schedule: db.safeJsonParse(u.schedule),
        grades: db.safeJsonParse(u.grades)
      };
    } else if (u.role === 'Faculty') {
      profile = {
        facultyId: u.teacher_id,
        facultyName: u.teacherFaculty || 'Science',
        office: u.office,
        coursesTaught: db.safeJsonParse(u.courses_taught)
      };
    } else if (u.role === 'Admin') {
      profile = {
        adminId: u.admin_id,
        clearanceLevel: u.clearance_level
      };
    }
    return {
      id: String(u.id),
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      profile
    };
  });
}

export async function POST(request) {
  try {
    const admin = await getUserFromRequest();
    
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Access denied. Only Admin can create users.' }, { status: 403 });
    }

    const { name, email, password, role, facultyName } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already exists.' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    const userResult = await db.query(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, "active")',
      [name.trim(), email.trim(), hashedPassword, role, 'active']
    );
    const userId = Number(userResult.insertId);

    // Get Faculty ID
    let facultyId = null;
    if (facultyName) {
      const facDb = await db.query('SELECT id FROM faculties WHERE name = ?', [facultyName]);
      if (facDb.length > 0) {
        facultyId = facDb[0].id;
      }
    }
    
    // If no faculty specified, default to Science
    if (!facultyId && (role === 'Student' || role === 'Faculty')) {
      const sciDb = await db.query('SELECT id FROM faculties WHERE name = "Science"');
      facultyId = sciDb.length > 0 ? sciDb[0].id : null;
    }

    // Insert Profile based on Role
    if (role === 'Student') {
      const studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const schedule = [
        { code: 'CS 101', name: 'Intro to Computer Science', time: 'Mon/Wed 10:00 AM', room: 'Hall A' }
      ];
      const grades = [
        { course: 'CS 101', code: 'CS 101', grade: 'B', score: 85 }
      ];

      await db.query(
        `INSERT INTO student_profiles (student_id, user_id, faculty_id, gpa, attendance, semester, schedule, grades) 
         VALUES (?, ?, ?, 3.00, 90, 'Spring 2026', ?, ?)`,
        [studentId, userId, facultyId, JSON.stringify(schedule), JSON.stringify(grades)]
      );

    } else if (role === 'Faculty') {
      const teacherId = `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const coursesTaught = ['CS 101'];

      await db.query(
        'INSERT INTO teacher_profiles (teacher_id, user_id, faculty_id, office, courses_taught) VALUES (?, ?, ?, "Turing Hall 101", ?)',
        [teacherId, userId, facultyId, JSON.stringify(coursesTaught)]
      );

    } else if (role === 'Admin') {
      const adminId = `ADM-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.query(
        'INSERT INTO admin_profiles (admin_id, user_id, clearance_level) VALUES (?, ?, "Admin")',
        [adminId, userId]
      );
    }

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [admin.email, 'Create User', 'Success', `Created new user: ${email} (${role})`]
    );

    // Fetch updated users and audit logs
    const updatedUsers = await getUpdatedUsers();
    const updatedLogs = await db.query(
      'SELECT user_email as user, action, status, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 50'
    );

    return NextResponse.json({
      message: 'User created successfully.',
      users: updatedUsers,
      auditLogs: updatedLogs
    });

  } catch (err) {
    console.error('Error in user creation API:', err);
    return NextResponse.json({ error: 'Server error occurred during user creation.' }, { status: 500 });
  }
}
