import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    // Retrieve user from database
    const users = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);

    if (users.length === 0) {
      // Log failure
      await db.query(
        'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
        [email, 'Login Attempt', 'Failure', 'User not found']
      );
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const user = users[0];

    // Check account status and lockouts
    if (user.status === 'locked') {
      if (user.lock_until) {
        if (new Date(user.lock_until) > new Date()) {
          const remainingTime = Math.ceil((new Date(user.lock_until) - new Date()) / 1000);
          return NextResponse.json({ 
            error: `Account locked. Try again in ${remainingTime} seconds.` 
          }, { status: 423 });
        } else {
          // Lock has expired, auto unlock
          await db.query(
            'UPDATE users SET status = "active", lock_until = NULL, failed_attempts = 0 WHERE id = ?',
            [user.id]
          );
          user.status = 'active';
          user.lock_until = null;
          user.failed_attempts = 0;
        }
      } else {
        // Permanently locked by administrator
        return NextResponse.json({ 
          error: 'Account locked. Please contact the administrator.' 
        }, { status: 423 });
      }
    }

    // Compare passwords
    const passwordMatch = bcrypt.compareSync(password, user.password);

    if (!passwordMatch) {
      const newAttempts = user.failed_attempts + 1;
      
      if (newAttempts >= 3) {
        // Lock account for 60 seconds
        await db.query(
          'UPDATE users SET failed_attempts = ?, status = "locked", lock_until = DATE_ADD(NOW(), INTERVAL 1 MINUTE) WHERE id = ?',
          [newAttempts, user.id]
        );
        await db.query(
          'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
          [user.email, 'Account Lockout', 'Locked', 'Locked out for 60 seconds due to 3 consecutive failures']
        );
        return NextResponse.json({ 
          error: 'Account locked due to 3 failed attempts. Please wait 60 seconds.' 
        }, { status: 423 });
      } else {
        // Update attempts
        await db.query('UPDATE users SET failed_attempts = ? WHERE id = ?', [newAttempts, user.id]);
        await db.query(
          'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
          [user.email, 'Login Attempt', 'Failure', `Incorrect password. Failed attempt #${newAttempts}`]
        );
        const attemptsLeft = 3 - newAttempts;
        return NextResponse.json({ 
          error: `Invalid email or password. You have ${attemptsLeft} attempt(s) remaining.` 
        }, { status: 401 });
      }
    }

    // Success login
    await db.query('UPDATE users SET failed_attempts = 0, lock_until = NULL, status = "active" WHERE id = ?', [user.id]);
    
    // Sign token
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    // Set cookie
    const cookieStore = await cookies();
    cookieStore.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60, // 15 minutes
      path: '/'
    });

    // Audit Log
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [user.email, 'Login', 'Success', `User logged in with role ${user.role}`]
    );

    return NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    console.error('Error in login API:', err);
    return NextResponse.json({ error: 'Server error occurred during login.' }, { status: 500 });
  }
}
