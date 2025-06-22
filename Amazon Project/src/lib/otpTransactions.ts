
// src/lib/otpTransactions.ts - Server-Side OTP/Transaction Management (now QR-based Transaction ID focused)
import fs from 'fs';
import path from 'path';

export interface OfflineOtpTransaction {
  otp: string; // This will store the transactionId from QR
  transactionId: string; // Primary identifier from QR
  senderUpiId: string;
  recipientUpiId: string;
  amount: number;
  status: 'pending' | 'claimed' | 'expired' | 'cancelled';
  createdAt: number;
  expiresAt: number;
}

const OTP_TRANSACTIONS_FILE_PATH = path.join(process.cwd(), 'persisted_otp_transactions.json');

// Store transactions by transactionId for QR flow
let transactions: Record<string, OfflineOtpTransaction> = {}; 

function loadTransactionsFromFile(): void {
  try {
    if (fs.existsSync(OTP_TRANSACTIONS_FILE_PATH)) {
      const fileData = fs.readFileSync(OTP_TRANSACTIONS_FILE_PATH, 'utf-8');
      if (fileData.trim() === "") {
        transactions = {};
      } else {
        transactions = JSON.parse(fileData);
      }
      Object.keys(transactions).forEach(key => {
        const tx = transactions[key];
        if (tx.status === 'pending' && Date.now() > tx.expiresAt) {
          transactions[key].status = 'expired';
        }
      });
    } else {
      fs.writeFileSync(OTP_TRANSACTIONS_FILE_PATH, JSON.stringify({}), 'utf-8');
      transactions = {};
    }
  } catch (error) {
    console.error('Error loading or parsing OTP (QR TxID) transactions from file:', OTP_TRANSACTIONS_FILE_PATH, error);
    transactions = {};
  }
}

function saveTransactionsToFile(): void {
  try {
    fs.writeFileSync(OTP_TRANSACTIONS_FILE_PATH, JSON.stringify(transactions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving OTP (QR TxID) transactions to file:', OTP_TRANSACTIONS_FILE_PATH, error);
  }
}

loadTransactionsFromFile();

setInterval(() => {
  let changed = false;
  loadTransactionsFromFile();
  Object.keys(transactions).forEach(key => {
    if (transactions[key].status === 'pending' && Date.now() > transactions[key].expiresAt) {
      transactions[key].status = 'expired';
      changed = true;
    }
  });
  if (changed) {
    saveTransactionsToFile();
  }
}, 60 * 1000);


// For QR flow, 'otp' parameter is the transactionId from QR.
export function addOtpTransaction_serverSide(txData: {
  otp: string; // This is the transactionId from QR
  transactionId: string; // This is also the transactionId from QR
  senderUpiId: string;
  recipientUpiId: string;
  amount: number;
  expiresInMs?: number;
  createdAt?: number; // Accept client-provided timestamp
}): OfflineOtpTransaction | null {
  loadTransactionsFromFile();
  const now = Date.now();
  // Use client's timestamp if provided and valid, otherwise fallback to server's time
  const creationTime = txData.createdAt && typeof txData.createdAt === 'number' ? txData.createdAt : now;
  const expiresIn = txData.expiresInMs || 10 * 60 * 1000; // 10 minutes default
  
  if (transactions[txData.transactionId]) {
    console.warn("Server: Attempted to add transaction with duplicate Transaction ID (overwriting):", txData.transactionId);
  }

  const newTransaction: OfflineOtpTransaction = {
    otp: txData.transactionId,
    transactionId: txData.transactionId,
    senderUpiId: txData.senderUpiId,
    recipientUpiId: txData.recipientUpiId,
    amount: txData.amount,
    status: 'pending',
    createdAt: creationTime, // Use the determined creation time
    expiresAt: creationTime + expiresIn, // Base expiry on creation time
  };
  transactions[newTransaction.transactionId] = newTransaction;
  saveTransactionsToFile();
  console.log("Server: QR-based Transaction Logged:", newTransaction);
  return newTransaction;
}

export function getOtpTransactionsForUser_serverSide(userUpiId: string): OfflineOtpTransaction[] {
  loadTransactionsFromFile();
  return Object.values(transactions)
    .filter(tx => tx.senderUpiId.toLowerCase() === userUpiId.toLowerCase() || tx.recipientUpiId.toLowerCase() === userUpiId.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);
}

// For QR flow, 'otp' and 'transactionId' parameters from client will both be the transactionId from QR.
export function claimOtpTransaction_serverSide(
  otpOrTxIdFromQr: string, // This is the transactionId from QR
  transactionIdFromQr: string, // This is also the transactionId from QR
  claimingUserUpiId: string
): { success: boolean; message: string; transaction?: OfflineOtpTransaction } {
  loadTransactionsFromFile();
  const tx = transactions[transactionIdFromQr]; // Lookup by transactionId

  if (!tx) return { success: false, message: "Invalid Transaction ID." };
  
  if (tx.status === 'claimed') return { success: false, message: "This transaction has already been claimed." };
  
  if (tx.status === 'pending' && Date.now() > tx.expiresAt) {
    tx.status = 'expired'; 
  }
  
  if (tx.status === 'expired') return { success: false, message: "Transaction ID has expired." };
  if (tx.status === 'cancelled') return { success: false, message: "This transaction has been cancelled by the sender." };

  if (tx.recipientUpiId.toLowerCase() !== claimingUserUpiId.toLowerCase()) {
     return { success: false, message: "This transaction is not intended for you."};
  }

  if (tx.status === 'pending') {
    tx.status = 'claimed';
    saveTransactionsToFile();
    console.log("Server: QR Transaction Claimed:", tx);
    return { success: true, message: "Coins received successfully via QR!", transaction: tx };
  } else {
    return { success: false, message: `Transaction is not in a claimable state (current status: ${tx.status}).` };
  }
}

// For QR flow, 'otp' and 'transactionId' parameters from client will both be the transactionId from QR.
export function cancelOtpTransaction_serverSide(
  otpOrTxIdFromQr: string, // This is the transactionId from QR
  transactionIdFromQr: string, // This is also the transactionId from QR
  initiatingUserUpiId: string
): { success: boolean; message: string } {
  loadTransactionsFromFile();
  const tx = transactions[transactionIdFromQr]; // Lookup by transactionId

  if (!tx) return { success: false, message: "Invalid Transaction ID." };

  if (tx.senderUpiId.toLowerCase() !== initiatingUserUpiId.toLowerCase()) {
    return { success: false, message: "You are not authorized to cancel this transaction." };
  }
  if (tx.status === 'claimed') return { success: false, message: "Transaction has already been claimed and cannot be cancelled." };
  if (tx.status === 'expired') return { success: false, message: "Transaction has already expired." };
  if (tx.status === 'cancelled') return { success: false, message: "Transaction has already been cancelled."};
  
  if (tx.status === 'pending') {
    tx.status = 'cancelled';
    saveTransactionsToFile();
    console.log("Server: QR Transaction Cancelled:", tx);
    return { success: true, message: "Transaction has been cancelled." };
  } else {
    return { success: false, message: `Only pending transactions can be cancelled (current status: ${tx.status}).`};
  }
}
