import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request) {
  try {
    const user = await getUserFromRequest();
    
    if (!user || user.role !== 'Faculty') {
      return NextResponse.json({ error: 'Access denied. Only Faculty can issue fines.' }, { status: 403 });
    }

    const { studentId, type, amount, reason } = await request.json();

    if (!studentId || !type || !amount || !reason) {
      return NextResponse.json({ error: 'All fields (studentId, type, amount, reason) are required.' }, { status: 400 });
    }

    // Retrieve student and check department mapping
    const students = await db.query(
      'SELECT user_id, faculty_id FROM student_profiles WHERE student_id = ?',
      [studentId]
    );

    if (students.length === 0) {
      return NextResponse.json({ error: 'Student not found in registry.' }, { status: 404 });
    }

    const student = students[0];

    // Retrieve teacher's profile and check faculty matching
    const teachers = await db.query(
      'SELECT teacher_id, faculty_id FROM teacher_profiles WHERE user_id = ?',
      [user.id]
    );

    if (teachers.length === 0) {
      return NextResponse.json({ error: 'Teacher profile not found.' }, { status: 404 });
    }

    const teacher = teachers[0];

    // Enforce faculty-level access control
    if (student.faculty_id !== teacher.faculty_id) {
      return NextResponse.json({ 
        error: 'Access denied. You can only issue fines to students in your own faculty.' 
      }, { status: 403 });
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ error: 'Invalid fine amount.' }, { status: 400 });
    }

    // Insert fine
    await db.query(
      'INSERT INTO fines (student_id, issued_by_teacher_id, faculty_id, type, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?, "Unpaid")',
      [studentId, teacher.teacher_id, teacher.faculty_id, type.trim(), numericAmount, reason.trim(), 'Unpaid']
    );

    // Audit log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [
        user.email,
        'Issue Fine',
        'Success',
        `Issued $${numericAmount.toFixed(2)} ${type} fine to student ${studentId}`
      ]
    );

    // Return updated fines list issued by this teacher
    const updatedFines = await db.query(
      `SELECT f.id, f.student_id as studentId, f.type, f.amount, f.reason, f.status, f.date,
              f.payment_date as datePaid, f.receipt_code as receiptCode,
              u_stu.name as studentName, fac.name as facultyName, u_teach.name as teacherName
       FROM fines f
       LEFT JOIN student_profiles sp ON f.student_id = sp.student_id
       LEFT JOIN users u_stu ON sp.user_id = u_stu.id
       LEFT JOIN teacher_profiles tp ON f.issued_by_teacher_id = tp.teacher_id
       LEFT JOIN users u_teach ON tp.user_id = u_teach.id
       LEFT JOIN faculties fac ON f.faculty_id = fac.id
       WHERE f.issued_by_teacher_id = ?
       ORDER BY f.date DESC`,
      [teacher.teacher_id]
    );

    updatedFines.forEach(f => {
      f.amount = Number(f.amount);
    });

    return NextResponse.json({
      message: 'Fine issued successfully.',
      fines: updatedFines
    });

  } catch (err) {
    console.error('Error in fine issuance API:', err);
    return NextResponse.json({ error: 'Server error occurred during fine issuance.' }, { status: 500 });
  }
}
