
// src/app/api/transactions/otp/create/route.ts
// Adapted for QR flow: 'otp' and 'transactionId' from client are the same (txid from QR)
import { NextRequest, NextResponse } from 'next/server';
import { addOtpTransaction_serverSide, type OfflineOtpTransaction } from '@/lib/otpTransactions';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // For QR flow, 'otp' and 'transactionId' sent by client are the same (the txid from QR)
    // Accept createdAt from the client to ensure correct timestamping
    const { otp, transactionId, senderUpiId, recipientUpiId, amount, createdAt } = body;

    if (!transactionId || !senderUpiId || !recipientUpiId || amount === undefined) {
      return NextResponse.json({ message: 'Missing required transaction details (txId, sender, recipient, amount)' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ message: 'Invalid amount' }, { status: 400 });
    }

    // The `otp` field in addOtpTransaction_serverSide will store the transactionId for QR flow.
    const newTransaction = addOtpTransaction_serverSide({
      otp: transactionId,
      transactionId,
      senderUpiId,
      recipientUpiId,
      amount,
      createdAt, // Pass client's timestamp to the server-side function
    });

    if (newTransaction) {
      return NextResponse.json({ success: true, transaction: newTransaction }, { status: 201 });
    } else {
      return NextResponse.json({ message: 'Failed to create transaction record on server' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in /api/transactions/otp/create:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
