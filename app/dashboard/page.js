'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';

// Grade point mapping for GPA Simulator
const gradePoints = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0,
  'D': 1.0,  'F': 0.0
};

export default function DashboardPage() {
  const router = useRouter();

  // Loading and core data
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [data, setData] = useState(null);

  // Session timer (15 minutes = 900 seconds)
  const [sessionTime, setSessionTime] = useState(900);
  const timerRef = useRef(null);

  // --- Modals Toggle States ---
  const [activeModal, setActiveModal] = useState(null); // 'grade' | 'fine' | 'user-new' | 'user-edit'

  // Modal alert/errors
  const [modalAlert, setModalAlert] = useState({ show: false, message: '', type: 'danger' });

  // --- Form States ---
  // 1. Grade Edit Modal (Faculty)
  const [gradeStudentId, setGradeStudentId] = useState('');
  const [gradeStudentName, setGradeStudentName] = useState('');
  const [gradeCourseCode, setGradeCourseCode] = useState('');
  const [gradeScore, setGradeScore] = useState('');
  const [gradeLetter, setGradeLetter] = useState('A');

  // 2. Issue Fine Modal (Faculty)
  const [fineStudentId, setFineStudentId] = useState('');
  const [fineType, setFineType] = useState('Late Library Return');
  const [fineAmount, setFineAmount] = useState('');
  const [fineDetails, setFineDetails] = useState('');

  // 3. User Creation Modal (Admin)
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('Student');
  const [newUserFaculty, setNewUserFaculty] = useState('Science');
  const [newUserPassword, setNewUserPassword] = useState('');

  // 4. User Edit Modal (Admin)
  const [editUserId, setEditUserId] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserRole, setEditUserRole] = useState('Student');
  const [editUserFaculty, setEditUserFaculty] = useState('Science');
  const [editUserStatus, setEditUserStatus] = useState('active');
  const [editUserPassword, setEditUserPassword] = useState('');

  // --- GPA Simulator State ---
  const [calcRows, setCalcRows] = useState([]);
  const [simulatedGPA, setSimulatedGPA] = useState('0.00');

  // 1. Fetch user on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const body = await res.json();
        setUser(body.user);
        startSessionTimer();
        loadDashboardData();
      })
      .catch(() => {
        router.push('/');
      });

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router]);

  // Uptime/Sessions polling for Admin
  useEffect(() => {
    if (!data || data.role !== 'Admin') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/dashboard/data');
        if (res.ok) {
          const freshData = await res.json();
          setData(prev => ({
            ...prev,
            stats: freshData.stats,
            auditLogs: freshData.auditLogs
          }));
        }
      } catch (e) {}
    }, 5000);

    return () => clearInterval(interval);
  }, [data]);

  // Session timer decrement
  const startSessionTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setSessionTime(900);
    timerRef.current = setInterval(() => {
      setSessionTime(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleAutoLogout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  };

  const handleAutoLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    alert('Your session has expired for security reasons. Please log in again.');
    router.push('/');
  };

  const extendSession = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        startSessionTimer();
      } else {
        router.push('/');
      }
    } catch (err) {
      router.push('/');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const loadDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard/data');
      if (!res.ok) throw new Error();
      const body = await res.json();
      setData(body);
      
      // Seed GPA calculator if student
      if (body.role === 'Student' && body.profile) {
        const initialRows = body.profile.grades.map(g => ({
          course: g.course,
          code: g.code,
          gradeValue: gradePoints[g.grade] || 3.0,
          credits: 3,
          isLocked: true
        }));
        setCalcRows(initialRows);
      }
      
      setLoading(false);
    } catch (err) {
      alert('Error fetching portal database registry.');
      router.push('/');
    }
  };

  // --- GPA Calculator Simulator helper logic ---
  useEffect(() => {
    if (calcRows.length === 0) {
      setSimulatedGPA('0.00');
      return;
    }
    let totalPoints = 0;
    let totalCredits = 0;
    calcRows.forEach(row => {
      totalPoints += row.gradeValue * row.credits;
      totalCredits += row.credits;
    });
    setSimulatedGPA(totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00');
  }, [calcRows]);

  const addCalcRow = () => {
    setCalcRows([
      ...calcRows,
      { course: 'Simulated Course', code: 'SIM', gradeValue: 4.0, credits: 3, isLocked: false }
    ]);
  };

  const updateCalcRow = (index, field, value) => {
    const updated = [...calcRows];
    updated[index][field] = value;
    setCalcRows(updated);
  };

  const removeCalcRow = (index) => {
    setCalcRows(calcRows.filter((_, i) => i !== index));
  };

  // --- Client Side jsPDF Invoice Generator ---
  const downloadReceiptPDF = (fine) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    // 1. Branding Header
    doc.setFillColor(11, 15, 25);
    doc.rect(0, 0, 216, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text("Students' Fines/Dues Verification Receipt", 20, 25);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Student Information Portal payment confirmation record', 20, 32);

    // 2. Receipt metadata
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(`Receipt Reference: SIS-RCPT-${fine.receiptCode || 'NA'}-${fine.id}`, 20, 55);
    doc.text(`Issued Date: ${new Date(fine.date).toLocaleString()}`, 20, 61);
    doc.text(`Payment Date: ${fine.datePaid ? new Date(fine.datePaid).toLocaleString() : 'N/A'}`, 20, 67);

    // 3. Grid details
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, 75, 196, 75);

    // Student Information Block
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('STUDENT INFORMATION', 20, 85);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Full Name:  ${fine.studentName}`, 25, 93);
    doc.text(`Student ID: ${fine.studentId}`, 25, 99);

    // Fine Billing Block
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PENALTY BILLING DETAILS', 20, 115);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(`Originating Faculty:   Faculty of ${fine.facultyName}`, 25, 123);
    doc.text(`Issuing Instructor:   ${fine.teacherName}`, 25, 129);
    doc.text(`Classification:       ${fine.type}`, 25, 135);
    doc.text(`Reason/Details:       ${fine.reason}`, 25, 141);

    doc.line(20, 152, 196, 152);

    // 4. Large Watermark Stamp
    doc.setFontSize(48);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(220, 245, 230); // light mint green
    doc.text('PAID IN FULL', 50, 185, { angle: 15 });

    // 5. Total Settle Block
    doc.setTextColor(11, 15, 25);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('TRANSACTION SUMMARY', 20, 210);

    doc.setFillColor(245, 245, 248);
    doc.rect(20, 218, 176, 18, 'F');
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129); // Success green
    doc.text(`Total Settled Amount:  $${Number(fine.amount).toFixed(2)} USD`, 25, 230);

    // 6. Verification footnote
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'oblique');
    doc.text('This document verifies that the penalty has been officially cleared from student ledger registry records.', 20, 252);
    doc.text("No physical signature required. Verified electronically by Students' Fines/Dues Verification Registrar.", 20, 257);

    // Save
    doc.save(`Receipt_Fine_${fine.id}.pdf`);
  };

  // --- Student Pay Fine Action ---
  const handlePayFine = async (fineId) => {
    if (!confirm('Submit payment request to Administrator?')) return;
    try {
      const res = await fetch(`/api/dashboard/fines/${fineId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod: 'Credit Card' })
      });
      const body = await res.json();
      if (res.ok) {
        alert(body.message);
        loadDashboardData(); // Refresh UI
      } else {
        alert(body.error || 'Payment request failed.');
      }
    } catch (e) {
      alert('Network communication error.');
    }
  };

  // --- Faculty Grade Edit submit ---
  const handleGradeSubmit = async (e) => {
    e.preventDefault();
    setModalAlert({ show: false, message: '', type: 'danger' });

    try {
      const res = await fetch('/api/dashboard/grades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: gradeStudentId,
          courseCode: gradeCourseCode,
          newGrade: gradeLetter,
          newScore: gradeScore
        })
      });
      const body = await res.json();

      if (res.ok) {
        setActiveModal(null);
        loadDashboardData();
      } else {
        setModalAlert({ show: true, message: body.error || 'Failed to update grade.', type: 'danger' });
      }
    } catch (err) {
      setModalAlert({ show: true, message: 'Server connection error.', type: 'danger' });
    }
  };

  // --- Faculty Fine Issuance Submit ---
  const handleFineSubmit = async (e) => {
    e.preventDefault();
    setModalAlert({ show: false, message: '', type: 'danger' });

    if (!fineStudentId || !fineType || !fineAmount || !fineDetails) {
      setModalAlert({ show: true, message: 'All fields are required.', type: 'danger' });
      return;
    }

    try {
      const res = await fetch('/api/dashboard/fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: fineStudentId,
          type: fineType,
          amount: fineAmount,
          reason: fineDetails
        })
      });
      const body = await res.json();

      if (res.ok) {
        setActiveModal(null);
        loadDashboardData();
      } else {
        setModalAlert({ show: true, message: body.error || 'Failed to issue fine.', type: 'danger' });
      }
    } catch (err) {
      setModalAlert({ show: true, message: 'Server connection error.', type: 'danger' });
    }
  };

  // --- Admin Provision User Submit ---
  const handleUserNewSubmit = async (e) => {
    e.preventDefault();
    setModalAlert({ show: false, message: '', type: 'danger' });

    if (!newUserName || !newUserEmail || !newUserPassword) {
      setModalAlert({ show: true, message: 'Please fill in all fields.', type: 'danger' });
      return;
    }

    try {
      const res = await fetch('/api/dashboard/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          facultyName: newUserFaculty,
          password: newUserPassword
        })
      });
      const body = await res.json();

      if (res.ok) {
        setActiveModal(null);
        setData(prev => ({
          ...prev,
          users: body.users,
          auditLogs: body.auditLogs
        }));
      } else {
        setModalAlert({ show: true, message: body.error || 'Failed to create user.', type: 'danger' });
      }
    } catch (err) {
      setModalAlert({ show: true, message: 'Server connection error.', type: 'danger' });
    }
  };

  // --- Admin Edit User Submit ---
  const handleUserEditSubmit = async (e) => {
    e.preventDefault();
    setModalAlert({ show: false, message: '', type: 'danger' });

    try {
      const res = await fetch(`/api/dashboard/users/${editUserId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUserName,
          email: editUserEmail,
          role: editUserRole,
          status: editUserStatus,
          facultyName: editUserFaculty,
          password: editUserPassword
        })
      });
      const body = await res.json();

      if (res.ok) {
        setActiveModal(null);
        
        // If we updated ourselves, reload avatar/header
        if (editUserId === String(user.id)) {
          setUser(prev => ({
            ...prev,
            name: editUserName,
            email: editUserEmail
          }));
        }

        setData(prev => ({
          ...prev,
          users: body.users,
          auditLogs: body.auditLogs
        }));
        loadDashboardData(); // full stats reload
      } else {
        setModalAlert({ show: true, message: body.error || 'Failed to update user.', type: 'danger' });
      }
    } catch (err) {
      setModalAlert({ show: true, message: 'Server connection error.', type: 'danger' });
    }
  };

  // --- Admin Delete User Action ---
  const handleDeleteUser = async (userId, userEmail) => {
    if (!confirm(`Are you sure you want to permanently delete user account: ${userEmail}?`)) return;

    try {
      const res = await fetch(`/api/dashboard/users/${userId}`, { method: 'DELETE' });
      const body = await res.json();

      if (res.ok) {
        setData(prev => ({
          ...prev,
          users: body.users,
          auditLogs: body.auditLogs
        }));
        loadDashboardData(); // stats reload
      } else {
        alert(body.error || 'Failed to delete user.');
      }
    } catch (err) {
      alert('Network communication error.');
    }
  };

  // --- Admin Payment Permission/Approval Action ---
  const handleApprovePayment = async (fineId) => {
    if (!confirm('Give permission and approve this payment request?')) return;

    try {
      const res = await fetch(`/api/dashboard/payments/${fineId}/approve`, { method: 'POST' });
      const body = await res.json();

      if (res.ok) {
        alert('Payment request approved. Invoice receipt generated successfully.');
        setData(prev => ({
          ...prev,
          fines: body.fines,
          auditLogs: body.auditLogs,
          stats: body.stats
        }));
      } else {
        alert(body.error || 'Approval failed.');
      }
    } catch (err) {
      alert('Network communication error.');
    }
  };

  // Loading Screen
  if (loading) {
    return (
      <div id="dashboard-loading" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', flexDirection: 'column', gap: '20px' }}>
        <div className="logo-container" style={{ animation: 'pulse 1.5s infinite alternate' }}>
          <i className="bx bxs-graduation logo-icon"></i>
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 600 }}>Loading Dashboard...</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Querying MariaDB database registry</p>
      </div>
    );
  }

  const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="container-dashboard">
      
      {/* 1. Header Section */}
      <header className="dashboard-header glass-card">
        <div className="user-badge">
          <div className="user-avatar">{initials}</div>
          <div className="user-info-text">
            <h3>{user.name}</h3>
            <p>{user.email}</p>
          </div>
          <span className={`role-badge role-${user.role}`}>{user.role}</span>
        </div>

        <div className="header-actions">
          {/* Session Banner */}
          <div className="session-timer-banner" style={{ margin: 0, padding: '8px 12px' }}>
            <span>
              Session expires in:{' '}
              <strong>
                {Math.floor(sessionTime / 60).toString().padStart(2, '0')}:
                {(sessionTime % 60).toString().padStart(2, '0')}
              </strong>
            </span>
            <button onClick={extendSession} style={{ marginLeft: '10px' }}>Extend</button>
          </div>

          <button className="btn-logout" onClick={handleLogout}>
            <i className="bx bx-log-out" style={{ marginRight: '4px' }}></i> Log Out
          </button>
        </div>
      </header>

      {/* 2. STUDENT DASHBOARD VIEW */}
      {data.role === 'Student' && (
        <div id="student-view" className="db-grid">
          {/* Stat panel grid */}
          <div className="db-grid db-grid-4">
            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-blue"><i className="bx bx-wallet"></i></div>
              <div>
                <div className="stat-label">Outstanding Fines</div>
                <div className="stat-value" id="student-outstanding-fines">${Number(data.outstandingFines).toFixed(2)}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-green"><i className="bx bx-book-open"></i></div>
              <div>
                <div className="stat-label">Cumulative GPA</div>
                <div className="stat-value">{data.profile.gpa}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-purple"><i className="bx bx-user-check"></i></div>
              <div>
                <div className="stat-label">Class Attendance</div>
                <div className="stat-value">{data.profile.attendance}%</div>
                <div className="progress-track" style={{ width: '80px', marginTop: '6px' }}>
                  <div className="progress-fill" style={{ width: `${data.profile.attendance}%` }}></div>
                </div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-orange"><i className="bx bx-calendar-event"></i></div>
              <div>
                <div className="stat-label">Current Semester</div>
                <div className="stat-value" style={{ fontSize: '18px', marginTop: '8px' }}>{data.profile.semester}</div>
              </div>
            </div>
          </div>

          {/* Main Layout split */}
          <div className="db-grid db-grid-main">
            {/* Left Column: Courses & Fines */}
            <div className="db-grid" style={{ gap: '24px' }}>
              {/* Courses & Grades Card */}
              <div className="glass-card" style={{ padding: '30px' }}>
                <h2 className="section-title"><i className="bx bx-edit"></i> Registered Courses & Course Grades</h2>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Course Name</th>
                        <th>Schedule</th>
                        <th>Room</th>
                        <th>Score</th>
                        <th>Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.profile.grades.length === 0 ? (
                        <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No enrolled course records found.</td></tr>
                      ) : (
                        data.profile.schedule.map((course, idx) => {
                          const gr = data.profile.grades.find(g => g.code === course.code) || { score: '-', grade: '-' };
                          return (
                            <tr key={idx}>
                              <td><strong>{course.code}</strong></td>
                              <td>{course.name}</td>
                              <td>{course.time}</td>
                              <td>{course.room}</td>
                              <td>{gr.score}</td>
                              <td><span className="role-badge role-Student">{gr.grade}</span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Fines Table Card */}
              <div className="glass-card" style={{ padding: '30px' }}>
                <h2 className="section-title"><i className="bx bx-receipt"></i> Billed Fines & Penalties Registry</h2>
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Faculty Dept</th>
                        <th>Instructor</th>
                        <th>Fine Type</th>
                        <th>Reason Details</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.fines.length === 0 ? (
                        <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No fine records billed to your ledger.</td></tr>
                      ) : (
                        data.fines.map((fine, idx) => {
                          const isPaid = fine.status === 'Paid';
                          const isPending = fine.status === 'Pending Payment';
                          return (
                            <tr key={idx}>
                              <td><strong>{fine.id}</strong></td>
                              <td>{fine.facultyName}</td>
                              <td>{fine.teacherName}</td>
                              <td>{fine.type}</td>
                              <td>{fine.reason}</td>
                              <td>${Number(fine.amount).toFixed(2)}</td>
                              <td><span className={`status-${fine.status === 'Pending Payment' ? 'Pending' : fine.status}`}>{fine.status}</span></td>
                              <td>
                                {isPaid ? (
                                  <button className="action-btn" onClick={() => downloadReceiptPDF(fine)}>
                                    <i className="bx bxs-file-pdf"></i> Receipt
                                  </button>
                                ) : isPending ? (
                                  <span style={{ fontSize: '12px', color: 'var(--text-warning)' }}>Awaiting Approval</span>
                                ) : (
                                  <button className="action-btn" style={{ color: 'var(--text-success)' }} onClick={() => handlePayFine(fine.id)}>
                                    <i className="bx bx-check-double"></i> Pay Fine
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Column: GPA Simulator */}
            <div>
              <div className="glass-card" style={{ padding: '30px', position: 'sticky', top: '24px' }}>
                <h2 className="section-title"><i className="bx bx-calculator"></i> GPA Simulator</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                  Simulate grade alterations to estimate your cumulative GPA changes:
                </p>

                <div id="gpa-calc-rows" style={{ marginBottom: '20px' }}>
                  {calcRows.map((row, idx) => (
                    <div className="calc-row" key={idx}>
                      <span style={{ fontSize: '12px', alignSelf: 'center', flex: 1.5, color: row.isLocked ? 'var(--text-muted)' : 'var(--primary)' }}>
                        {row.isLocked && <i className="bx bxs-lock-alt" style={{ marginRight: '4px' }}></i>}
                        {row.course}
                      </span>
                      <select
                        className="calc-grade"
                        value={row.gradeValue}
                        onChange={(e) => updateCalcRow(idx, 'gradeValue', parseFloat(e.target.value))}
                        style={{ flex: 1.5 }}
                      >
                        {Object.keys(gradePoints).map(g => (
                          <option key={g} value={gradePoints[g]}>{g}</option>
                        ))}
                      </select>
                      <input
                        className="calc-credits"
                        type="number"
                        min="1"
                        max="5"
                        value={row.credits}
                        onChange={(e) => updateCalcRow(idx, 'credits', parseInt(e.target.value) || 0)}
                        style={{ flex: 1 }}
                        readOnly={row.isLocked}
                      />
                      {!row.isLocked ? (
                        <button className="action-btn action-btn-danger" style={{ flex: 0.5 }} onClick={() => removeCalcRow(idx)}>
                          <i className="bx bx-trash"></i>
                        </button>
                      ) : (
                        <div style={{ flex: 0.5 }}></div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '15px', borderTop: '1px solid var(--border-color)' }}>
                  <div>
                    <div className="stat-label">Projected GPA</div>
                    <div className="stat-value" id="simulated-gpa-val" style={{ color: 'var(--primary)' }}>{simulatedGPA}</div>
                  </div>
                  <button className="btn btn-secondary" style={{ width: 'auto', marginTop: 0, padding: '8px 16px' }} onClick={addCalcRow}>
                    <i className="bx bx-plus"></i> Course
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. FACULTY DASHBOARD VIEW */}
      {data.role === 'Faculty' && (
        <div id="faculty-view" className="db-grid">
          {/* Stats */}
          <div className="db-grid db-grid-3">
            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-blue"><i className="bx bx-buildings"></i></div>
              <div>
                <div className="stat-label">Assigned Office</div>
                <div className="stat-value" style={{ fontSize: '18px' }} id="faculty-office">{data.profile.office}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-purple"><i className="bx bx-network-chart"></i></div>
              <div>
                <div className="stat-label">Department</div>
                <div className="stat-value" style={{ fontSize: '18px' }} id="faculty-dept">Faculty of {data.profile.facultyName}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-green"><i className="bx bx-group"></i></div>
              <div>
                <div className="stat-label">Enrolled Students</div>
                <div className="stat-value" id="faculty-student-count">{data.students?.length || 0}</div>
              </div>
            </div>
          </div>

          {/* Roster & Grade Editing */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <h2 className="section-title"><i className="bx bx-group"></i> Department Student Roster & Academic Grades</h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student ID</th>
                    <th>Full Name</th>
                    <th>Course Code</th>
                    <th>Score</th>
                    <th>Grade</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!data.students || data.students.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student records found in your department.</td></tr>
                  ) : (
                    data.students.map((student, idx) => {
                      // Find course grade details
                      return (
                        <tr key={idx}>
                          <td><strong>{student.studentId}</strong></td>
                          <td>{student.name}</td>
                          <td>CS 101</td>
                          <td>85</td>
                          <td><span className="role-badge role-Faculty">B</span></td>
                          <td>
                            <button
                              className="action-btn"
                              onClick={() => {
                                setGradeStudentId(student.studentId);
                                setGradeStudentName(student.name);
                                setGradeCourseCode('CS 101');
                                setGradeScore('85');
                                setGradeLetter('B');
                                setModalAlert({ show: false, message: '', type: 'danger' });
                                setActiveModal('grade');
                              }}
                            >
                              <i className="bx bx-edit-alt"></i> Edit Grade
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Issued Fines list */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ margin: 0 }}><i className="bx bx-money-withdraw"></i> Fines Billed by You</h2>
              <button className="btn btn-primary" id="faculty-issue-fine-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => {
                setFineStudentId(data.students && data.students.length > 0 ? data.students[0].studentId : '');
                setFineType('Late Library Return');
                setFineAmount('');
                setFineDetails('');
                setModalAlert({ show: false, message: '', type: 'danger' });
                setActiveModal('fine');
              }}>
                <i className="bx bx-plus-circle"></i> Issue Fine
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fine ID</th>
                    <th>Student Name</th>
                    <th>Student ID</th>
                    <th>Fine Type</th>
                    <th>Reason details</th>
                    <th>Amount</th>
                    <th>Billed Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fines.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>You have not billed any student fines.</td></tr>
                  ) : (
                    data.fines.map((fine, idx) => (
                      <tr key={idx}>
                        <td><strong>{fine.id}</strong></td>
                        <td>{fine.studentName}</td>
                        <td>{fine.studentId}</td>
                        <td>{fine.type}</td>
                        <td>{fine.reason}</td>
                        <td>${Number(fine.amount).toFixed(2)}</td>
                        <td>{new Date(fine.date).toLocaleDateString()}</td>
                        <td><span className={`status-${fine.status === 'Pending Payment' ? 'Pending' : fine.status}`}>{fine.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. ADMIN DASHBOARD VIEW */}
      {data.role === 'Admin' && (
        <div id="admin-view" className="db-grid">
          {/* Stats grid */}
          <div className="db-grid db-grid-3">
            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-blue"><i className="bx bx-user"></i></div>
              <div>
                <div className="stat-label">Total Users</div>
                <div className="stat-value" id="admin-total-users">{data.users.length}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-purple"><i className="bx bx-plug"></i></div>
              <div>
                <div className="stat-label">Active Sessions</div>
                <div className="stat-value" id="admin-active-sessions">{data.stats.activeSessions}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-green"><i className="bx bx-server"></i></div>
              <div>
                <div className="stat-label">System Uptime</div>
                <div className="stat-value" id="admin-uptime">{data.stats.uptime}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-orange"><i className="bx bx-money"></i></div>
              <div>
                <div className="stat-label">Billed Outstanding Fines</div>
                <div className="stat-value" id="admin-outstanding-fines-val">${data.stats.totalOutstandingFines.toFixed(2)}</div>
              </div>
            </div>

            <div className="stat-card glass-card">
              <div className="stat-icon stat-icon-green"><i className="bx bx-checkbox-checked"></i></div>
              <div>
                <div className="stat-label">Collected Payments</div>
                <div className="stat-value" id="admin-collected-fines-val">${data.stats.totalPaidFines.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* User Administration */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 className="section-title" style={{ margin: 0 }}><i className="bx bx-shield-quarter"></i> Portal User Administration Directory</h2>
              <button className="btn btn-primary" id="admin-add-user-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => {
                setNewUserName('');
                setNewUserEmail('');
                setNewUserRole('Student');
                setNewUserFaculty('Science');
                setNewUserPassword('');
                setModalAlert({ show: false, message: '', type: 'danger' });
                setActiveModal('user-new');
              }}>
                <i className="bx bx-user-plus"></i> Provision User
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>UID</th>
                    <th>Name</th>
                    <th>Email Address</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u, idx) => {
                    const isSelf = String(u.id) === String(user.id);
                    return (
                      <tr key={idx}>
                        <td><strong>{u.id}</strong></td>
                        <td>{u.name} {isSelf && <small style={{ color: 'var(--text-success)' }}>(You)</small>}</td>
                        <td>{u.email}</td>
                        <td><span className={`role-badge role-${u.role}`}>{u.role}</span></td>
                        <td>
                          <span style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: u.status === 'active' ? 'var(--text-success)' : 'var(--text-danger)' }}>
                            <i className="bx bxs-circle" style={{ fontSize: '8px' }}></i> {u.status}
                          </span>
                        </td>
                        <td>
                          <button
                            className="action-btn"
                            style={{ marginRight: '8px' }}
                            onClick={() => {
                              setEditUserId(u.id);
                              setEditUserName(u.name);
                              setEditUserEmail(u.email);
                              setEditUserRole(u.role);
                              setEditUserStatus(u.status);
                              setEditUserFaculty(u.profile?.major || u.profile?.facultyName || 'Science');
                              setEditUserPassword('');
                              setModalAlert({ show: false, message: '', type: 'danger' });
                              setActiveModal('user-edit');
                            }}
                          >
                            <i className="bx bx-edit-alt"></i> Edit
                          </button>
                          {!isSelf && (
                            <button className="action-btn action-btn-danger" onClick={() => handleDeleteUser(u.id, u.email)}>
                              <i className="bx bx-trash"></i> Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Registry & Payment Approval */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <h2 className="section-title"><i className="bx bx-coin-stack"></i> Financial Registry & Payment Approval Audits</h2>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fine ID</th>
                    <th>Student Name</th>
                    <th>Faculty Dept</th>
                    <th>Instructor</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Billed Date</th>
                    <th>Status</th>
                    <th>Audit Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.fines.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No student fines recorded in the system database.</td></tr>
                  ) : (
                    data.fines.map((fine, idx) => {
                      const isPaid = fine.status === 'Paid';
                      const isPending = fine.status === 'Pending Payment';
                      return (
                        <tr key={idx}>
                          <td><strong>{fine.id}</strong></td>
                          <td>{fine.studentName} <small style={{ display: 'block', color: 'var(--text-muted)' }}>{fine.studentId}</small></td>
                          <td>{fine.facultyName}</td>
                          <td>{fine.teacherName}</td>
                          <td>{fine.type}</td>
                          <td>${Number(fine.amount).toFixed(2)}</td>
                          <td>{new Date(fine.date).toLocaleDateString()}</td>
                          <td><span className={`status-${fine.status === 'Pending Payment' ? 'Pending' : fine.status}`}>{fine.status}</span></td>
                          <td>
                            {isPaid ? (
                              <button className="action-btn" onClick={() => downloadReceiptPDF(fine)}>
                                <i className="bx bxs-file-pdf"></i> Receipt
                              </button>
                            ) : isPending ? (
                              <button className="action-btn" style={{ color: 'var(--text-success)' }} onClick={() => handleApprovePayment(fine.id)}>
                                <i className="bx bx-check"></i> Verify & Approve
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No Payment</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit log Console */}
          <div className="glass-card" style={{ padding: '30px' }}>
            <h2 className="section-title"><i className="bx bx-terminal"></i> Real-time System Audit Console Logs</h2>
            <div className="admin-log-box" id="admin-logs-console">
              {data.auditLogs.map((log, idx) => {
                const dateStr = new Date(log.timestamp).toLocaleTimeString();
                return (
                  <div key={idx} className={`log-entry log-entry-${log.status === 'Locked' ? 'Locked' : log.status}`}>
                    [{dateStr}] <strong>{log.user}</strong>: {log.action} |{' '}
                    <span style={{ fontWeight: 600 }}>{log.status}</span> - {log.details}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ======================= REACT MODALS OVERLAYS =========================== */}
      {/* ========================================================================= */}

      {/* 1. Grade Edit Modal */}
      {activeModal === 'grade' && (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && setActiveModal(null)}>
          <div className="modal-content glass-card">
            <button className="modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            <h2 className="section-title" style={{ marginBottom: '24px' }}><i className="bx bx-edit"></i> Edit Student Grade</h2>
            
            {modalAlert.show && (
              <div className={`alert alert-${modalAlert.type}`}>
                <i className="bx bx-error-circle"></i>
                <span>{modalAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleGradeSubmit}>
              <div className="form-group">
                <label className="form-label">Student Name</label>
                <input className="form-input" type="text" value={gradeStudentName} readOnly style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Course Code</label>
                <input className="form-input" type="text" value={gradeCourseCode} readOnly style={{ color: 'var(--text-muted)' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Score (0-100)</label>
                <input className="form-input" type="number" min="0" max="100" value={gradeScore} onChange={(e) => setGradeScore(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Letter Grade</label>
                <select className="form-input" style={{ backgroundColor: '#0b0f19' }} value={gradeLetter} onChange={(e) => setGradeLetter(e.target.value)} required>
                  {Object.keys(gradePoints).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                <span>Save Changes</span>
                <i className="bx bx-save"></i>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Issue Fine Modal */}
      {activeModal === 'fine' && (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && setActiveModal(null)}>
          <div className="modal-content glass-card">
            <button className="modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            <h2 className="section-title" style={{ marginBottom: '24px' }}><i className="bx bx-money-withdraw"></i> Issue Student Fine</h2>
            
            {modalAlert.show && (
              <div className={`alert alert-${modalAlert.type}`}>
                <i className="bx bx-error-circle"></i>
                <span>{modalAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleFineSubmit}>
              <div className="form-group">
                <label className="form-label">Target Student</label>
                <select className="form-input" style={{ backgroundColor: '#0b0f19' }} value={fineStudentId} onChange={(e) => setFineStudentId(e.target.value)} required>
                  <option value="">Select target student...</option>
                  {data.students && data.students.map((s, idx) => (
                    <option key={idx} value={s.studentId}>{s.name} ({s.studentId})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fine Classification</label>
                <select className="form-input" style={{ backgroundColor: '#0b0f19' }} value={fineType} onChange={(e) => setFineType(e.target.value)} required>
                  <option value="Late Library Return">Late Library Return</option>
                  <option value="Laboratory Damage">Laboratory Damage</option>
                  <option value="Equipment Damage">Equipment Damage</option>
                  <option value="Late Course Registration">Late Course Registration</option>
                  <option value="ID Card Replacement">ID Card Replacement Fee</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Billing Amount ($ USD)</label>
                <input className="form-input" type="number" step="0.01" min="1.00" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} placeholder="0.00" required />
              </div>
              <div className="form-group">
                <label className="form-label">Fine Reason & Details</label>
                <textarea className="form-input" rows="3" style={{ height: 'auto', paddingLeft: '16px' }} value={fineDetails} onChange={(e) => setFineDetails(e.target.value)} placeholder="Provide context details..." required></textarea>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                <span>Issue Penalty</span>
                <i className="bx bx-plus-circle"></i>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Provision User Modal */}
      {activeModal === 'user-new' && (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && setActiveModal(null)}>
          <div className="modal-content glass-card">
            <button className="modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            <h2 className="section-title" style={{ marginBottom: '24px' }}><i className="bx bx-user-plus"></i> Provision New User</h2>
            
            {modalAlert.show && (
              <div className={`alert alert-${modalAlert.type}`}>
                <i className="bx bx-error-circle"></i>
                <span>{modalAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleUserNewSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" style={{ paddingLeft: '16px' }} type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" style={{ paddingLeft: '16px' }} type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="email@school.edu" required />
              </div>
              <div className="form-group">
                <label className="form-label">System Role</label>
                <select className="form-input" style={{ backgroundColor: '#0b0f19', paddingLeft: '16px' }} value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} required>
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {(newUserRole === 'Student' || newUserRole === 'Faculty') && (
                <div className="form-group">
                  <label className="form-label">Assigned Department</label>
                  <select className="form-input" style={{ backgroundColor: '#0b0f19', paddingLeft: '16px' }} value={newUserFaculty} onChange={(e) => setNewUserFaculty(e.target.value)} required>
                    <option value="Medicine">Medicine</option>
                    <option value="Management">Management</option>
                    <option value="Science">Science</option>
                    <option value="Technology">Technology</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Food Science">Food Science</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Password</label>
                <input className="form-input" style={{ paddingLeft: '16px' }} type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                <span>Provision User</span>
                <i className="bx bx-plus-circle"></i>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Edit User Modal */}
      {activeModal === 'user-edit' && (
        <div className="modal-overlay active" onClick={(e) => e.target.classList.contains('modal-overlay') && setActiveModal(null)}>
          <div className="modal-content glass-card">
            <button className="modal-close" onClick={() => setActiveModal(null)}>&times;</button>
            <h2 className="section-title" style={{ marginBottom: '24px' }}><i className="bx bx-edit"></i> Edit User Account</h2>
            
            {modalAlert.show && (
              <div className={`alert alert-${modalAlert.type}`}>
                <i className="bx bx-error-circle"></i>
                <span>{modalAlert.message}</span>
              </div>
            )}

            <form onSubmit={handleUserEditSubmit}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" style={{ paddingLeft: '16px' }} type="text" value={editUserName} onChange={(e) => setEditUserName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" style={{ paddingLeft: '16px' }} type="email" value={editUserEmail} onChange={(e) => setEditUserEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">System Role</label>
                <select
                  className="form-input"
                  style={{ backgroundColor: '#0b0f19', paddingLeft: '16px' }}
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value)}
                  disabled={editUserId === String(user.id)}
                  required
                >
                  <option value="Student">Student</option>
                  <option value="Faculty">Faculty</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {(editUserRole === 'Student' || editUserRole === 'Faculty') && (
                <div className="form-group">
                  <label className="form-label">Assigned Department</label>
                  <select className="form-input" style={{ backgroundColor: '#0b0f19', paddingLeft: '16px' }} value={editUserFaculty} onChange={(e) => setEditUserFaculty(e.target.value)} required>
                    <option value="Medicine">Medicine</option>
                    <option value="Management">Management</option>
                    <option value="Science">Science</option>
                    <option value="Technology">Technology</option>
                    <option value="Agriculture">Agriculture</option>
                    <option value="Food Science">Food Science</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Account Status</label>
                <select
                  className="form-input"
                  style={{ backgroundColor: '#0b0f19', paddingLeft: '16px' }}
                  value={editUserStatus}
                  onChange={(e) => setEditUserStatus(e.target.value)}
                  disabled={editUserId === String(user.id)}
                  required
                >
                  <option value="active">Active</option>
                  <option value="locked">Locked Out</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">New Password (leave blank to keep current)</label>
                <input className="form-input" style={{ paddingLeft: '16px' }} type="password" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: '10px' }}>
                <span>Save Changes</span>
                <i className="bx bx-save"></i>
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
