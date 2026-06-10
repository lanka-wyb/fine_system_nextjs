import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function POST() {
  try {
    const user = await getUserFromRequest();
    
    if (user) {
      // Audit Log
      await db.query(
        'INSERT INTO audit_logs (user_email, action, status, details) VALUES (?, ?, ?, ?)',
        [user.email, 'Logout', 'Success', 'User logged out']
      );
    }

    // Clear Cookie
    const cookieStore = await cookies();
    cookieStore.delete('token');

    return NextResponse.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Error in logout API:', err);
    return NextResponse.json({ error: 'Server error occurred during logout.' }, { status: 500 });
  }
}
