const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'student-info-system-super-secret-key-2026';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Mock Database (In-Memory)
const db = {
  users: [
    {
      id: 'usr_1',
      name: 'Emma Watson',
      email: 'student@school.edu',
      password: bcrypt.hashSync('student123', 10),
      role: 'Student',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        studentId: 'STU-2026-0042',
        major: 'Computer Science',
        gpa: '3.85',
        attendance: 94,
        semester: 'Spring 2026',
        schedule: [
          { code: 'CS 101', name: 'Intro to Computer Science', time: 'Mon/Wed 10:00 AM', room: 'Hall A' },
          { code: 'MATH 201', name: 'Calculus II', time: 'Tue/Thu 01:00 PM', room: 'Room 302' },
          { code: 'ENG 102', name: 'Academic Writing', time: 'Mon/Wed 02:30 PM', room: 'Room 105' }
        ],
        grades: [
          { course: 'CS 101', code: 'CS 101', grade: 'A', score: 95 },
          { course: 'MATH 201', code: 'MATH 201', grade: 'A-', score: 91 },
          { course: 'ENG 102', code: 'ENG 102', grade: 'B+', score: 88 }
        ]
      }
    },
    // Seeded 6 Faculty Members representing the 6 Faculties
    {
      id: 'usr_2',
      name: 'Dr. Alan Turing',
      email: 'teacher@school.edu', // Existing technology teacher
      password: bcrypt.hashSync('faculty123', 10),
      role: 'Faculty',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        facultyId: 'FAC-2026-1001',
        facultyName: 'Technology',
        office: 'Turing Hall 401',
        coursesTaught: ['CS 101', 'CS 302 (Algorithms)'],
        students: [
          { id: 'usr_1', name: 'Emma Watson', studentId: 'STU-2026-0042', course: 'CS 101', grade: 'A', score: 95 },
          { id: 'usr_4', name: 'John Doe', studentId: 'STU-2026-0105', course: 'CS 101', grade: 'B', score: 83 },
          { id: 'usr_5', name: 'Sarah Connor', studentId: 'STU-2026-0209', course: 'CS 101', grade: 'A+', score: 98 }
        ]
      }
    },
    {
      id: 'fac_medicine',
      name: 'Dr. Gregory House',
      email: 'medicine@school.edu',
      password: bcrypt.hashSync('faculty123', 10),
      role: 'Faculty',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        facultyId: 'FAC-2026-2002',
        facultyName: 'Medicine',
        office: 'Clinic Lab A',
        coursesTaught: ['MED 101 (Diagnostics)'],
        students: [
          { id: 'usr_1', name: 'Emma Watson', studentId: 'STU-2026-0042', course: 'MED 101 (Diagnostics)', grade: 'B+', score: 87 }
        ]
      }
    },
    {
      id: 'fac_management',
      name: 'Dr. Peter Drucker',
      email: 'management@school.edu',
      password: bcrypt.hashSync('faculty123', 10),
      role: 'Faculty',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        facultyId: 'FAC-2026-3003',
        facultyName: 'Management',
        office: 'Business Suite 10',
        coursesTaught: ['MGT 205 (Org Behavior)'],
        students: [
          { id: 'usr_4', name: 'John Doe', studentId: 'STU-2026-0105', course: 'MGT 205 (Org Behavior)', grade: 'A', score: 92 }
        ]
      }
    },
    {
      id: 'fac_science',
      name: 'Dr. Marie Curie',
      email: 'science@school.edu',
      password: bcrypt.hashSync('faculty123', 10),
      role: 'Faculty',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        facultyId: 'FAC-2026-4004',
        facultyName: 'Science',
        office: 'Curie Lab 202',
        coursesTaught: ['PHY 102 (Nuclear Phys)'],
        students: [
          { id: 'usr_5', name: 'Sarah Connor', studentId: 'STU-2026-0209', course: 'PHY 102 (Nuclear Phys)', grade: 'A', score: 95 }
        ]
      }
    },
    {
      id: 'fac_agriculture',
      name: 'Dr. Norman Borlaug',
      email: 'agriculture@school.edu',
      password: bcrypt.hashSync('faculty123', 10),
      role: 'Faculty',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        facultyId: 'FAC-2026-5005',
        facultyName: 'Agriculture',
        office: 'Greenhouse B',
        coursesTaught: ['AGR 101 (Crop Science)'],
        students: []
      }
    },
    {
      id: 'fac_foodscience',
      name: 'Dr. Louis Pasteur',
      email: 'foodscience@school.edu',
      password: bcrypt.hashSync('faculty123', 10),
      role: 'Faculty',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        facultyId: 'FAC-2026-6006',
        facultyName: 'Food Science',
        office: 'Bio-Processing Lab',
        coursesTaught: ['FSC 201 (Fermentation)'],
        students: []
      }
    },
    {
      id: 'usr_3',
      name: 'System Administrator',
      email: 'admin@school.edu',
      password: bcrypt.hashSync('admin123', 10),
      role: 'Admin',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        adminId: 'ADM-0001',
        clearanceLevel: 'SuperAdmin'
      }
    },
    {
      id: 'usr_4',
      name: 'John Doe',
      email: 'john@school.edu',
      password: bcrypt.hashSync('student123', 10),
      role: 'Student',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        studentId: 'STU-2026-0105',
        major: 'Mathematics',
        gpa: '3.12',
        attendance: 88,
        semester: 'Spring 2026',
        schedule: [
          { code: 'CS 101', name: 'Intro to Computer Science', time: 'Mon/Wed 10:00 AM', room: 'Hall A' },
          { code: 'MATH 201', name: 'Calculus II', time: 'Tue/Thu 01:00 PM', room: 'Room 302' }
        ],
        grades: [
          { course: 'CS 101', code: 'CS 101', grade: 'B', score: 83 },
          { course: 'MATH 201', code: 'MATH 201', grade: 'B+', score: 87 }
        ]
      }
    },
    {
      id: 'usr_5',
      name: 'Sarah Connor',
      email: 'sarah@school.edu',
      password: bcrypt.hashSync('student123', 10),
      role: 'Student',
      status: 'active',
      failedAttempts: 0,
      lockUntil: null,
      profile: {
        studentId: 'STU-2026-0209',
        major: 'Cyber Security',
        gpa: '3.98',
        attendance: 98,
        semester: 'Spring 2026',
        schedule: [
          { code: 'CS 101', name: 'Intro to Computer Science', time: 'Mon/Wed 10:00 AM', room: 'Hall A' },
          { code: 'CS 302', name: 'Algorithms', time: 'Fri 09:00 AM', room: 'Lab 2' }
        ],
        grades: [
          { course: 'CS 101', code: 'CS 101', grade: 'A+', score: 98 },
          { course: 'CS 302', code: 'CS 302', grade: 'A', score: 96 }
        ]
      }
    }
  ],
  // Central Fines Database Table
  fines: [
    {
      id: 'fin_1',
      studentId: 'STU-2026-0042',
      studentName: 'Emma Watson',
      facultyName: 'Technology',
      teacherName: 'Dr. Alan Turing',
      type: 'Library Late Fee',
      amount: 15.00,
      details: 'Overdue textbook: Intro to Computing',
      date: new Date(Date.now() - 3600000 * 24 * 5).toISOString(), // 5 days ago
      datePaid: new Date(Date.now() - 3600000 * 24 * 4).toISOString(),
      status: 'Paid'
    },
    {
      id: 'fin_2',
      studentId: 'STU-2026-0105',
      studentName: 'John Doe',
      facultyName: 'Science',
      teacherName: 'Dr. Marie Curie',
      type: 'Laboratory Damage',
      amount: 45.00,
      details: 'Broken glass beaker in Physics Lab 2',
      date: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
      datePaid: null,
      status: 'Unpaid'
    },
    {
      id: 'fin_3',
      studentId: 'STU-2026-0042',
      studentName: 'Emma Watson',
      facultyName: 'Medicine',
      teacherName: 'Dr. Gregory House',
      type: 'Equipment Damage',
      amount: 120.00,
      details: 'Stethoscope damage in Med Diagnostics Seminar',
      date: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
      datePaid: null,
      status: 'Unpaid'
    }
  ],
  auditLogs: [
    { timestamp: new Date(Date.now() - 3600000 * 5).toISOString(), user: 'system', action: 'System Setup', status: 'Success', details: 'Preloaded 6 faculties and initial fine logs' },
    { timestamp: new Date(Date.now() - 3600000 * 4).toISOString(), user: 'admin@school.edu', action: 'Admin Login', status: 'Success', details: 'Admin logged in from IP ::1' }
  ]
};

