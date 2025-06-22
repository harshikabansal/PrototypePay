
// src/lib/bankTransferStore.ts - For "Transfer to Bank" transactions
import { encryptData, decryptData } from './crypto';

export interface BankTransferRecord {
  id: string;
  userId: string; // The user who initiated the transfer
  userUpiId: string; // The UPI ID of the user (for display)
  amount: number; // Amount transferred (will be negative as it's a debit)
  timestamp: number;
  status: 'completed' | 'failed'; // Assuming fraud check could lead to 'failed'
}

const BANK_TRANSFERS_STORAGE_KEY_PREFIX = 'coinSendBankTransfers_';

// In-memory store, synced with localStorage for the current user
let userBankTransfers: Record<string, BankTransferRecord> = {};

const getStorageKey = (userId: string) => `${BANK_TRANSFERS_STORAGE_KEY_PREFIX}${userId}`;

export const loadBankTransfersForUser = (userId: string) => {
  if (typeof window !== 'undefined' && userId) {
    try {
      const stored = localStorage.getItem(getStorageKey(userId));
      if (stored) {
        // Decrypt the data
        const decryptedData = decryptData(stored);
        userBankTransfers = typeof decryptedData === 'object' && decryptedData !== null ? decryptedData : {};
      } else {
        userBankTransfers = {};
      }
    } catch (e) {
      console.error("Error loading or decrypting bank transfers from localStorage", e);
      userBankTransfers = {};
    }
  } else {
    userBankTransfers = {}; // Clear if no user or not in browser
  }
  return Object.values(userBankTransfers).sort((a, b) => b.timestamp - a.timestamp);
};

const saveBankTransfersForUser = (userId: string) => {
  if (typeof window !== 'undefined' && userId) {
    // Encrypt before saving
    localStorage.setItem(getStorageKey(userId), encryptData(JSON.stringify(userBankTransfers)));
  }
};

export const addBankTransfer = (transferData: Omit<BankTransferRecord, 'id' | 'timestamp'>): BankTransferRecord => {
  const now = Date.now();
  const id = `${now}-${Math.random().toString(36).substring(2, 8)}`; // Simple unique ID
  const newTransfer: BankTransferRecord = {
    ...transferData,
    id,
    timestamp: now,
  };
  userBankTransfers[id] = newTransfer;
  saveBankTransfersForUser(transferData.userId);
  console.log("Bank Transfer Logged:", newTransfer);
  return newTransfer;
};

// Typically, bank transfers wouldn't be 'cancelled' from this simple log in the same way an OTP is.
// They are more of a record of an attempt.
