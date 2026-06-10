document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const authCard = document.getElementById('auth-card');
  const alertBox = document.getElementById('alert-box');
  const alertMessage = document.getElementById('alert-message');
  
  // Views
  const loginView = document.getElementById('login-view');
  const registerView = document.getElementById('register-view');
  const forgotView = document.getElementById('forgot-view');

  // Forms
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const forgotForm = document.getElementById('forgot-form');

  // Navigation triggers
  const goToRegister = document.getElementById('go-to-register');
  const goToLogin = document.getElementById('go-to-login');
  const goToForgot = document.getElementById('go-to-forgot');
  const forgotBackBtn = document.getElementById('forgot-back-btn');

  // Inputs
  const registerPassword = document.getElementById('register-password');
  const strengthContainer = document.getElementById('password-strength-container');
  const strengthBar = document.getElementById('password-strength-bar');
  const strengthText = document.getElementById('password-strength-text');

  // Roles & Hints
  const roleTabs = document.querySelectorAll('.role-tab');
  const credentialHint = document.getElementById('credential-hint');

  const credentialsMap = {
    Student: { email: 'student@school.edu', pass: 'student123' },
    Faculty: { email: 'teacher@school.edu', pass: 'faculty123' },
    Admin: { email: 'admin@school.edu', pass: 'admin123' }
  };

  // Check if user is already logged in
  fetch('/api/auth/me')
    .then(res => {
      if (res.ok) {
        window.location.href = 'dashboard.html';
      }
    })
    .catch(() => {});

  // Alert helper
  function showAlert(message, type = 'danger') {
    alertBox.className = `alert alert-${type}`;
    alertMessage.textContent = message;
    alertBox.classList.remove('hide');
  }

  function hideAlert() {
    alertBox.classList.add('hide');
  }

  function shakeCard() {
    authCard.classList.add('shake');
    setTimeout(() => {
      authCard.classList.remove('shake');
    }, 400);
  }

  // View Navigation
  goToRegister.addEventListener('click', () => {
    hideAlert();
    loginView.classList.add('hide');
    registerView.classList.remove('hide');
  });

  goToLogin.addEventListener('click', () => {
    hideAlert();
    registerView.classList.add('hide');
    loginView.classList.remove('hide');
  });

  goToForgot.addEventListener('click', (e) => {
    e.preventDefault();
    hideAlert();
    loginView.classList.add('hide');
    forgotView.classList.remove('hide');
  });

  forgotBackBtn.addEventListener('click', () => {
    hideAlert();
    forgotView.classList.add('hide');
    loginView.classList.remove('hide');
  });

  // Faculty mapping
  const facultyEmails = {
    Technology: 'teacher@school.edu',
    Medicine: 'medicine@school.edu',
    Management: 'management@school.edu',
    Science: 'science@school.edu',
    Agriculture: 'agriculture@school.edu',
    'Food Science': 'foodscience@school.edu'
  };

  const facultySelect = document.getElementById('faculty-creds-select');
  const facultyWrapper = document.getElementById('faculty-creds-dropdown-wrapper');

  function updateFacultyAutoFill() {
    const dept = facultySelect.value;
    const email = facultyEmails[dept] || 'teacher@school.edu';
    credentialHint.innerHTML = `Demo Faculty (${dept}) Account: <strong>${email}</strong> / <strong>faculty123</strong>`;
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = 'faculty123';
  }

  facultySelect.addEventListener('change', updateFacultyAutoFill);

  // Role Selection & Credentials Hint
  roleTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      roleTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const role = tab.getAttribute('data-role');
      
      if (role === 'Faculty') {
        facultyWrapper.classList.remove('hide');
        updateFacultyAutoFill();
      } else {
        facultyWrapper.classList.add('hide');
        const creds = credentialsMap[role];
        credentialHint.innerHTML = `Demo ${role} Account: <strong>${creds.email}</strong> / <strong>${creds.pass}</strong>`;
        
        // Auto-fill login fields
        document.getElementById('login-email').value = creds.email;
        document.getElementById('login-password').value = creds.pass;
      }
    });
  });

  // Trigger click on Student tab initially to auto-fill
  document.querySelector('.role-tab[data-role="Student"]').click();

  // Password Strength Calculator
  registerPassword.addEventListener('input', () => {
    const val = registerPassword.value;
    if (!val) {
      strengthContainer.style.display = 'none';
      strengthText.classList.add('hide');
      return;
    }

    strengthContainer.style.display = 'block';
    strengthText.classList.remove('hide');

    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    strengthBar.className = 'strength-bar';
    if (score <= 1) {
      strengthBar.classList.add('strength-weak');
      strengthText.innerHTML = 'Password Strength: <span style="color: var(--text-danger)">Weak (Add letters/numbers)</span>';
    } else if (score === 2 || score === 3) {
      strengthBar.classList.add('strength-medium');
      strengthText.innerHTML = 'Password Strength: <span style="color: var(--text-warning)">Moderate (Add special characters)</span>';
    } else {
      strengthBar.classList.add('strength-strong');
      strengthText.innerHTML = 'Password Strength: <span style="color: var(--text-success)">Strong and Secure</span>';
    }
  });

  // Form Submissions

  // 1. Login
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showAlert('Please fill in all fields.');
      shakeCard();
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 800);
      } else {
        showAlert(data.error || 'Authentication failed.');
        shakeCard();
      }
    } catch (err) {
      showAlert('Unable to reach auth server. Please try again.');
      shakeCard();
    }
  });

  // 2. Register
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const role = document.getElementById('register-role').value;
    const password = registerPassword.value;

    if (!name || !email || !password || !role) {
      showAlert('Please fill in all registration fields.');
      return;
    }

    if (password.length < 8) {
      showAlert('Password must be at least 8 characters long.');
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role })
      });

      const data = await response.json();

      if (response.ok) {
        showAlert(data.message, 'success');
        // Clear fields
        registerForm.reset();
        strengthContainer.style.display = 'none';
        strengthText.classList.add('hide');
        
        // Go back to login screen after delay
        setTimeout(() => {
          registerView.classList.add('hide');
          loginView.classList.remove('hide');
          // Switch tab to matching role
          const tab = document.querySelector(`.role-tab[data-role="${role}"]`);
          if (tab) tab.click();
        }, 1500);
      } else {
        showAlert(data.error || 'Registration failed.');
      }
    } catch (err) {
      showAlert('Unable to reach register server. Please try again.');
    }
  });

  // 3. Reset Password (Simulation)
  forgotForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = document.getElementById('forgot-email').value.trim();
    const newPassword = document.getElementById('forgot-new-password').value;

    if (!email || !newPassword) {
      showAlert('Please provide both email and a new password.');
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        showAlert(data.message, 'success');
        forgotForm.reset();
        setTimeout(() => {
          forgotView.classList.add('hide');
          loginView.classList.remove('hide');
        }, 2000);
      } else {
        showAlert(data.error || 'Password reset failed.');
      }
    } catch (err) {
      showAlert('Unable to reach password reset server. Please try again.');
    }
  });
});
