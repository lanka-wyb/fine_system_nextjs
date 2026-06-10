import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

// Helper to fetch full updated admin dashboard data
async function getAdminDashboardData(user) {
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

  const allUsers = allUsersRaw.map(u => {
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

  const allFines = await db.query(
    `SELECT f.id, f.student_id as studentId, f.type, f.amount, f.reason, f.status, f.date,
            f.payment_date as datePaid, f.receipt_code as receiptCode,
            u_stu.name as studentName, fac.name as facultyName, u_teach.name as teacherName
     FROM fines f
     LEFT JOIN student_profiles sp ON f.student_id = sp.student_id
     LEFT JOIN users u_stu ON sp.user_id = u_stu.id
     LEFT JOIN teacher_profiles tp ON f.issued_by_teacher_id = tp.teacher_id
     LEFT JOIN users u_teach ON tp.user_id = u_teach.id
     LEFT JOIN faculties fac ON f.faculty_id = fac.id
     ORDER BY f.date DESC`
  );

  allFines.forEach(f => {
    f.amount = Number(f.amount);
  });

  const auditLogs = await db.query(
    'SELECT user_email as user, action, status, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 50'
  );

  const totalOutstandingFines = allFines
    .filter(f => f.status === 'Unpaid' || f.status === 'Pending Payment')
    .reduce((sum, f) => sum + f.amount, 0);

  const totalPaidFines = allFines
    .filter(f => f.status === 'Paid')
    .reduce((sum, f) => sum + f.amount, 0);

  const activeSessions = Math.floor(Math.random() * 5) + 2;
  const uptime = `${Math.floor(process.uptime())}s`;

  return {
    role: 'Admin',
    name: user.name,
    profile: user.profile,
    users: allUsers,
    fines: allFines,
    auditLogs: auditLogs,
    stats: {
      totalOutstandingFines,
      totalPaidFines,
      uptime,
      activeSessions
    }
  };
}

export async function POST(request, { params }) {
  try {
    const admin = await getUserFromRequest();
    
    if (!admin || admin.role !== 'Admin') {
      return NextResponse.json({ error: 'Access denied. Only Admins can approve payments.' }, { status: 403 });
    }

    const { id } = await params;
    const fineId = Number(id);

    // 1. Fetch pending payment
    const pendingPayments = await db.query(
      'SELECT * FROM payments WHERE fine_id = ? AND status = "Pending Approval"',
      [fineId]
    );

    if (pendingPayments.length === 0) {
      return NextResponse.json({ error: 'No pending payment request found for this fine.' }, { status: 404 });
    }

    const payment = pendingPayments[0];

    // Find the Admin profile ID
    const adminProfiles = await db.query(
      'SELECT admin_id FROM admin_profiles WHERE user_id = ?',
      [admin.id]
    );
    const adminProfileId = adminProfiles.length > 0 ? adminProfiles[0].admin_id : 'ADM-SYSTEM';

    // 2. Approve payment
    await db.query(
      'UPDATE payments SET status = "Approved", approved_by_admin_id = ?, approval_date = NOW() WHERE id = ?',
      [adminProfileId, payment.id]
    );

    // 3. Update Fine status to Paid
    const receiptCode = `RCPT-${Math.floor(100000 + Math.random() * 900000)}`;
    await db.query(
      'UPDATE fines SET status = "Paid", payment_date = NOW(), receipt_code = ? WHERE id = ?',
      [receiptCode, fineId]
    );

    // 4. Create receipt entry
    await db.query(
      'INSERT INTO receipts (payment_id, receipt_code, pdf_path, generated_at) VALUES (?, ?, ?, NOW())',
      [payment.id, receiptCode, `pdf/receipt-${receiptCode}.pdf`]
    );

    // 5. Log in audit_logs
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [
        admin.email,
        'Approve Payment',
        'Success',
        `Approved payment for Fine ID ${fineId}. Generated Receipt Code: ${receiptCode}`
      ]
    );

    // Return full admin dashboard payload
    const dashboardData = await getAdminDashboardData(admin);

    return NextResponse.json({
      message: 'Payment approved successfully.',
      ...dashboardData
    });

  } catch (err) {
    console.error('Error in payment approval API:', err);
    return NextResponse.json({ error: 'Server error occurred during payment approval.' }, { status: 500 });
  }
}