// Log helper
function addLog(userEmail, action, status, details) {
  db.auditLogs.unshift({
    timestamp: new Date().toISOString(),
    user: userEmail,
    action: action,
    status: status,
    details: details
  });
  if (db.auditLogs.length > 50) {
    db.auditLogs.pop();
  }
}

// Authentication Middleware
function authenticateJWT(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.clearCookie('token');
      return res.status(403).json({ error: 'Session expired. Please log in again.' });
    }
    
    const user = db.users.find(u => u.id === decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User no longer exists.' });
    }

    if (user.status === 'locked' && user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(423).json({ error: 'Account is temporarily locked.' });
    }

    req.user = user;
    next();
  });
}

// API Routes

// 1. LOGIN API
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    addLog(email, 'Login Attempt', 'Failure', 'User not found');
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status === 'locked') {
    if (user.lockUntil) {
      if (user.lockUntil > Date.now()) {
        const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 1000);
        return res.status(423).json({ 
          error: `Account locked. Try again in ${remainingTime} seconds.` 
        });
      } else {
        user.status = 'active';
        user.lockUntil = null;
        user.failedAttempts = 0;
      }
    } else {
      return res.status(423).json({ 
        error: 'Account locked. Please contact the administrator.' 
      });
    }
  }

  const passwordMatch = bcrypt.compareSync(password, user.password);

  if (!passwordMatch) {
    user.failedAttempts += 1;
    addLog(email, 'Login Attempt', 'Failure', `Incorrect password. Failed attempt #${user.failedAttempts}`);

    if (user.failedAttempts >= 3) {
      user.status = 'locked';
      user.lockUntil = Date.now() + 60000;
      addLog(email, 'Account Lockout', 'Locked', 'Locked out for 60 seconds due to 3 consecutive failures');
      return res.status(423).json({ 
        error: 'Account locked due to 3 failed attempts. Please wait 60 seconds.' 
      });
    }

    const attemptsLeft = 3 - user.failedAttempts;
    return res.status(401).json({ 
      error: `Invalid email or password. You have ${attemptsLeft} attempt(s) remaining.` 
    });
  }

  user.failedAttempts = 0;
  user.lockUntil = null;
  user.status = 'active';

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '15m' });

  res.cookie('token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000
  });

  addLog(user.email, 'Login', 'Success', `User logged in with role ${user.role}`);

  const { password: _, ...userWithoutPassword } = user;
  res.json({ message: 'Login successful', user: userWithoutPassword });
});

