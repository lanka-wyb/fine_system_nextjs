'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  // View state: 'login' | 'register' | 'forgot'
  const [view, setView] = useState('login');

  // Selected role for login: 'Student' | 'Faculty' | 'Admin'
  const [role, setRole] = useState('Student');

  // Selected department for Faculty autofill
  const [facultyDept, setFacultyDept] = useState('Technology');

  // Alert state
  const [alert, setAlert] = useState({ show: false, message: '', type: 'danger' });

  // Shake animation trigger
  const [shake, setShake] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerRole, setRegisterRole] = useState('Student');
  const [registerPassword, setRegisterPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');

  // Password strength meter state
  const [strengthScore, setStrengthScore] = useState(0);

  // Credentials Autofill mapping
  const credentialsMap = {
    Student: { email: 'student@school.edu', pass: 'student123' },
    Faculty: {
      Technology: 'teacher@school.edu',
      Medicine: 'medicine@school.edu',
      Management: 'management@school.edu',
      Science: 'science@school.edu',
      Agriculture: 'agriculture@school.edu',
      'Food Science': 'foodscience@school.edu'
    },
    Admin: { email: 'admin@school.edu', pass: 'admin123' }
  };

  // 1. Initial auth check
  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) {
          router.push('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  // 2. Auto-fill login credentials when role or department changes
  useEffect(() => {
    if (view !== 'login') return;

    if (role === 'Faculty') {
      const email = credentialsMap.Faculty[facultyDept];
      setLoginEmail(email);
      setLoginPassword('faculty123');
    } else {
      const creds = credentialsMap[role];
      setLoginEmail(creds.email);
      setLoginPassword(creds.pass);
    }
  }, [role, facultyDept, view]);

  // 3. Password strength meter calculator
  useEffect(() => {
    if (!registerPassword) {
      setStrengthScore(0);
      return;
    }

    let score = 0;
    if (registerPassword.length >= 8) score++;
    if (/[A-Z]/.test(registerPassword)) score++;
    if (/[0-9]/.test(registerPassword)) score++;
    if (/[^A-Za-z0-9]/.test(registerPassword)) score++;

    setStrengthScore(score);
  }, [registerPassword]);

  // Helper to show/hide alerts
  const showAlert = (message, type = 'danger') => {
    setAlert({ show: true, message, type });
  };

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  // Form Submissions
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAlert({ ...alert, show: false });

    if (!loginEmail || !loginPassword) {
      showAlert('Please fill in all fields.');
      triggerShake();
      return;
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();

      if (res.ok) {
        showAlert('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } else {
        showAlert(data.error || 'Authentication failed.');
        triggerShake();
      }
    } catch (err) {
      showAlert('Unable to reach auth server. Please try again.');
      triggerShake();
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAlert({ ...alert, show: false });

    if (!registerName || !registerEmail || !registerPassword || !registerRole) {
      showAlert('Please fill in all registration fields.');
      return;
    }

    if (registerPassword.length < 8) {
      showAlert('Password must be at least 8 characters long.');
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerName,
          email: registerEmail,
          password: registerPassword,
          role: registerRole
        })
      });
      const data = await res.json();

      if (res.ok) {
        showAlert(data.message, 'success');
        setRegisterName('');
        setRegisterEmail('');
        setRegisterPassword('');
        
        setTimeout(() => {
          setView('login');
          setRole(registerRole);
        }, 1500);
      } else {
        showAlert(data.error || 'Registration failed.');
      }
    } catch (err) {
      showAlert('Unable to reach register server. Please try again.');
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setAlert({ ...alert, show: false });

    if (!forgotEmail || !forgotNewPassword) {
      showAlert('Please provide both email and a new password.');
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, newPassword: forgotNewPassword })
      });
      const data = await res.json();

      if (res.ok) {
        showAlert(data.message, 'success');
        setForgotEmail('');
        setForgotNewPassword('');
        setTimeout(() => {
          setView('login');
        }, 2000);
      } else {
        showAlert(data.error || 'Password reset failed.');
      }
    } catch (err) {
      showAlert('Unable to reach password reset server. Please try again.');
    }
  };

  return (
    <div className="container">
      <div className={`glass-card ${shake ? 'shake' : ''}`} id="auth-card">
        
        {/* Card Header */}
        <div className="card-header">
          <div className="logo-container">
            <i className="bx bxs-graduation logo-icon"></i>
          </div>
          <h1 className="card-title" style={{ fontSize: '24px' }}>Students&apos; Fines/Dues Verification</h1>
          <p className="card-subtitle">Student Information System</p>
        </div>

        {/* Alert Message Box */}
        {alert.show && (
          <div className={`alert alert-${alert.type}`}>
            <i className="bx bx-error-circle"></i>
            <span>{alert.message}</span>
          </div>
        )}

        {/* 1. Login View */}
        {view === 'login' && (
          <div id="login-view">
            {/* Role Selector Tabs */}
            <div className="role-tabs">
              {['Student', 'Faculty', 'Admin'].map(r => (
                <div
                  key={r}
                  className={`role-tab ${role === r ? 'active' : ''}`}
                  onClick={() => setRole(r)}
                >
                  {r}
                </div>
              ))}
            </div>

            <form onSubmit={handleLoginSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">Academic Email</label>
                <div className="input-wrapper">
                  <i className="bx bx-envelope input-icon"></i>
                  <input
                    className="form-input"
                    type="email"
                    id="login-email"
                    placeholder="name@school.edu"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">Password</label>
                <div className="input-wrapper">
                  <i className="bx bx-lock-alt input-icon"></i>
                  <input
                    className="form-input"
                    type="password"
                    id="login-password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <label className="remember-me">
                  <input type="checkbox" id="remember-me" />
                  <span>Remember me</span>
                </label>
                <a
                  href="#"
                  className="forgot-link"
                  onClick={(e) => {
                    e.preventDefault();
                    setAlert({ ...alert, show: false });
                    setView('forgot');
                  }}
                >
                  Forgot Password?
                </a>
              </div>

              <button type="submit" className="btn btn-primary" id="login-btn">
                <span>Sign In</span>
                <i className="bx bx-log-in-circle"></i>
              </button>
            </form>

            {/* Dynamic Credentials Hint Box */}
            <div style={{
              marginTop: '20px',
              padding: '12px',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border-color)',
              borderRadius: '8px',
              fontSize: '12px',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}>
              <i className="bx bx-info-circle" style={{ verticalAlign: 'middle', marginRight: '4px', color: 'var(--primary)' }}></i>
              {role === 'Faculty' ? (
                <span>
                  Demo Faculty ({facultyDept}) Account: <strong>{credentialsMap.Faculty[facultyDept]}</strong> / <strong>faculty123</strong>
                </span>
              ) : (
                <span>
                  Demo {role} Account: <strong>{credentialsMap[role].email}</strong> / <strong>{credentialsMap[role].pass}</strong>
                </span>
              )}

              {role === 'Faculty' && (
                <div style={{ marginTop: '8px' }}>
                  <label htmlFor="faculty-creds-select" style={{ fontSize: '11px' }}>Select Department: </label>
                  <select
                    id="faculty-creds-select"
                    value={facultyDept}
                    onChange={(e) => setFacultyDept(e.target.value)}
                    style={{
                      background: 'rgba(11, 15, 25, 0.95)',
                      border: '1px solid var(--border-color)',
                      color: 'white',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-primary)'
                    }}
                  >
                    <option value="Technology">Technology (Dr. Turing)</option>
                    <option value="Medicine">Medicine (Dr. House)</option>
                    <option value="Management">Management (Dr. Drucker)</option>
                    <option value="Science">Science (Dr. Curie)</option>
                    <option value="Agriculture">Agriculture (Dr. Borlaug)</option>
                    <option value="Food Science">Food Science (Dr. Pasteur)</option>
                  </select>
                </div>
              )}
            </div>

            <p className="switch-form-text">
              New student or staff?{' '}
              <span className="switch-form-link" onClick={() => {
                setAlert({ ...alert, show: false });
                setView('register');
              }}>
                Create Account
              </span>
            </p>
          </div>
        )}

        {/* 2. Register View */}
        {view === 'register' && (
          <div id="register-view">
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="register-name">Full Name</label>
                <div className="input-wrapper">
                  <i className="bx bx-user input-icon"></i>
                  <input
                    className="form-input"
                    type="text"
                    id="register-name"
                    placeholder="John Doe"
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-email">Email Address</label>
                <div className="input-wrapper">
                  <i className="bx bx-envelope input-icon"></i>
                  <input
                    className="form-input"
                    type="email"
                    id="register-email"
                    placeholder="name@school.edu"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-role">Portal Role</label>
                <div className="input-wrapper">
                  <i className="bx bx-user-pin input-icon" style={{ color: 'var(--text-muted)' }}></i>
                  <select
                    className="form-input"
                    id="register-role"
                    style={{ paddingLeft: '48px', backgroundColor: '#0b0f19' }}
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value)}
                    required
                  >
                    <option value="Student">Student</option>
                    <option value="Faculty">Faculty Member</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="register-password">Create Password</label>
                <div className="input-wrapper">
                  <i className="bx bx-lock-alt input-icon"></i>
                  <input
                    className="form-input"
                    type="password"
                    id="register-password"
                    placeholder="Min. 8 characters"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    required
                  />
                </div>
                {/* Password Strength Meter */}
                {registerPassword && (
                  <>
                    <div className="strength-meter" style={{ display: 'block' }}>
                      <div className={`strength-bar ${
                        strengthScore <= 1 ? 'strength-weak' :
                        strengthScore === 2 || strengthScore === 3 ? 'strength-medium' :
                        'strength-strong'
                      }`}></div>
                    </div>
                    <span className="strength-text">
                      Password Strength:{' '}
                      {strengthScore <= 1 && <span style={{ color: 'var(--text-danger)' }}>Weak (Add letters/numbers)</span>}
                      {(strengthScore === 2 || strengthScore === 3) && <span style={{ color: 'var(--text-warning)' }}>Moderate (Add special characters)</span>}
                      {strengthScore === 4 && <span style={{ color: 'var(--text-success)' }}>Strong and Secure</span>}
                    </span>
                  </>
                )}
              </div>

              <button type="submit" className="btn btn-primary" id="register-btn" style={{ marginTop: '24px' }}>
                <span>Register Account</span>
                <i className="bx bx-user-plus"></i>
              </button>
            </form>

            <p className="switch-form-text">
              Already registered?{' '}
              <span className="switch-form-link" onClick={() => {
                setAlert({ ...alert, show: false });
                setView('login');
              }}>
                Sign In
              </span>
            </p>
          </div>
        )}

        {/* 3. Forgot Password View */}
        {view === 'forgot' && (
          <div id="forgot-view">
            <div style={{ marginBottom: '24px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: '1.5' }}>
                Enter your registered school email address and we&apos;ll reset the password and re-activate the account.
              </p>
            </div>

            <form onSubmit={handleForgotSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Academic Email</label>
                <div className="input-wrapper">
                  <i className="bx bx-envelope input-icon"></i>
                  <input
                    className="form-input"
                    type="email"
                    id="forgot-email"
                    placeholder="name@school.edu"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="forgot-new-password">New Password</label>
                <div className="input-wrapper">
                  <i className="bx bx-key input-icon"></i>
                  <input
                    className="form-input"
                    type="password"
                    id="forgot-new-password"
                    placeholder="••••••••"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary" id="forgot-btn" style={{ marginTop: '10px' }}>
                <span>Simulate Reset</span>
                <i className="bx bx-mail-send"></i>
              </button>

              <button type="button" className="btn btn-secondary" onClick={() => {
                setAlert({ ...alert, show: false });
                setView('login');
              }}>
                <span>Back to Sign In</span>
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
