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

// 1. DELETE USER (Admin only)
export async function DELETE(request, { params }) {
  try {
    const admin = await getUserFromRequest();
    
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Access denied. Only Admin can delete users.' }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);

    // Fetch user to verify
    const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const userToDelete = users[0];

    // Cannot delete yourself
    if (userToDelete.id === admin.id) {
      return NextResponse.json({ error: 'You cannot delete your own admin account.' }, { status: 400 });
    }

    // Delete user (profiles deleted via ON DELETE CASCADE)
    await db.query('DELETE FROM users WHERE id = ?', [userId]);

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [admin.email, 'Delete User', 'Success', `Deleted user: ${userToDelete.email} (${userToDelete.role})`]
    );

    const updatedUsers = await getUpdatedUsers();
    const updatedLogs = await db.query(
      'SELECT user_email as user, action, status, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 50'
    );

    return NextResponse.json({
      message: 'User deleted successfully.',
      users: updatedUsers,
      auditLogs: updatedLogs
    });

  } catch (err) {
    console.error('Error in user delete API:', err);
    return NextResponse.json({ error: 'Server error occurred during user deletion.' }, { status: 500 });
  }
}

// 2. PUT EDIT USER (Admin only)
export async function PUT(request, { params }) {
  try {
    const admin = await getUserFromRequest();
    
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Access denied. Only Admin can edit users.' }, { status: 403 });
    }

    const { id } = await params;
    const userId = Number(id);

    // Fetch existing user details
    const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const targetUser = users[0];

    // Read edit inputs
    const { name, email, role, status, facultyName, password } = await request.json();

    if (!name || !email || !role || !status) {
      return NextResponse.json({ error: 'Name, email, role, and status are required.' }, { status: 400 });
    }

    // Prevent self-role downgrade
    if (targetUser.id === admin.id && role !== 'Admin') {
      return NextResponse.json({ error: 'You cannot change your own admin role.' }, { status: 400 });
    }

    // Check email uniqueness
    const emailDup = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?',
      [email.trim(), userId]
    );
    if (emailDup.length > 0) {
      return NextResponse.json({ error: 'Email already in use by another user.' }, { status: 400 });
    }

    // Update main user record
    await db.query(
      'UPDATE users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?',
      [name.trim(), email.trim(), role, status, userId]
    );

    // Auto unlock if active
    if (status === 'active') {
      await db.query('UPDATE users SET lock_until = NULL, failed_attempts = 0 WHERE id = ?', [userId]);
    }

    // Update password if typed
    if (password && password.trim() !== '') {
      const hashedPassword = bcrypt.hashSync(password, 10);
      await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
    }

    // Update faculty mapping details
    let facultyId = null;
    if (facultyName) {
      const facDb = await db.query('SELECT id FROM faculties WHERE name = ?', [facultyName]);
      if (facDb.length > 0) {
        facultyId = facDb[0].id;
      }
    }

    // Handle profiles transformations
    if (role === 'Student') {
      const sp = await db.query('SELECT student_id FROM student_profiles WHERE user_id = ?', [userId]);
      if (sp.length > 0) {
        // Update
        await db.query('UPDATE student_profiles SET faculty_id = ? WHERE user_id = ?', [facultyId, userId]);
      } else {
        // Create student profile
        const studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        await db.query(
          `INSERT INTO student_profiles (student_id, user_id, faculty_id, gpa, attendance, semester, schedule, grades) 
           VALUES (?, ?, ?, 0.00, 100, 'Spring 2026', '[]', '[]')`,
          [studentId, userId, facultyId]
        );
      }
    } else if (role === 'Faculty') {
      const tp = await db.query('SELECT teacher_id FROM teacher_profiles WHERE user_id = ?', [userId]);
      if (tp.length > 0) {
        // Update
        await db.query('UPDATE teacher_profiles SET faculty_id = ? WHERE user_id = ?', [facultyId, userId]);
      } else {
        // Create teacher profile
        const teacherId = `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        await db.query(
          'INSERT INTO teacher_profiles (teacher_id, user_id, faculty_id, office, courses_taught) VALUES (?, ?, ?, "Turing Hall 101", "[]")',
          [teacherId, userId, facultyId]
        );
      }
    } else if (role === 'Admin') {
      const ap = await db.query('SELECT admin_id FROM admin_profiles WHERE user_id = ?', [userId]);
      if (ap.length === 0) {
        const adminId = `ADM-${Math.floor(1000 + Math.random() * 9000)}`;
        await db.query('INSERT INTO admin_profiles (admin_id, user_id, clearance_level) VALUES (?, ?, "Admin")', [adminId, userId]);
      }
    }

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [admin.email, 'Edit User', 'Success', `Modified user: ${email} (${role}, ${status})`]
    );

    const updatedUsers = await getUpdatedUsers();
    const updatedLogs = await db.query(
      'SELECT user_email as user, action, status, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 50'
    );

    return NextResponse.json({
      message: 'User updated successfully.',
      users: updatedUsers,
      auditLogs: updatedLogs
    });

  } catch (err) {
    console.error('Error in user edit API:', err);
    return NextResponse.json({ error: 'Server error occurred during user edit.' }, { status: 500 });
  }
}