// 2. LOGOUT API
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.token;
  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded) {
        addLog(decoded.email, 'Logout', 'Success', 'User logged out');
      }
    } catch (e) {}
  }
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// 3. ME API
app.get('/api/auth/me', authenticateJWT, (req, res) => {
  const { password, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
});

// 4. REGISTER API
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered.' });
  }

  const validRoles = ['Student', 'Faculty'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid user role selected.' });
  }

  let profile = {};
  if (role === 'Student') {
    const studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    profile = {
      studentId,
      major: 'Science',
      gpa: '0.00',
      attendance: 100,
      semester: 'Spring 2026',
      schedule: [],
      grades: []
    };
  } else if (role === 'Faculty') {
    const facultyId = `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    profile = {
      facultyId,
      facultyName: 'Science', // default
      office: 'Administration Bldg',
      coursesTaught: [],
      students: []
    };
  }

  const newUser = {
    id: `usr_${db.users.length + 1}`,
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role,
    status: 'active',
    failedAttempts: 0,
    lockUntil: null,
    profile
  };

  db.users.push(newUser);
  addLog(email, 'Registration', 'Success', `Newly registered user as ${role}`);

  res.json({ message: 'Registration successful. You can now log in.' });
});

// 5. RESET PASSWORD
app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required.' });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    addLog(email, 'Password Reset', 'Failure', 'Attempted password reset for non-existent user');
    return res.json({ message: 'If the email matches an active account, instructions have been simulated.' });
  }

  user.password = bcrypt.hashSync(newPassword, 10);
  user.status = 'active';
  user.lockUntil = null;
  user.failedAttempts = 0;

  addLog(email, 'Password Reset', 'Success', 'Password was reset successfully');
  res.json({ message: 'Password reset successful. You can now login with your new password.' });
});

// 6. DASHBOARD DATA
app.get('/api/dashboard/data', authenticateJWT, (req, res) => {
  const user = req.user;
  
  if (user.role === 'Student') {
    // Fetch Student's Fines
    const studentFines = db.fines.filter(f => f.studentId === user.profile.studentId);
    const outstandingFines = studentFines
      .filter(f => f.status === 'Unpaid')
      .reduce((sum, f) => sum + f.amount, 0);

    res.json({
      role: 'Student',
      name: user.name,
      profile: user.profile,
      fines: studentFines,
      outstandingFines
    });
  } else if (user.role === 'Faculty') {
    // Fetch fines issued by this specific Faculty member
    const finesIssued = db.fines.filter(f => f.teacherName === user.name);
    
    res.json({
      role: 'Faculty',
      name: user.name,
      profile: user.profile,
      fines: finesIssued
    });
  } else if (user.role === 'Admin') {
    const totalUsers = db.users.length;
    const activeSessions = Math.floor(Math.random() * 5) + 2;
    const systemStatus = {
      cpuUsage: '12%',
      memoryUsage: '348 MB / 1024 MB',
      uptime: `${Math.floor(process.uptime())}s`,
      totalUsers,
      activeSessions
    };

    // Calculate aggregated fine statistics
    const totalOutstandingFines = db.fines
      .filter(f => f.status === 'Unpaid')
      .reduce((sum, f) => sum + f.amount, 0);

    const totalPaidFines = db.fines
      .filter(f => f.status === 'Paid')
      .reduce((sum, f) => sum + f.amount, 0);

    res.json({
      role: 'Admin',
      name: user.name,
      profile: user.profile,
      users: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, profile: u.profile })),
      auditLogs: db.auditLogs,
      fines: db.fines,
      stats: {
        totalOutstandingFines,
        totalPaidFines,
        uptime: systemStatus.uptime,
        activeSessions
      }
    });
  } else {
    res.status(403).json({ error: 'Access denied.' });
  }
});

// 7. EDIT GRADE API (Faculty only)
app.put('/api/dashboard/grades', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Faculty') {
    return res.status(403).json({ error: 'Access denied. Only Faculty can edit grades.' });
  }

  const { studentId, courseCode, newGrade, newScore } = req.body;

  if (!studentId || !courseCode || newGrade === undefined || newScore === undefined) {
    return res.status(400).json({ error: 'Student ID, course code, grade, and score are required.' });
  }

  const student = db.users.find(u => u.profile && u.profile.studentId === studentId);
  if (!student) {
    return res.status(444).json({ error: 'Student not found.' });
  }

  const gradeItem = student.profile.grades.find(g => g.code === courseCode);
  if (gradeItem) {
    const oldGrade = gradeItem.grade;
    const oldScore = gradeItem.score;
    gradeItem.grade = newGrade;
    gradeItem.score = parseInt(newScore);

    const totalGrades = student.profile.grades.length;
    let totalGPAPoints = 0;
    student.profile.grades.forEach(g => {
      if (g.grade.startsWith('A')) totalGPAPoints += 4.0;
      else if (g.grade.startsWith('B')) totalGPAPoints += 3.0;
      else if (g.grade.startsWith('C')) totalGPAPoints += 2.0;
      else totalGPAPoints += 1.0;
    });
    student.profile.gpa = (totalGPAPoints / totalGrades).toFixed(2);

    const facultyUser = req.user;
    const studentInList = facultyUser.profile.students.find(s => s.studentId === studentId && s.course === courseCode);
    if (studentInList) {
      studentInList.grade = newGrade;
      studentInList.score = parseInt(newScore);
    }

    addLog(facultyUser.email, 'Grade Edit', 'Success', `Edited ${student.name}'s grade in ${courseCode} from ${oldGrade} to ${newGrade}`);
    res.json({ message: 'Grade updated successfully.', profile: facultyUser.profile });
  } else {
    res.status(404).json({ error: 'Course record not found.' });
  }
});

