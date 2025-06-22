
// src/app/api/transactions/otp/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cancelOtpTransaction_serverSide } from '@/lib/otpTransactions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { otp, transactionId, initiatingUserUpiId } = body;

    if (!otp || !transactionId || !initiatingUserUpiId) {
      return NextResponse.json({ message: 'Missing OTP, Transaction ID, or initiating user UPI ID' }, { status: 400 });
    }

    // The server-side function will handle the logic of changing status.
    // It should no longer return 'transactionAmount' for refund purposes, as debit is deferred.
    const result = cancelOtpTransaction_serverSide(otp, transactionId, initiatingUserUpiId);

    if (result.success) {
      // Only message is needed now, no amount for refund.
      return NextResponse.json({ success: true, message: result.message }, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 }); 
    }
  } catch (error) {
    console.error('Error in /api/transactions/otp/cancel:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
