const jwt = require('jsonwebtoken');
const db = require('./db');
const { cookies } = require('next/headers');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_sis_portal_key_2026_06_10';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function getUserFromRequest() {
  let token = null;
  try {
    const cookieStore = await cookies();
    token = cookieStore.get('token')?.value;
  } catch (e) {
    // Fallback if headers are not available
  }

  if (!token) return null;
  
  const decoded = verifyToken(token);
  if (!decoded) return null;

  // Fetch user from DB
  const users = await db.query(
    'SELECT id, name, email, role, status, lock_until, failed_attempts FROM users WHERE id = ?',
    [decoded.id]
  );
  
  if (users.length === 0) return null;
  const user = users[0];

  // Convert lock_until to timestamp
  if (user.status === 'locked' && user.lock_until && new Date(user.lock_until) > new Date()) {
    return null;
  }

  // Load user profile details depending on role
  if (user.role === 'Student') {
    const profiles = await db.query(
      `SELECT sp.student_id, sp.gpa, sp.attendance, sp.semester, sp.schedule, sp.grades, f.name as major 
       FROM student_profiles sp 
       LEFT JOIN faculties f ON sp.faculty_id = f.id 
       WHERE sp.user_id = ?`,
      [user.id]
    );
    if (profiles.length > 0) {
      const p = profiles[0];
      user.profile = {
        studentId: p.student_id,
        major: p.major || 'Science',
        gpa: String(p.gpa),
        attendance: p.attendance,
        semester: p.semester,
        schedule: db.safeJsonParse(p.schedule),
        grades: db.safeJsonParse(p.grades)
      };
    }
  } else if (user.role === 'Faculty') {
    const profiles = await db.query(
      `SELECT tp.teacher_id, tp.office, tp.courses_taught, f.name as facultyName 
       FROM teacher_profiles tp 
       LEFT JOIN faculties f ON tp.faculty_id = f.id 
       WHERE tp.user_id = ?`,
      [user.id]
    );
    if (profiles.length > 0) {
      const p = profiles[0];
      user.profile = {
        facultyId: p.teacher_id,
        facultyName: p.facultyName || 'Science',
        office: p.office,
        coursesTaught: db.safeJsonParse(p.courses_taught)
      };
    }
  } else if (user.role === 'Admin') {
    const profiles = await db.query(
      'SELECT admin_id, clearance_level FROM admin_profiles WHERE user_id = ?',
      [user.id]
    );
    if (profiles.length > 0) {
      const p = profiles[0];
      user.profile = {
        adminId: p.admin_id,
        clearanceLevel: p.clearance_level
      };
    }
  }

  return user;
}

module.exports = {
  signToken,
  verifyToken,
  getUserFromRequest
};
