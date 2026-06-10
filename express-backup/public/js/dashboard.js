document.addEventListener('DOMContentLoaded', () => {
  // Common Elements
  const loadingEl = document.getElementById('dashboard-loading');
  const logoutBtn = document.getElementById('logout-btn');
  const headerAvatar = document.getElementById('header-avatar');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserRole = document.getElementById('header-user-role');
  const headerUserEmail = document.getElementById('header-user-email');

  // Session timer elements
  const sessionBanner = document.getElementById('session-banner');
  const sessionTimerCount = document.getElementById('session-timer-count');
  const extendSessionBtn = document.getElementById('extend-session-btn');

  // Roles views
  const studentView = document.getElementById('student-view');
  const facultyView = document.getElementById('faculty-view');
  const adminView = document.getElementById('admin-view');

  // Modals
  const gradeModal = document.getElementById('grade-modal');
  const gradeModalClose = document.getElementById('grade-modal-close');
  const gradeModalForm = document.getElementById('grade-modal-form');
  const gradeModalAlert = document.getElementById('grade-modal-alert');
  const gradeModalErrorMsg = document.getElementById('grade-modal-error-msg');

  const userModal = document.getElementById('user-modal');
  const userModalClose = document.getElementById('user-modal-close');
  const userModalForm = document.getElementById('user-modal-form');
  const userModalAlert = document.getElementById('user-modal-alert');
  const userModalErrorMsg = document.getElementById('user-modal-error-msg');

  // Edit User Modal Elements
  const editUserModal = document.getElementById('edit-user-modal');
  const editUserModalClose = document.getElementById('edit-user-modal-close');
  const editUserModalForm = document.getElementById('edit-user-modal-form');
  const editUserModalAlert = document.getElementById('edit-user-modal-alert');
  const editUserModalErrorMsg = document.getElementById('edit-user-modal-error-msg');
  const adminEditRole = document.getElementById('admin-edit-role');
  const adminEditFacultyWrapper = document.getElementById('admin-edit-faculty-wrapper');

  // New Fine Modal Elements
  const fineModal = document.getElementById('fine-modal');
  const fineModalClose = document.getElementById('fine-modal-close');
  const fineModalForm = document.getElementById('fine-modal-form');
  const fineModalAlert = document.getElementById('fine-modal-alert');
  const fineModalErrorMsg = document.getElementById('fine-modal-error-msg');
  const fineStudentSelect = document.getElementById('fine-student-select');

  // Global Session State
  let sessionTimeoutSeconds = 900; // 15 minutes JWT life
  let timerInterval = null;
  let currentUser = null;
  let adminRefreshInterval = null;

  // Grade point mapping
  const gradePoints = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0,
    'D': 1.0,  'F': 0.0
  };

  // Initialize Auth Check
  checkAuth();

  // Hide/Show Assigned Department for Admin creation modal
  const adminNewRole = document.getElementById('admin-new-role');
  const adminNewFacultyWrapper = document.getElementById('admin-new-faculty-wrapper');
  if (adminNewRole && adminNewFacultyWrapper) {
    adminNewRole.addEventListener('change', () => {
      if (adminNewRole.value === 'Faculty' || adminNewRole.value === 'Student') {
        adminNewFacultyWrapper.classList.remove('hide');
      } else {
        adminNewFacultyWrapper.classList.add('hide');
      }
    });
  }

  // Hide/Show Assigned Department for Admin edit modal
  if (adminEditRole && adminEditFacultyWrapper) {
    adminEditRole.addEventListener('change', () => {
      if (adminEditRole.value === 'Faculty' || adminEditRole.value === 'Student') {
        adminEditFacultyWrapper.classList.remove('hide');
      } else {
        adminEditFacultyWrapper.classList.add('hide');
      }
    });
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        throw new Error('Unauthorized');
      }
      const data = await res.json();
      currentUser = data.user;
      
      setupHeader(currentUser);
      startSessionTimer();
      loadDashboardData();
    } catch (err) {
      window.location.href = 'index.html';
    }
  }

  function setupHeader(user) {
    const initials = user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    headerAvatar.textContent = initials;
    headerUserName.textContent = user.name;
    headerUserEmail.textContent = user.email;
    headerUserRole.textContent = user.role;
    headerUserRole.className = `role-badge role-${user.role}`;
  }

  // Session Timeout Logic
  function startSessionTimer() {
    if (timerInterval) clearInterval(timerInterval);
    sessionTimeoutSeconds = 900;
    sessionBanner.classList.remove('hide');

    timerInterval = setInterval(() => {
      sessionTimeoutSeconds--;

      const mins = Math.floor(sessionTimeoutSeconds / 60);
      const secs = sessionTimeoutSeconds % 60;
      sessionTimerCount.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

      if (sessionTimeoutSeconds < 120) {
        sessionBanner.style.background = 'rgba(244, 63, 94, 0.2)';
        sessionBanner.style.borderColor = 'rgba(244, 63, 94, 0.4)';
        sessionBanner.style.color = 'var(--text-danger)';
      } else {
        sessionBanner.removeAttribute('style');
      }

      if (sessionTimeoutSeconds <= 0) {
        clearInterval(timerInterval);
        handleAutoLogout();
      }
    }, 1000);
  }

  async function handleAutoLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    alert('Your session has expired for security reasons. Please log in again.');
    window.location.href = 'index.html';
  }

  extendSessionBtn.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        startSessionTimer();
      } else {
        window.location.href = 'index.html';
      }
    } catch (err) {
      window.location.href = 'index.html';
    }
  });

  // Load Dashboard Data
  async function loadDashboardData() {
    try {
      const res = await fetch('/api/dashboard/data');
      if (!res.ok) throw new Error('Failed to load dashboard.');
      
      const data = await res.json();
      loadingEl.classList.add('hide');

      if (data.role === 'Student') {
        renderStudentDashboard(data);
      } else if (data.role === 'Faculty') {
        renderFacultyDashboard(data);
      } else if (data.role === 'Admin') {
        renderAdminDashboard(data);
        if (adminRefreshInterval) clearInterval(adminRefreshInterval);
        adminRefreshInterval = setInterval(refreshAdminStats, 5000);
      }
    } catch (err) {
      console.error(err);
      alert('Error fetching student portal data.');
    }
  }

  // --- Student View ---
  function renderStudentDashboard(data) {
    studentView.classList.remove('hide');
    document.getElementById('student-gpa').textContent = data.profile.gpa;
    document.getElementById('student-attendance-percent').textContent = `${data.profile.attendance}%`;
    document.getElementById('student-attendance-bar').style.width = `${data.profile.attendance}%`;
    document.getElementById('student-semester').textContent = data.profile.semester;

    // Display Outstanding Fines Card
    document.getElementById('student-outstanding-fines').textContent = `$${data.outstandingFines.toFixed(2)}`;

    // Render Enrolled Courses
    const coursesTable = document.getElementById('student-courses-table');
    coursesTable.innerHTML = '';
    if (data.profile.grades.length === 0) {
      coursesTable.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No registered course records.</td></tr>';
    } else {
      data.profile.schedule.forEach(course => {
        const gradeRecord = data.profile.grades.find(g => g.code === course.code) || { score: '-', grade: '-' };
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${course.code}</strong></td>
          <td>${course.name}</td>
          <td>${course.time}</td>
          <td>${course.room}</td>
          <td>${gradeRecord.score}</td>
          <td><span class="role-badge role-Student">${gradeRecord.grade}</span></td>
        `;
        coursesTable.appendChild(row);
      });
    }

    // Render Fines Table
    const finesTable = document.getElementById('student-fines-table');
    finesTable.innerHTML = '';
    if (data.fines.length === 0) {
      finesTable.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted)">No fines billed to your account.</td></tr>';
    } else {
      data.fines.forEach(fine => {
        const row = document.createElement('tr');
        const isPaid = fine.status === 'Paid';
        
        row.innerHTML = `
          <td><strong>${fine.id.toUpperCase()}</strong></td>
          <td>${fine.facultyName}</td>
          <td>${fine.teacherName}</td>
          <td>${fine.type}</td>
          <td>${fine.details}</td>
          <td>$${fine.amount.toFixed(2)}</td>
          <td><span class="status-${fine.status}">${fine.status}</span></td>
          <td>
            ${isPaid 
              ? `<button class="action-btn download-receipt-btn" data-id="${fine.id}"><i class="bx bxs-file-pdf"></i> Receipt</button>` 
              : `<button class="action-btn pay-fine-btn" style="color: var(--text-success)" data-id="${fine.id}"><i class="bx bx-check-double"></i> Pay Fine</button>`}
          </td>
        `;
        finesTable.appendChild(row);
      });

      // Bind dynamic actions
      finesTable.querySelectorAll('.pay-fine-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const fineId = btn.getAttribute('data-id');
          await payFine(fineId);
        });
      });

      finesTable.querySelectorAll('.download-receipt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const fineId = btn.getAttribute('data-id');
          const fine = data.fines.find(f => f.id === fineId);
          if (fine) downloadReceiptPDF(fine);
        });
      });
    }

    // Initialize GPA Simulator with Student's existing grades
    setupGPASimulator(data.profile.grades);
  }

  async function payFine(fineId) {
    if (!confirm('Settle payment for this fine?')) return;
    try {
      const res = await fetch(`/api/dashboard/fines/${fineId}/pay`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('Payment processed successfully!');
        loadDashboardData(); // Refresh UI
      } else {
        alert(data.error || 'Payment failed.');
      }
    } catch (e) {
      alert('Communications error.');
    }
  }


  // --- Faculty View ---
  function renderFacultyDashboard(data) {
    facultyView.classList.remove('hide');
    document.getElementById('faculty-office').textContent = data.profile.office;
    document.getElementById('faculty-dept').textContent = `Faculty of ${data.profile.facultyName}`;
    document.getElementById('faculty-student-count').textContent = data.profile.students.length;

    // Render roster table
    const rosterBody = document.getElementById('faculty-roster-table');
    rosterBody.innerHTML = '';
    if (data.profile.students.length === 0) {
      rosterBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted)">No students enrolled in your classes.</td></tr>';
    } else {
      data.profile.students.forEach(student => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>${student.studentId}</strong></td>
          <td>${student.name}</td>
          <td>${student.course}</td>
          <td>${student.score}</td>
          <td><span class="role-badge role-Faculty">${student.grade}</span></td>
          <td>
            <button class="action-btn edit-grade-trigger" 
              data-id="${student.id}" 
              data-studentid="${student.studentId}" 
              data-name="${student.name}" 
              data-course="${student.course}" 
              data-score="${student.score}" 
              data-grade="${student.grade}">
              <i class='bx bx-edit-alt'></i> Edit Grade
            </button>
          </td>
        `;
        rosterBody.appendChild(row);
      });

      document.querySelectorAll('.edit-grade-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('grade-student-id').value = btn.getAttribute('data-studentid');
          document.getElementById('grade-course-code').value = btn.getAttribute('data-course');
          document.getElementById('grade-student-name').value = btn.getAttribute('data-name');
          document.getElementById('grade-course-name').value = btn.getAttribute('data-course');
          document.getElementById('grade-score-input').value = btn.getAttribute('data-score');
          document.getElementById('grade-letter-input').value = btn.getAttribute('data-grade');
          gradeModalAlert.classList.add('hide');
          gradeModal.classList.add('active');
        });
      });
    }

    // Render Fines Issued by You
    const facultyFinesTable = document.getElementById('faculty-issued-fines-table');
    facultyFinesTable.innerHTML = '';
    if (data.fines.length === 0) {
      facultyFinesTable.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--text-muted)">You have not issued any student fines.</td></tr>';
    } else {
      data.fines.forEach(fine => {
        const row = document.createElement('tr');
        const formattedDate = new Date(fine.date).toLocaleDateString();
        row.innerHTML = `
          <td><strong>${fine.id.toUpperCase()}</strong></td>
          <td>${fine.studentName}</td>
          <td>${fine.studentId}</td>
          <td>${fine.type}</td>
          <td>${fine.details}</td>
          <td>$${fine.amount.toFixed(2)}</td>
          <td>${formattedDate}</td>
          <td><span class="status-${fine.status}">${fine.status}</span></td>
        `;
        facultyFinesTable.appendChild(row);
      });
    }

    // Bind Fine Modal triggers
    document.getElementById('faculty-issue-fine-btn').onclick = async () => {
      fineModalAlert.classList.add('hide');
      fineModalForm.reset();
      
      // Load Students list for dropdown
      fineStudentSelect.innerHTML = '<option value="">Loading students...</option>';
      try {
        const res = await fetch('/api/dashboard/students');
        const studentData = await res.json();
        if (res.ok) {
          fineStudentSelect.innerHTML = '<option value="">Select target student...</option>';
          studentData.students.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.studentId;
            opt.textContent = `${s.name} (${s.studentId}) - Major: ${s.major}`;
            fineStudentSelect.appendChild(opt);
          });
          fineModal.classList.add('active');
        } else {
          alert('Could not fetch student roster.');
        }
      } catch (err) {
        alert('Communications error loading students.');
      }
    };
  }

  // Issue Fine Modal Form Submission
  fineModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    fineModalAlert.classList.add('hide');

    const studentId = document.getElementById('fine-student-select').value;
    const type = document.getElementById('fine-type-select').value;
    const amount = document.getElementById('fine-amount-input').value;
    const details = document.getElementById('fine-details-input').value.trim();

    if (!studentId || !type || !amount) {
      fineModalErrorMsg.textContent = 'Please fill in all fine details.';
      fineModalAlert.classList.remove('hide');
      return;
    }

    try {
      const res = await fetch('/api/dashboard/fines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, type, amount, details })
      });
      const data = await res.json();

      if (res.ok) {
        fineModal.classList.remove('active');
        // Refresh local dashboard data
        renderFacultyDashboard({ profile: currentUser.profile, fines: data.fines });
        loadDashboardData(); // Full refresh background
      } else {
        fineModalErrorMsg.textContent = data.error || 'Failed to issue fine.';
        fineModalAlert.classList.remove('hide');
      }
    } catch (err) {
      fineModalErrorMsg.textContent = 'Server communications error.';
      fineModalAlert.classList.remove('hide');
    }
  });

  fineModalClose.addEventListener('click', () => fineModal.classList.remove('active'));


  // --- Admin View ---
  function renderAdminDashboard(data) {
    adminView.classList.remove('hide');
    document.getElementById('admin-total-users').textContent = data.users.length;
    document.getElementById('admin-active-sessions').textContent = data.stats.activeSessions;
    document.getElementById('admin-uptime').textContent = data.stats.uptime;

    // Financial Cards
    document.getElementById('admin-outstanding-fines-val').textContent = `$${data.stats.totalOutstandingFines.toFixed(2)}`;
    document.getElementById('admin-collected-fines-val').textContent = `$${data.stats.totalPaidFines.toFixed(2)}`;

    // Render Users Table
    renderAdminUsersTable(data.users);

    // Render Audit Logs
    renderAdminLogs(data.auditLogs);

    // Render All Fines (Auditing) Table
    const adminFinesTable = document.getElementById('admin-fines-table');
    adminFinesTable.innerHTML = '';
    if (data.fines.length === 0) {
      adminFinesTable.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted)">No student fines are stored in the system registry.</td></tr>';
    } else {
      data.fines.forEach(fine => {
        const row = document.createElement('tr');
        const isPaid = fine.status === 'Paid';
        row.innerHTML = `
          <td><strong>${fine.id.toUpperCase()}</strong></td>
          <td>${fine.studentName} <small style="display:block; color:var(--text-muted);">${fine.studentId}</small></td>
          <td>${fine.facultyName}</td>
          <td>${fine.teacherName}</td>
          <td>${fine.type}</td>
          <td>$${fine.amount.toFixed(2)}</td>
          <td>${new Date(fine.date).toLocaleDateString()}</td>
          <td><span class="status-${fine.status}">${fine.status}</span></td>
          <td>
            ${isPaid 
              ? `<button class="action-btn download-receipt-btn" data-id="${fine.id}"><i class="bx bxs-file-pdf"></i> Receipt</button>` 
              : `<span style="font-size:12px; color:var(--text-muted)">No Receipt</span>`}
          </td>
        `;
        adminFinesTable.appendChild(row);
      });

      adminFinesTable.querySelectorAll('.download-receipt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const fineId = btn.getAttribute('data-id');
          const fine = data.fines.find(f => f.id === fineId);
          if (fine) downloadReceiptPDF(fine);
        });
      });
    }

    // Open User Modal
    document.getElementById('admin-add-user-btn').onclick = () => {
      userModalAlert.classList.add('hide');
      userModalForm.reset();
      adminNewFacultyWrapper.classList.add('hide'); // default student major
      userModal.classList.add('active');
    };
  }

  function renderAdminUsersTable(users) {
    const tableBody = document.getElementById('admin-users-table');
    tableBody.innerHTML = '';

    users.forEach(u => {
      const isSelf = u.id === currentUser.id;
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${u.id}</strong></td>
        <td>${u.name} ${isSelf ? '<small style="color:var(--text-success)">(You)</small>' : ''}</td>
        <td>${u.email}</td>
        <td><span class="role-badge role-${u.role}">${u.role}</span></td>
        <td>
          <span style="font-size:12px; display:inline-flex; align-items:center; gap:4px; color:${u.status === 'active' ? 'var(--text-success)' : 'var(--text-danger)'}">
            <i class="bx bxs-circle" style="font-size:8px;"></i> ${u.status}
          </span>
        </td>
        <td>
          <button class="action-btn edit-user-btn" data-id="${u.id}" style="margin-right: 8px;">
            <i class="bx bx-edit-alt"></i> Edit
          </button>
          ${isSelf ? '' : `
            <button class="action-btn action-btn-danger delete-user-btn" data-id="${u.id}">
              <i class="bx bx-trash"></i> Delete
            </button>
          `}
        </td>
      `;
      tableBody.appendChild(row);
    });

    document.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const userId = btn.getAttribute('data-id');
        const user = users.find(u => u.id === userId);
        if (!user) return;

        // Populate fields
        document.getElementById('admin-edit-id').value = user.id;
        document.getElementById('admin-edit-name').value = user.name;
        document.getElementById('admin-edit-email').value = user.email;
        document.getElementById('admin-edit-role').value = user.role;
        document.getElementById('admin-edit-status').value = user.status;
        document.getElementById('admin-edit-password').value = '';

        // Reset error message
        editUserModalAlert.classList.add('hide');

        const isSelf = user.id === currentUser.id;
        if (isSelf) {
          adminEditRole.disabled = true;
          document.getElementById('admin-edit-status').disabled = true;
        } else {
          adminEditRole.disabled = false;
          document.getElementById('admin-edit-status').disabled = false;
        }

        // Show/hide and populate assigned department
        if (user.role === 'Student' || user.role === 'Faculty') {
          adminEditFacultyWrapper.classList.remove('hide');
          const dept = user.role === 'Student' ? (user.profile?.major || 'Science') : (user.profile?.facultyName || 'Science');
          document.getElementById('admin-edit-faculty').value = dept;
        } else {
          adminEditFacultyWrapper.classList.add('hide');
        }

        editUserModal.classList.add('active');
      });
    });

    document.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.getAttribute('data-id');
        if (!confirm('Are you sure you want to permanently delete this user account?')) return;

        try {
          const res = await fetch(`/api/dashboard/users/${userId}`, { method: 'DELETE' });
          const data = await res.json();
          if (res.ok) {
            renderAdminUsersTable(data.users);
            renderAdminLogs(data.auditLogs);
            document.getElementById('admin-total-users').textContent = data.users.length;
            loadDashboardData(); // Refresh remaining sections
          } else {
            alert(data.error || 'Failed to delete user.');
          }
        } catch (err) {
          alert('Network communication error.');
        }
      });
    });
  }

  function renderAdminLogs(logs) {
    const logsConsole = document.getElementById('admin-logs-console');
    logsConsole.innerHTML = '';

    logs.forEach(log => {
      const dateStr = new Date(log.timestamp).toLocaleTimeString();
      const div = document.createElement('div');
      div.className = `log-entry log-entry-${log.status}`;
      div.innerHTML = `
        [${dateStr}] <strong>${log.user}</strong>: ${log.action} | 
        <span style="font-weight:600">${log.status}</span> - ${log.details}
      `;
      logsConsole.appendChild(div);
    });
  }

  async function refreshAdminStats() {
    try {
      const res = await fetch('/api/dashboard/data');
      if (res.ok) {
        const data = await res.json();
        document.getElementById('admin-uptime').textContent = data.stats.uptime;
        document.getElementById('admin-active-sessions').textContent = data.stats.activeSessions;
        renderAdminLogs(data.auditLogs);
      }
    } catch (e) {}
  }


  // --- jsPDF Receipt Generator ---
  function downloadReceiptPDF(fine) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });

    // 1. Branding Header
    doc.setFillColor(11, 15, 25); // dark theme banner
    doc.rect(0, 0, 216, 40, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.text("Students' Fines/Dues Verification Receipt", 20, 25);

    // Subtitle
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Student Information Portal payment confirmation record', 20, 32);

    // 2. Receipt metadata
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(10);
    doc.text(`Receipt Reference: AURA-FT-${fine.id.toUpperCase()}-${Math.floor(Math.random() * 89999 + 10000)}`, 20, 55);
    doc.text(`Issued Date: ${new Date(fine.date).toLocaleString()}`, 20, 61);
    doc.text(`Payment Date: ${new Date(fine.datePaid).toLocaleString()}`, 20, 67);

    // 3. Grid details
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.5);
    doc.line(20, 75, 196, 75); // Divider

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
    doc.text(`Originating Faculty:   ${fine.facultyName} Department`, 25, 123);
    doc.text(`Issuing Instructor:   ${fine.teacherName}`, 25, 129);
    doc.text(`Classification:       ${fine.type}`, 25, 135);
    doc.text(`Reason/Details:       ${fine.details}`, 25, 141);

    doc.line(20, 152, 196, 152); // Divider

    // 4. Large Watermark (PAID Stamp)
    doc.setFontSize(48);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(220, 245, 230); // Very light mint green
    doc.text('PAID IN FULL', 50, 185, { angle: 15 });

    // 5. Total Settle Block
    doc.setTextColor(11, 15, 25);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    doc.text('TRANSACTION SUMMARY', 20, 210);

    // Draw total box
    doc.setFillColor(245, 245, 248);
    doc.rect(20, 218, 176, 18, 'F');
    doc.setFontSize(14);
    doc.setTextColor(16, 185, 129); // Success green
    doc.text(`Total Settled Amount:  $${fine.amount.toFixed(2)} USD`, 25, 230);

    // 6. Security verification note
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'oblique');
    doc.text('This document serves as verification that the penalty has been cleared from student ledger registry records.', 20, 252);
    doc.text("No physical signature required. Verified electronically by Students' Fines/Dues Verification Registrar.", 20, 257);

    // Save PDF
    doc.save(`Receipt_Fine_${fine.id.toUpperCase()}.pdf`);
  }


  // --- Helper Modals Submit ---

  // Grade Modal Form
  gradeModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    gradeModalAlert.classList.add('hide');

    const studentId = document.getElementById('grade-student-id').value;
    const courseCode = document.getElementById('grade-course-code').value;
    const newScore = document.getElementById('grade-score-input').value;
    const newGrade = document.getElementById('grade-letter-input').value;

    try {
      const res = await fetch('/api/dashboard/grades', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, courseCode, newGrade, newScore })
      });
      const data = await res.json();

      if (res.ok) {
        gradeModal.classList.remove('active');
        renderFacultyDashboard({ profile: data.profile, fines: db.fines.filter(f => f.teacherName === currentUser.name) });
        loadDashboardData();
      } else {
        gradeModalErrorMsg.textContent = data.error || 'Failed to update grade.';
        gradeModalAlert.classList.remove('hide');
      }
    } catch (err) {
      gradeModalErrorMsg.textContent = 'Server communications error.';
      gradeModalAlert.classList.remove('hide');
    }
  });

  gradeModalClose.addEventListener('click', () => gradeModal.classList.remove('active'));

  // Create User Modal Form
  userModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    userModalAlert.classList.add('hide');

    const name = document.getElementById('admin-new-name').value.trim();
    const email = document.getElementById('admin-new-email').value.trim();
    const role = document.getElementById('admin-new-role').value;
    const facultyName = document.getElementById('admin-new-faculty').value;
    const password = document.getElementById('admin-new-password').value;

    try {
      const res = await fetch('/api/dashboard/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, facultyName, password })
      });
      const data = await res.json();

      if (res.ok) {
        userModal.classList.remove('active');
        userModalForm.reset();
        
        renderAdminUsersTable(data.users);
        renderAdminLogs(data.auditLogs);
        document.getElementById('admin-total-users').textContent = data.users.length;
        loadDashboardData();
      } else {
        userModalErrorMsg.textContent = data.error || 'Failed to create user.';
        userModalAlert.classList.remove('hide');
      }
    } catch (err) {
      userModalErrorMsg.textContent = 'Server communications error.';
      userModalAlert.classList.remove('hide');
    }
  });

  userModalClose.addEventListener('click', () => userModal.classList.remove('active'));

  // Edit User Modal Handlers
  editUserModalClose.addEventListener('click', () => editUserModal.classList.remove('active'));

  editUserModalForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    editUserModalAlert.classList.add('hide');

    const userId = document.getElementById('admin-edit-id').value;
    const name = document.getElementById('admin-edit-name').value.trim();
    const email = document.getElementById('admin-edit-email').value.trim();
    const role = document.getElementById('admin-edit-role').value;
    const status = document.getElementById('admin-edit-status').value;
    const facultyName = document.getElementById('admin-edit-faculty').value;
    const password = document.getElementById('admin-edit-password').value;

    try {
      const res = await fetch(`/api/dashboard/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, status, facultyName, password })
      });
      const data = await res.json();

      if (res.ok) {
        editUserModal.classList.remove('active');
        editUserModalForm.reset();

        renderAdminUsersTable(data.users);
        renderAdminLogs(data.auditLogs);
        document.getElementById('admin-total-users').textContent = data.users.length;
        
        // If we updated ourselves, reload info and stats
        if (userId === currentUser.id) {
          currentUser.name = name;
          currentUser.email = email;
          setupHeader(currentUser);
        }
        
        loadDashboardData();
      } else {
        editUserModalErrorMsg.textContent = data.error || 'Failed to update user.';
        editUserModalAlert.classList.remove('hide');
      }
    } catch (err) {
      editUserModalErrorMsg.textContent = 'Server communications error.';
      editUserModalAlert.classList.remove('hide');
    }
  });


  // --- Common Logout ---
  logoutBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = 'index.html';
    } catch (err) {
      window.location.href = 'index.html';
    }
  });

  window.onclick = (event) => {
    if (event.target === gradeModal) gradeModal.classList.remove('active');
    if (event.target === userModal) userModal.classList.remove('active');
    if (event.target === fineModal) fineModal.classList.remove('active');
    if (event.target === editUserModal) editUserModal.classList.remove('active');
  };

  // --- GPA Simulator Helper ---
  function setupGPASimulator(existingGrades) {
    const calcRowsContainer = document.getElementById('gpa-calc-rows');
    calcRowsContainer.innerHTML = '';
    
    existingGrades.forEach(g => {
      addCalcRow(g.grade, 3, true, g.course);
    });

    calcRowsContainer.addEventListener('change', calculateSimulatedGPA);
    document.getElementById('add-calc-row-btn').onclick = () => {
      addCalcRow('A', 3, false);
      calculateSimulatedGPA();
    };

    calculateSimulatedGPA();
  }

  function addCalcRow(selectedGrade, credits, isLocked, label = 'Simulated Course') {
    const calcRowsContainer = document.getElementById('gpa-calc-rows');
    const row = document.createElement('div');
    row.className = 'calc-row';
    
    let gradeOptions = '';
    Object.keys(gradePoints).forEach(g => {
      gradeOptions += `<option value="${gradePoints[g]}" ${g === selectedGrade ? 'selected' : ''}>${g}</option>`;
    });

    row.innerHTML = `
      <span style="font-size: 12px; align-self: center; flex: 1.5; color: ${isLocked ? 'var(--text-muted)' : 'var(--primary)'}">
        ${isLocked ? '<i class="bx bxs-lock-alt"></i> ' : ''}${label}
      </span>
      <select class="calc-grade" style="flex: 1.5;">${gradeOptions}</select>
      <input class="calc-credits" type="number" min="1" max="5" value="${credits}" style="flex: 1;" ${isLocked ? 'readonly' : ''}>
      ${!isLocked ? '<button class="action-btn action-btn-danger remove-calc-row" style="flex: 0.5;"><i class="bx bx-trash"></i></button>' : '<div style="flex:0.5;"></div>'}
    `;

    if (!isLocked) {
      row.querySelector('.remove-calc-row').onclick = () => {
        row.remove();
        calculateSimulatedGPA();
      };
    }

    calcRowsContainer.appendChild(row);
  }

  function calculateSimulatedGPA() {
    const grades = document.querySelectorAll('.calc-grade');
    const credits = document.querySelectorAll('.calc-credits');

    let totalPoints = 0;
    let totalCredits = 0;

    for (let i = 0; i < grades.length; i++) {
      const gradeVal = parseFloat(grades[i].value);
      const creditVal = parseInt(credits[i].value) || 0;
      totalPoints += gradeVal * creditVal;
      totalCredits += creditVal;
    }

    const simGPA = totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : '0.00';
    document.getElementById('simulated-gpa-val').textContent = simGPA;
  }
});
