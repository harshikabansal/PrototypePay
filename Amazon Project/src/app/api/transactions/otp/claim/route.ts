
// src/app/api/transactions/otp/claim/route.ts
// Adapted for QR flow: 'otp' and 'transactionId' from client are the same (txid from QR)
import { NextRequest, NextResponse } from 'next/server';
import { claimOtpTransaction_serverSide } from '@/lib/otpTransactions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
     // For QR flow, 'otp' and 'transactionId' sent by client are the same (the txid from QR)
    const { otp, transactionId, claimingUserUpiId } = body;

    if (!transactionId || !claimingUserUpiId) {
      return NextResponse.json({ message: 'Missing Transaction ID or claiming user UPI ID' }, { status: 400 });
    }

    // The `otp` param to claimOtpTransaction_serverSide will be the transactionId for QR flow
    const result = claimOtpTransaction_serverSide(transactionId, transactionId, claimingUserUpiId);

    if (result.success) {
      return NextResponse.json(result, { status: 200 });
    } else {
      return NextResponse.json(result, { status: 400 }); 
    }
  } catch (error) {
    console.error('Error in /api/transactions/otp/claim:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