// 8. ADD USER API (Admin only)
app.post('/api/dashboard/users', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin can create users.' });
  }

  const { name, email, password, role, facultyName } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already exists.' });
  }

  let profile = {};
  if (role === 'Student') {
    const studentId = `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    profile = {
      studentId,
      major: facultyName || 'Science',
      gpa: '3.00',
      attendance: 90,
      semester: 'Spring 2026',
      schedule: [
        { code: 'CS 101', name: 'Intro to Computer Science', time: 'Mon/Wed 10:00 AM', room: 'Hall A' }
      ],
      grades: [
        { course: 'CS 101', code: 'CS 101', grade: 'B', score: 85 }
      ]
    };
    
    const turing = db.users.find(u => u.id === 'usr_2');
    if (turing) {
      turing.profile.students.push({
        id: `usr_${db.users.length + 1}`,
        name,
        studentId,
        course: 'CS 101',
        grade: 'B',
        score: 85
      });
    }
  } else if (role === 'Faculty') {
    profile = {
      facultyId: `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      facultyName: facultyName || 'Science',
      office: 'Turing Hall 101',
      coursesTaught: ['CS 101'],
      students: []
    };
  } else {
    profile = { adminId: `ADM-${Math.floor(1000 + Math.random() * 9000)}`, clearanceLevel: 'Admin' };
  }

  const newUser = {
    id: `usr_${db.users.length + 1}`,
    name,
    email,
    password: bcrypt.hashSync(password, 10),
    role,
    status: 'active',
    failedAttempts: 0,
    lockUntil: null,
    profile
  };

  db.users.push(newUser);
  addLog(req.user.email, 'Create User', 'Success', `Created new user: ${email} (${role})`);

  res.json({ 
    message: 'User created successfully.', 
    users: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, profile: u.profile })),
    auditLogs: db.auditLogs
  });
});

