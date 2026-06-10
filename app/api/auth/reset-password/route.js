import { NextResponse } from 'next/server';
import db from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { email, newPassword } = await request.json();

    if (!email || !newPassword) {
      return NextResponse.json({ error: 'Email and new password are required.' }, { status: 400 });
    }

    const users = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);

    if (users.length === 0) {
      // Log failure
      await db.query(
        'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
        [email.trim(), 'Password Reset', 'Failure', 'Attempted password reset for non-existent user']
      );
      // Return a simulated success message for privacy/security to prevent user enumeration
      return NextResponse.json({ message: 'If the email matches an active account, instructions have been simulated.' });
    }

    const userId = users[0].id;
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    // Update password, status, failed attempts, and locks
    await db.query(
      'UPDATE users SET password = ?, status = "active", lock_until = NULL, failed_attempts = 0 WHERE id = ?',
      [hashedPassword, userId]
    );

    // Log success
    await db.query(
      'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
      [email.trim(), 'Password Reset', 'Success', 'Password was reset successfully']
    );

    return NextResponse.json({ message: 'Password reset successful. You can now login with your new password.' });

  } catch (err) {
    console.error('Error in password reset API:', err);
    return NextResponse.json({ error: 'Server error occurred during password reset.' }, { status: 500 });
  }
}
