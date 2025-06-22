
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { LoginSchema } from '@/lib/schemas';
import { users, ensureUsersAreLoaded } from '@/lib/userStore';

const DEFAULT_BANK_BALANCE_IF_MISSING = 20000;

export async function POST(req: NextRequest) {
  ensureUsersAreLoaded();

  try {
    const body = await req.json();
    const validation = LoginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ errors: validation.error.flatten().fieldErrors }, { status: 400 });
    }

    const { email, password } = validation.data;

    console.log('Attempting login for:', email);
    console.log('Users available in store for login:', users.map(u => u.email));

    const userFromFile = users.find(user => user.email === email);

    if (!userFromFile) {
      console.log('User not found:', email);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Ensure bankBalance exists, default if not (for older user records from persisted_users.json)
    const currentBankBalance = typeof userFromFile.bankBalance === 'undefined'
      ? DEFAULT_BANK_BALANCE_IF_MISSING
      : userFromFile.bankBalance;

    const isPasswordValid = await bcrypt.compare(password, userFromFile.hashedPassword);

    if (!isPasswordValid) {
      console.log('Password invalid for user:', email);
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    // Prepare user object to return, ensuring bankBalance is included
    const { hashedPassword: _, hashedPin: __, ...userBase } = userFromFile;
    const userToReturn = {
      ...userBase,
      bankBalance: currentBankBalance, // Ensure bankBalance is correctly set
    };

    console.log('User logged in (from shared file-backed store):', { email: userToReturn.email, upiId: userToReturn.upiId, bankBalance: userToReturn.bankBalance });

    return NextResponse.json({
      user: userToReturn
    }, { status: 200 });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