// 9. DELETE USER API (Admin only)
app.delete('/api/dashboard/users/:id', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin can delete users.' });
  }

  const userId = req.params.id;
  const userToDeleteIndex = db.users.findIndex(u => u.id === userId);

  if (userToDeleteIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const userToDelete = db.users[userToDeleteIndex];

  if (userToDelete.id === req.user.id) {
    return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  }

  db.users.splice(userToDeleteIndex, 1);
  addLog(req.user.email, 'Delete User', 'Success', `Deleted user: ${userToDelete.email} (${userToDelete.role})`);

  res.json({
    message: 'User deleted successfully.',
    users: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, profile: u.profile })),
    auditLogs: db.auditLogs
  });
});

// 9.5 EDIT USER API (Admin only)
app.put('/api/dashboard/users/:id', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Access denied. Only Admin can edit users.' });
  }

  const userId = req.params.id;
  const user = db.users.find(u => u.id === userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const { name, email, role, status, facultyName, password } = req.body;

  if (!name || !email || !role || !status) {
    return res.status(400).json({ error: 'Name, email, role, and status are required.' });
  }

  if (user.id === req.user.id && role !== 'Admin') {
    return res.status(400).json({ error: 'You cannot change your own admin role.' });
  }

  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase() && u.id !== userId)) {
    return res.status(400).json({ error: 'Email already in use by another user.' });
  }

  user.name = name;
  user.email = email;
  user.role = role;
  user.status = status;
  
  if (status === 'active') {
    user.lockUntil = null;
    user.failedAttempts = 0;
  }

  if (role === 'Student') {
    if (!user.profile || !user.profile.studentId) {
      user.profile = {
        studentId: `STU-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        major: facultyName || 'Science',
        gpa: '0.00',
        attendance: 100,
        semester: 'Spring 2026',
        schedule: [],
        grades: []
      };
    } else {
      user.profile.major = facultyName || user.profile.major;
    }
  } else if (role === 'Faculty') {
    if (!user.profile || !user.profile.facultyId) {
      user.profile = {
        facultyId: `FAC-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        facultyName: facultyName || 'Science',
        office: 'Turing Hall 101',
        coursesTaught: [],
        students: []
      };
    } else {
      user.profile.facultyName = facultyName || user.profile.facultyName;
    }
  } else {
    if (!user.profile || !user.profile.adminId) {
      user.profile = {
        adminId: `ADM-${Math.floor(1000 + Math.random() * 9000)}`,
        clearanceLevel: 'Admin'
      };
    }
  }

  if (password && password.trim() !== '') {
    user.password = bcrypt.hashSync(password, 10);
  }

  addLog(req.user.email, 'Edit User', 'Success', `Modified user: ${email} (${role}, ${status})`);

  res.json({
    message: 'User updated successfully.',
    users: db.users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, profile: u.profile })),
    auditLogs: db.auditLogs
  });
});

