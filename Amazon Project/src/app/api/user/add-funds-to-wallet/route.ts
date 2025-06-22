
// src/app/api/user/add-funds-to-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { users, saveUsersToFile, ensureUsersAreLoaded } from '@/lib/userStore';

const TRANSACTION_LIMIT = 1000;

export async function POST(req: NextRequest) {
  ensureUsersAreLoaded();

  try {
    const body = await req.json();
    const { userId, amount, pin } = body;

    if (!userId || typeof amount !== 'number' || !pin) {
      return NextResponse.json({ message: 'Missing userId, amount, or PIN' }, { status: 400 });
    }

    if (amount <= 0) {
      return NextResponse.json({ message: 'Amount must be positive' }, { status: 400 });
    }

    if (amount > TRANSACTION_LIMIT) {
      return NextResponse.json({ message: `Transaction limit is ${TRANSACTION_LIMIT}` }, { status: 400 });
    }

    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const user = users[userIndex];

    if (!user.hashedPin) {
      return NextResponse.json({ message: 'PIN not set for this user. Please contact support or re-register if this is an old account.' }, { status: 403 });
    }

    const isPinValid = await bcrypt.compare(pin, user.hashedPin);
    if (!isPinValid) {
      return NextResponse.json({ message: 'Invalid PIN' }, { status: 401 });
    }

    if (amount > user.bankBalance) {
      return NextResponse.json({ message: 'Insufficient bank balance' }, { status: 400 });
    }

    // All checks passed, proceed with debiting bank balance
    const newBankBalance = user.bankBalance - amount;
    users[userIndex].bankBalance = newBankBalance;
    saveUsersToFile();

    console.log(`Funds added to wallet for user ${userId}: ${amount}. New bank balance: ${newBankBalance}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Funds successfully processed. Coin wallet will be updated client-side.',
      newBankBalance: newBankBalance,
      creditedCoinAmount: amount 
    }, { status: 200 });

  } catch (error) {
    console.error('Error in add-funds-to-wallet:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
