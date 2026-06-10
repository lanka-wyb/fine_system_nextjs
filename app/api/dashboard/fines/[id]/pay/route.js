import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(request, { params }) {
  try {
    const user = await getUserFromRequest();
    
    if (!user || user.role !== 'Student') {
      return NextResponse.json({ error: 'Access denied. Only Students can pay fines.' }, { status: 403 });
    }

    const { id } = await params;
    const fineId = Number(id);

    const { paymentMethod } = await request.json() || { paymentMethod: 'Credit Card' };

    // Fetch fine
    const fines = await db.query('SELECT * FROM fines WHERE id = ?', [fineId]);
    if (fines.length === 0) {
      return NextResponse.json({ error: 'Fine record not found.' }, { status: 404 });
    }

    const fine = fines[0];

    // Enforce student ownership
    if (fine.student_id !== user.profile.studentId) {
      return NextResponse.json({ error: 'Access denied. This fine does not belong to you.' }, { status: 403 });
    }

    // Must be unpaid
    if (fine.status !== 'Unpaid') {
      return NextResponse.json({ error: 'This fine is already paid or awaiting approval.' }, { status: 400 });
    }

    const amount = Number(fine.amount);

    // Create payment entry as Pending Approval
    await db.query(
      'INSERT INTO payments (fine_id, amount_paid, payment_method, status) VALUES (?, ?, ?, "Pending Approval")',
      [fineId, amount, paymentMethod || 'Credit Card']
    );

    // Update Fine Status to Pending Payment
    await db.query('UPDATE fines SET status = "Pending Payment" WHERE id = ?', [fineId]);

    // Audit Log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [
        user.email,
        'Initiate Payment',
        'Success',
        `Requested approval for $${amount.toFixed(2)} payment of ${fine.type} (Fine ID: ${fineId})`
      ]
    );

    // Load updated student dashboard dataset to return
    const studentFines = await db.query(
      `SELECT f.id, f.student_id as studentId, f.type, f.amount, f.reason, f.status, f.date, 
              f.payment_date as datePaid, f.receipt_code as receiptCode,
              u_stu.name as studentName, fac.name as facultyName, u_teach.name as teacherName
       FROM fines f
       LEFT JOIN student_profiles sp ON f.student_id = sp.student_id
       LEFT JOIN users u_stu ON sp.user_id = u_stu.id
       LEFT JOIN teacher_profiles tp ON f.issued_by_teacher_id = tp.teacher_id
       LEFT JOIN users u_teach ON tp.user_id = u_teach.id
       LEFT JOIN faculties fac ON f.faculty_id = fac.id
       WHERE f.student_id = ?
       ORDER BY f.date DESC`,
      [user.profile.studentId]
    );

    studentFines.forEach(f => {
      f.amount = Number(f.amount);
    });

    const outstandingFines = studentFines
      .filter(f => f.status === 'Unpaid')
      .reduce((sum, f) => sum + f.amount, 0);

    return NextResponse.json({
      message: 'Payment request initiated. Awaiting Administrator verification.',
      fines: studentFines,
      outstandingFines
    });

  } catch (err) {
    console.error('Error in fine payment API:', err);
    return NextResponse.json({ error: 'Server error occurred during payment.' }, { status: 500 });
  }
}
