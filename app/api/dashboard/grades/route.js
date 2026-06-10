import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

const gradePoints = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0,
  'D': 1.0,  'F': 0.0
};

export async function PUT(request) {
  try {
    const user = await getUserFromRequest();
    
    if (!user || user.role !== 'Faculty') {
      return NextResponse.json({ error: 'Access denied. Only Faculty can edit grades.' }, { status: 403 });
    }

    const { studentId, courseCode, newGrade, newScore } = await request.json();

    if (!studentId || !courseCode || newGrade === undefined || newScore === undefined) {
      return NextResponse.json({ error: 'Student ID, course code, grade, and score are required.' }, { status: 400 });
    }

    // 1. Fetch student profile
    const studentProfiles = await db.query(
      `SELECT sp.student_id, sp.grades, sp.gpa, u.name as studentName 
       FROM student_profiles sp 
       JOIN users u ON sp.user_id = u.id 
       WHERE sp.student_id = ?`,
      [studentId]
    );

    if (studentProfiles.length === 0) {
      return NextResponse.json({ error: 'Student profile not found.' }, { status: 404 });
    }

    const student = studentProfiles[0];
    const grades = db.safeJsonParse(student.grades);

    // 2. Find course and update
    const gradeItem = grades.find(g => g.code === courseCode);
    if (!gradeItem) {
      return NextResponse.json({ error: 'Course record not found for student.' }, { status: 404 });
    }

    const oldGrade = gradeItem.grade;
    gradeItem.grade = newGrade;
    gradeItem.score = parseInt(newScore);

    // 3. Recalculate GPA
    const totalGrades = grades.length;
    let totalPoints = 0;
    grades.forEach(g => {
      totalPoints += gradePoints[g.grade] !== undefined ? gradePoints[g.grade] : 2.0;
    });
    const calculatedGpa = (totalPoints / totalGrades).toFixed(2);

    // 4. Save to MariaDB
    await db.query(
      'UPDATE student_profiles SET grades = ?, gpa = ? WHERE student_id = ?',
      [JSON.stringify(grades), calculatedGpa, studentId]
    );

    // 5. Audit Log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [
        user.email,
        'Grade Edit',
        'Success',
        `Edited ${student.studentName}'s grade in ${courseCode} from ${oldGrade} to ${newGrade}`
      ]
    );

    // Return updated teacher profile details
    const tpProfiles = await db.query(
      `SELECT tp.teacher_id, tp.office, tp.courses_taught, f.name as facultyName 
       FROM teacher_profiles tp 
       LEFT JOIN faculties f ON tp.faculty_id = f.id 
       WHERE tp.user_id = ?`,
      [user.id]
    );

    const updatedProfile = {
      facultyId: tpProfiles[0].teacher_id,
      facultyName: tpProfiles[0].facultyName || 'Science',
      office: tpProfiles[0].office,
      coursesTaught: db.safeJsonParse(tpProfiles[0].courses_taught)
    };

    return NextResponse.json({
      message: 'Grade updated successfully.',
      profile: updatedProfile
    });

  } catch (err) {
    console.error('Error in grade edit API:', err);
    return NextResponse.json({ error: 'Server error occurred during grade edit.' }, { status: 500 });
  }
}
