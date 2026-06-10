import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getUserFromRequest();
    
    if (!user) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }

    // Exclude password hash
    const { password, ...userWithoutPassword } = user;
    return NextResponse.json({ user: userWithoutPassword });

  } catch (err) {
    console.error('Error in auth/me API:', err);
    return NextResponse.json({ error: 'Server error occurred during session check.' }, { status: 500 });
  }
}