// 10. GET STUDENTS API (Faculty only)
// Allows teachers to retrieve a list of all students to choose who to fine
app.get('/api/dashboard/students', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Faculty') {
    return res.status(403).json({ error: 'Access denied. Only Faculty can access student rosters.' });
  }

  const students = db.users
    .filter(u => u.role === 'Student')
    .map(s => ({
      id: s.id,
      name: s.name,
      studentId: s.profile.studentId,
      major: s.profile.major
    }));

  res.json({ students });
});

// 11. POST FINE API (Faculty only)
// Issues a fine from the active teacher's faculty level
app.post('/api/dashboard/fines', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Faculty') {
    return res.status(403).json({ error: 'Access denied. Only Faculty can issue fines.' });
  }

  const { studentId, type, amount, details } = req.body;

  if (!studentId || !type || !amount) {
    return res.status(400).json({ error: 'Student, fine classification, and amount are required.' });
  }

  const student = db.users.find(u => u.role === 'Student' && u.profile.studentId === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student not found in database.' });
  }

  const teacher = req.user;
  const newFine = {
    id: `fin_${db.fines.length + 1}`,
    studentId: student.profile.studentId,
    studentName: student.name,
    facultyName: teacher.profile.facultyName,
    teacherName: teacher.name,
    type,
    amount: parseFloat(amount),
    details: details || 'No description provided.',
    date: new Date().toISOString(),
    datePaid: null,
    status: 'Unpaid'
  };

  db.fines.push(newFine);
  addLog(teacher.email, 'Fine Issued', 'Success', `Issued fine ${newFine.id} ($${amount}) to student ${student.name} (${studentId}) under Faculty of ${teacher.profile.facultyName}`);

  // Return fines issued by this specific Faculty member
  const finesIssued = db.fines.filter(f => f.teacherName === teacher.name);
  res.json({ message: 'Fine issued successfully.', fines: finesIssued });
});

// 12. PAY FINE API (Student only)
// Settle an outstanding fine and marks datePaid
app.post('/api/dashboard/fines/:id/pay', authenticateJWT, (req, res) => {
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: 'Access denied. Only Students can pay fines.' });
  }

  const fineId = req.params.id;
  const fine = db.fines.find(f => f.id === fineId && f.studentId === req.user.profile.studentId);

  if (!fine) {
    return res.status(404).json({ error: 'Fine record not found or access denied.' });
  }

  if (fine.status === 'Paid') {
    return res.status(400).json({ error: 'This fine has already been paid.' });
  }

  fine.status = 'Paid';
  fine.datePaid = new Date().toISOString();

  addLog(req.user.email, 'Fine Payment', 'Success', `Paid fine ${fine.id} ($${fine.amount}) issued by Faculty of ${fine.facultyName}`);

  const studentFines = db.fines.filter(f => f.studentId === req.user.profile.studentId);
  const outstandingFines = studentFines
    .filter(f => f.status === 'Unpaid')
    .reduce((sum, f) => sum + f.amount, 0);

  res.json({ 
    message: 'Fine paid successfully.', 
    fines: studentFines,
    outstandingFines 
  });
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
