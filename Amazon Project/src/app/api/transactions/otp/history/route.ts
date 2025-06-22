
// src/app/api/transactions/otp/history/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getOtpTransactionsForUser_serverSide } from '@/lib/otpTransactions';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userUpiId = searchParams.get('userUpiId');

    if (!userUpiId) {
      return NextResponse.json({ message: 'userUpiId query parameter is required' }, { status: 400 });
    }

    const transactions = getOtpTransactionsForUser_serverSide(userUpiId);
    return NextResponse.json(transactions, { status: 200 });
  } catch (error) {
    console.error('Error in /api/transactions/otp/history:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
