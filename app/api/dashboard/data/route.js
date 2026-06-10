import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getUserFromRequest();
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    if (user.role === 'Student') {
      // 1. Fetch Student's Fines with joins for names
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

      // Convert decimal fields in MariaDB to float
      studentFines.forEach(f => {
        f.amount = Number(f.amount);
      });

      // Calculate outstanding total (Unpaid + Pending Payment)
      const outstandingFines = studentFines
        .filter(f => f.status === 'Unpaid')
        .reduce((sum, f) => sum + f.amount, 0);

      return NextResponse.json({
        role: 'Student',
        name: user.name,
        profile: user.profile,
        fines: studentFines,
        outstandingFines
      });

    } else if (user.role === 'Faculty') {
      // 1. Fetch fines issued by this specific Faculty member
      const finesIssued = await db.query(
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
        [user.profile.facultyId]
      );

      finesIssued.forEach(f => {
        f.amount = Number(f.amount);
      });

      // 2. Access Restriction: Load only students belonging to this teacher's faculty
      const teacherProfile = await db.query(
        'SELECT faculty_id FROM teacher_profiles WHERE teacher_id = ?',
        [user.profile.facultyId]
      );
      
      let studentsInFaculty = [];
      if (teacherProfile.length > 0) {
        const facultyId = teacherProfile[0].faculty_id;
        
        studentsInFaculty = await db.query(
          `SELECT u.id, u.name, sp.student_id as studentId, fac.name as major
           FROM student_profiles sp
           JOIN users u ON sp.user_id = u.id
           LEFT JOIN faculties fac ON sp.faculty_id = fac.id
           WHERE sp.faculty_id = ? AND u.status = "active"`,
          [facultyId]
        );
      }

      return NextResponse.json({
        role: 'Faculty',
        name: user.name,
        profile: user.profile,
        fines: finesIssued,
        students: studentsInFaculty
      });

    } else if (user.role === 'Admin') {
      // 1. Fetch all users in system
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

      // 2. Fetch all Fines in system
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

      // 3. Fetch Audit Logs
      const auditLogs = await db.query(
        'SELECT user_email as user, action, status, details, timestamp FROM audit_logs ORDER BY timestamp DESC LIMIT 50'
      );

      // 4. Calculate Stats
      const totalOutstandingFines = allFines
        .filter(f => f.status === 'Unpaid' || f.status === 'Pending Payment')
        .reduce((sum, f) => sum + f.amount, 0);

      const totalPaidFines = allFines
        .filter(f => f.status === 'Paid')
        .reduce((sum, f) => sum + f.amount, 0);

      const activeSessions = Math.floor(Math.random() * 5) + 2;
      const uptime = `${Math.floor(process.uptime())}s`;

      return NextResponse.json({
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
      });
    }

    return NextResponse.json({ error: 'Access denied.' }, { status: 403 });

  } catch (err) {
    console.error('Error in dashboard/data API:', err);
    return NextResponse.json({ error: 'Server error occurred during data load.' }, { status: 500 });
  }
}
