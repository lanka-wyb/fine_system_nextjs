const mariadb = require('mariadb');
const bcrypt = require('bcryptjs');

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionLimit: 10,
  acquireTimeout: 10000
});

// Helper to safely execute a query on the pool
async function query(text, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    const res = await conn.query(text, params);
    return res;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// Safely parse JSON columns returned by MariaDB
function safeJsonParse(val) {
  if (val === null || val === undefined) return [];
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (e) {
    return [];
  }
}

// Database schema initialization & seeding
async function initDb() {
  console.log('Initializing database schema in MariaDB...');

  try {
    // 1. Create Faculties
    await query(`
      CREATE TABLE IF NOT EXISTS faculties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        dean_name VARCHAR(150),
        office_location VARCHAR(100)
      ) ENGINE=InnoDB;
    `);

    // 2. Create Users
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        failed_attempts INT DEFAULT 0,
        lock_until TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 3. Create Student Profiles
    await query(`
      CREATE TABLE IF NOT EXISTS student_profiles (
        student_id VARCHAR(50) PRIMARY KEY,
        user_id INT,
        faculty_id INT,
        gpa DECIMAL(3,2) DEFAULT 0.00,
        attendance INT DEFAULT 100,
        semester VARCHAR(50) DEFAULT 'Spring 2026',
        schedule JSON NULL,
        grades JSON NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 4. Create Teacher Profiles
    await query(`
      CREATE TABLE IF NOT EXISTS teacher_profiles (
        teacher_id VARCHAR(50) PRIMARY KEY,
        user_id INT,
        faculty_id INT,
        office VARCHAR(100),
        courses_taught JSON NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 5. Create Admin Profiles
    await query(`
      CREATE TABLE IF NOT EXISTS admin_profiles (
        admin_id VARCHAR(50) PRIMARY KEY,
        user_id INT,
        clearance_level VARCHAR(50) DEFAULT 'Admin',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 6. Create Fines
    await query(`
      CREATE TABLE IF NOT EXISTS fines (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(50),
        issued_by_teacher_id VARCHAR(50),
        faculty_id INT,
        type VARCHAR(100) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        reason TEXT,
        status VARCHAR(50) DEFAULT 'Unpaid',
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_date TIMESTAMP NULL DEFAULT NULL,
        receipt_code VARCHAR(100) NULL DEFAULT NULL,
        FOREIGN KEY (student_id) REFERENCES student_profiles(student_id) ON DELETE CASCADE,
        FOREIGN KEY (issued_by_teacher_id) REFERENCES teacher_profiles(teacher_id) ON DELETE CASCADE,
        FOREIGN KEY (faculty_id) REFERENCES faculties(id) ON DELETE SET NULL
      ) ENGINE=InnoDB;
    `);

    // 7. Create Payments
    await query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fine_id INT,
        amount_paid DECIMAL(10,2) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) DEFAULT 'Pending Approval',
        approved_by_admin_id VARCHAR(50) DEFAULT NULL,
        approval_date TIMESTAMP NULL DEFAULT NULL,
        FOREIGN KEY (fine_id) REFERENCES fines(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 8. Create Receipts
    await query(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        payment_id INT,
        receipt_code VARCHAR(100) UNIQUE NOT NULL,
        pdf_path VARCHAR(255),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 9. Create Audit Logs
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_email VARCHAR(150),
        action VARCHAR(100) NOT NULL,
        status VARCHAR(50),
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Seeding Check
    const facultyCount = await query('SELECT COUNT(*) as count FROM faculties');
    if (facultyCount[0].count === 0) {
      console.log('Seeding initial faculties...');
      await query(`
        INSERT INTO faculties (name, dean_name, office_location) VALUES
        ('Medicine', 'Dr. Gregory House', 'Clinic Lab A'),
        ('Management', 'Dr. Peter Drucker', 'Business Suite 10'),
        ('Science', 'Dr. Marie Curie', 'Science Hall 301'),
        ('Technology', 'Dr. Alan Turing', 'Turing Hall 401'),
        ('Agriculture', 'Dr. Norman Borlaug', 'Greenhouse 2'),
        ('Food Science', 'Dr. Louis Pasteur', 'Bio-Processing Lab')
      `);
    }

    const userCount = await query('SELECT COUNT(*) as count FROM users');
    if (userCount[0].count === 0) {
      console.log('Seeding initial user data...');

      const adminHash = bcrypt.hashSync('admin123', 10);
      const facultyHash = bcrypt.hashSync('faculty123', 10);
      const studentHash = bcrypt.hashSync('student123', 10);

      // 1. Seed System Admin
      const adminRes = await query(
        'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        ['System Administrator', 'admin@school.edu', adminHash, 'Admin', 'active']
      );
      await query(
        'INSERT INTO admin_profiles (admin_id, user_id, clearance_level) VALUES (?, ?, ?)',
        ['ADM-0001', Number(adminRes.insertId), 'SuperAdmin']
      );

      // 2. Seed Faculty Members
      const facultyData = [
        { name: 'Dr. Gregory House', email: 'medicine@school.edu', faculty_id: 'FAC-2026-2002', facultyName: 'Medicine', office: 'Clinic Lab A' },
        { name: 'Dr. Peter Drucker', email: 'management@school.edu', faculty_id: 'FAC-2026-3003', facultyName: 'Management', office: 'Business Suite 10' },
        { name: 'Dr. Marie Curie', email: 'science@school.edu', faculty_id: 'FAC-2026-4004', facultyName: 'Science', office: 'Science Hall 301' },
        { name: 'Dr. Alan Turing', email: 'teacher@school.edu', faculty_id: 'FAC-2026-1001', facultyName: 'Technology', office: 'Turing Hall 401' },
        { name: 'Dr. Norman Borlaug', email: 'agriculture@school.edu', faculty_id: 'FAC-2026-5005', facultyName: 'Agriculture', office: 'Greenhouse 2' },
        { name: 'Dr. Louis Pasteur', email: 'foodscience@school.edu', faculty_id: 'FAC-2026-6006', facultyName: 'Food Science', office: 'Bio-Processing Lab' }
      ];

      for (let fac of facultyData) {
        // Find DB faculty ID
        const facDb = await query('SELECT id FROM faculties WHERE name = ?', [fac.facultyName]);
        const facDbId = facDb[0].id;

        const uRes = await query(
          'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
          [fac.name, fac.email, facultyHash, 'Faculty', 'active']
        );
        
        let coursesTaught = [];
        if (fac.facultyName === 'Technology') {
          coursesTaught = ['CS 101', 'CS 302 (Algorithms)'];
        } else if (fac.facultyName === 'Medicine') {
          coursesTaught = ['MED 101 (Diagnostics)'];
        } else if (fac.facultyName === 'Management') {
          coursesTaught = ['MGT 205 (Org Behavior)'];
        } else if (fac.facultyName === 'Science') {
          coursesTaught = ['PHYS 101', 'CHEM 202'];
        }

        await query(
          'INSERT INTO teacher_profiles (teacher_id, user_id, faculty_id, office, courses_taught) VALUES (?, ?, ?, ?, ?)',
          [fac.faculty_id, Number(uRes.insertId), facDbId, fac.office, JSON.stringify(coursesTaught)]
        );
      }

      // 3. Seed Students
      const studentData = [
        {
          name: 'Emma Watson',
          email: 'student@school.edu',
          student_id: 'STU-2026-0042',
          facultyName: 'Science',
          gpa: 3.85,
          attendance: 94,
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
        },
        {
          name: 'John Doe',
          email: 'john@school.edu',
          student_id: 'STU-2026-0105',
          facultyName: 'Technology',
          gpa: 3.12,
          attendance: 88,
          schedule: [
            { code: 'CS 101', name: 'Intro to Computer Science', time: 'Mon/Wed 10:00 AM', room: 'Hall A' },
            { code: 'MATH 201', name: 'Calculus II', time: 'Tue/Thu 01:00 PM', room: 'Room 302' }
          ],
          grades: [
            { course: 'CS 101', code: 'CS 101', grade: 'B', score: 83 },
            { course: 'MATH 201', code: 'MATH 201', grade: 'B+', score: 87 }
          ]
        }
      ];

      for (let stu of studentData) {
        const facDb = await query('SELECT id FROM faculties WHERE name = ?', [stu.facultyName]);
        const facDbId = facDb[0].id;

        const uRes = await query(
          'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
          [stu.name, stu.email, studentHash, 'Student', 'active']
        );

        await query(
          'INSERT INTO student_profiles (student_id, user_id, faculty_id, gpa, attendance, semester, schedule, grades) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            stu.student_id,
            Number(uRes.insertId),
            facDbId,
            stu.gpa,
            stu.attendance,
            'Spring 2026',
            JSON.stringify(stu.schedule),
            JSON.stringify(stu.grades)
          ]
        );
      }

      // 4. Seed Fines
      // Seed Emma Watson fine
      const techTeacherDb = await query('SELECT teacher_id FROM teacher_profiles WHERE teacher_id = ?', ['FAC-2026-1001']);
      const techTeacherId = techTeacherDb[0].teacher_id;
      const techFacDb = await query('SELECT id FROM faculties WHERE name = ?', ['Technology']);
      const techFacId = techFacDb[0].id;

      await query(
        'INSERT INTO fines (student_id, issued_by_teacher_id, faculty_id, type, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['STU-2026-0042', techTeacherId, techFacId, 'Late Library Return', 120.00, 'Overdue textbook: Intro to Algorithms (3 weeks late)', 'Unpaid']
      );

      // Seed John Doe fine
      await query(
        'INSERT INTO fines (student_id, issued_by_teacher_id, faculty_id, type, amount, reason, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['STU-2026-0105', techTeacherId, techFacId, 'Equipment Damage', 15.00, 'Damaged lab mouse in computer lab 3', 'Unpaid']
      );

      console.log('Seeding completed successfully!');
    }

    console.log('Database initialization check completed.');
  } catch (err) {
    console.error('Error during database initialization:', err);
    throw err;
  }
}

// Perform DB check on pool load
initDb();

module.exports = {
  query,
  pool,
  safeJsonParse,
  initDb
};
