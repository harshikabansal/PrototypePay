
// src/app/api/user/update-bank-balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { users, saveUsersToFile, ensureUsersAreLoaded } from '@/lib/userStore';

export async function POST(req: NextRequest) {
  ensureUsersAreLoaded();

  try {
    const body = await req.json();
    const { userId, amountToAddTobank, pin } = body;

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }
    if (typeof amountToAddTobank !== 'number' || isNaN(amountToAddTobank) || amountToAddTobank <= 0) {
      return NextResponse.json({ message: 'Invalid amount provided for bank transfer' }, { status: 400 });
    }
    if (!pin || typeof pin !== 'string' || pin.length !== 4) {
      return NextResponse.json({ message: 'Valid 4-digit PIN is required' }, { status: 400 });
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
      return NextResponse.json({ success: false, message: 'Invalid PIN' }, { status: 401 });
    }

    // PIN is valid, proceed to update bank balance
    const newBankBalance = user.bankBalance + amountToAddTobank;
    users[userIndex].bankBalance = newBankBalance;
    saveUsersToFile();

    console.log(`Updated bank balance for user ${userId} to ${newBankBalance} after coin transfer.`);

    // Return the updated user object (excluding sensitive fields)
    const { hashedPassword, hashedPin, ...userToReturn } = users[userIndex];

    return NextResponse.json({ 
      success: true, 
      message: 'Bank balance updated successfully after coin transfer.', 
      updatedUser: userToReturn
    }, { status: 200 });

  } catch (error) {
    console.error('Error updating bank balance during coin transfer:', error);
    return NextResponse.json({ success: false, message: 'Internal server error during bank balance update' }, { status: 500 });
  }
}
