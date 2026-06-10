import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { name, email, password, role } = await request.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All fields (name, email, password, role) are required.' }, { status: 400 });
    }

    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered.' }, { status: 400 });
    }

    const validRoles = ['Student', 'Faculty'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid user role selected.' }, { status: 400 });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    const userResult = await db.query(
      'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, "active")',
      [name.trim(), email.trim(), hashedPassword, role, 'active']
    );
    const userId = Number(userResult.insertId);

    // Default Faculty ID selection for profile creation
    const sciDb = await db.query('SELECT id FROM faculties WHERE name = "Science"');
    const facultyId = sciDb.length > 0 ? sciDb[0].id : null;

    if (role === 'Student') {
      const studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.query(
        `INSERT INTO student_profiles (student_id, user_id, faculty_id, gpa, attendance, semester, schedule, grades) 
         VALUES (?, ?, ?, 0.00, 100, 'Spring 2026', '[]', '[]')`,
        [studentId, userId, facultyId]
      );
    } else if (role === 'Faculty') {
      const teacherId = `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      await db.query(
        'INSERT INTO teacher_profiles (teacher_id, user_id, faculty_id, office, courses_taught) VALUES (?, ?, ?, "Administration Bldg", "[]")',
        [teacherId, userId, facultyId]
      );
    }

    // Log Registration
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [email.trim(), 'Registration', 'Success', `Newly registered user as ${role}`]
    );

    return NextResponse.json({ message: 'Registration successful. You can now log in.' });

  } catch (err) {
    console.error('Error in user registration API:', err);
    return NextResponse.json({ error: 'Server error occurred during registration.' }, { status: 500 });
  }
}
