
"use client";

import type React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { encryptData, decryptData } from '@/lib/crypto'; // Import encryption utils

interface User {
  id: string;
  email: string;
  fullName?: string;
  phoneNumber?: string;
  upiId?: string;
  profilePictureUrl?: string;
  bankBalance: number;
}

export type LocalPendingTransactionStatus = 
  | 'pending_qr_scan_confirmation' 
  | 'failed_attempt'               
  | 'confirmed_with_server' // Indicates successful claim & server sync, or optimistic local credit + server sync attempt
  | 'locally_credited_offline_pending_server_sync' // Receiver claimed offline, coins in main wallet, needs server sync
  | 'claim_rejected_by_server_funds_reverted'      // Server rejected, local credit (if any) was reversed
  | 'critical_reversal_failed_contact_support';    // Server rejected, local credit reversal FAILED

export interface LocalPendingTransaction {
  localId: string;
  otpOrTxId: string; 
  senderUpiId?: string; 
  amountEnteredOffline: number; 
  timestampAdded: number;
  status: LocalPendingTransactionStatus;
  lastAttemptMessage?: string;
}

export interface LocalDebitRecord {
  id: string; // This is the transactionId
  amount: number;
  timestamp: number;
  senderUpiId: string;
  recipientUpiId: string; 
}

interface AppContextType {
  isAuthenticated: boolean;
  user: User | null;
  balance: number;
  pendingReceivedBalance: number; 
  localPendingTransactions: LocalPendingTransaction[];
  getLocalDebitRecords: () => LocalDebitRecord[];
  addLocalDebitRecord: (record: LocalDebitRecord) => void;
  updateLocalDebitRecords: (records: LocalDebitRecord[]) => void;
  loginWithApi: (email: string, password: string) => Promise<void>;
  logout: () => void;
  registerWithApi: (email: string, password: string, fullName: string, phoneNumber: string, pin: string, profilePictureUrl?: string) => Promise<void>;
  updateBalance: (amount: number, type: 'add' | 'subtract') => boolean;
  setBalance: (newBalance: number) => void;
  updateContextUserBankBalance: (newServerBankBalance: number) => void;
  addLocalPendingTransaction: (details: { otpOrTxId: string; amount: number; senderUpiId?: string, initialStatus?: LocalPendingTransactionStatus }) => string | null;
  attemptClaimPendingTransaction: (localId: string) => Promise<void>; 
  removeLocalPendingTransaction: (localId: string) => void; 
  dismissStuckLocalPendingTransaction: (localId: string) => void;
  updateLocalPendingTransactionStatus: (localId: string, newStatus: LocalPendingTransactionStatus, message?: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'coinSendUser';
const BALANCE_STORAGE_KEY_PREFIX = 'coinSendBalance_';
const LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX = 'coinSendLocalPendingTransactions_';
const LOCAL_DEBIT_RECORDS_KEY_PREFIX = 'prototypePayLocalDebitRecords_';

const DEFAULT_COIN_BALANCE = 0;

const roundToTwoDecimals = (num: number): number => {
  if (typeof num !== 'number' || isNaN(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};


export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [balance, setBalanceState] = useState<number>(0);
  const [localPendingTransactions, setLocalPendingTransactionsState] = useState<LocalPendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAutoProcessingPendingClaims, setIsAutoProcessingPendingClaims] = useState(false);
  const [isAutoProcessingSenderSyncs, setIsAutoProcessingSenderSyncs] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const pendingReceivedBalance = localPendingTransactions
    .filter(tx => tx.status === 'pending_qr_scan_confirmation' || tx.status === 'failed_attempt' || tx.status === 'locally_credited_offline_pending_server_sync')
    .reduce((sum, tx) => sum + tx.amountEnteredOffline, 0);


  useEffect(() => {
    setLoading(true);
    const storedUserString = localStorage.getItem(USER_STORAGE_KEY);
    if (storedUserString) {
      try {
        const storedUser: User = decryptData(storedUserString);
        if (!storedUser || !storedUser.id) {
          throw new Error("Decrypted data is not a valid user object.");
        }
        setUser(storedUser);

        const userBalanceKey = BALANCE_STORAGE_KEY_PREFIX + storedUser.id;
        const storedBalanceString = localStorage.getItem(userBalanceKey);
        try {
            const decryptedBalance = storedBalanceString ? decryptData(storedBalanceString) : null;
            setBalanceState(decryptedBalance ? roundToTwoDecimals(parseFloat(decryptedBalance)) : DEFAULT_COIN_BALANCE);
        } catch (e) {
            console.error("Failed to decrypt balance, resetting to default.", e);
            setBalanceState(DEFAULT_COIN_BALANCE);
        }
        
        const pendingTxKey = LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + storedUser.id;
        const storedPendingTxString = localStorage.getItem(pendingTxKey);
        try {
            const decryptedTxs = storedPendingTxString ? decryptData(storedPendingTxString) : [];
            setLocalPendingTransactionsState(Array.isArray(decryptedTxs) ? decryptedTxs : []);
        } catch(e) {
            console.error("Failed to decrypt pending transactions, resetting to empty.", e);
            setLocalPendingTransactionsState([]);
        }

      } catch (error) {
        console.error("Could not decrypt user data. Clearing stale storage.", error);
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        setBalanceState(0);
        setLocalPendingTransactionsState([]);
      }
    } else {
        setUser(null);
        setBalanceState(0);
        setLocalPendingTransactionsState([]);
    }
    setLoading(false);
  }, []); 

  const loginWithApi = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Login failed and couldn't parse error."}));
      throw new Error(errorData.message || 'Login failed');
    }

    const { user: apiUser }: { user: User } = await response.json();
    if (!apiUser || !apiUser.id || typeof apiUser.bankBalance === 'undefined') {
        toast({variant: "destructive", title: "Login Error", description: "Received incomplete user data from server."})
        throw new Error("Login response did not include a valid user with ID and bankBalance.");
    }
    setUser(apiUser);
    localStorage.setItem(USER_STORAGE_KEY, encryptData(JSON.stringify(apiUser)));

    const userBalanceKey = BALANCE_STORAGE_KEY_PREFIX + apiUser.id;
    setBalanceState(DEFAULT_COIN_BALANCE); // Reset on new login
    localStorage.setItem(userBalanceKey, encryptData(DEFAULT_COIN_BALANCE.toString()));

    const pendingTxKey = LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + apiUser.id;
    setLocalPendingTransactionsState([]);
    localStorage.setItem(pendingTxKey, encryptData(JSON.stringify([])));

    const debitRecordsKey = LOCAL_DEBIT_RECORDS_KEY_PREFIX + apiUser.id;
    localStorage.setItem(debitRecordsKey, encryptData(JSON.stringify([])));


    router.push('/dashboard');
  }, [router, toast]);

  const registerWithApi = useCallback(async (email: string, password: string, fullName: string, phoneNumber: string, pin: string, profilePictureUrl?: string): Promise<void> => {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, fullName, phoneNumber, pin, confirmPassword: password, confirmPin: pin, profilePictureUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: "Registration failed and couldn't parse error."}));
      throw new Error(errorData.message || 'Registration failed');
    }

    const { user: newUserFromApi }: { user: User } = await response.json();
     if (!newUserFromApi || !newUserFromApi.id || typeof newUserFromApi.bankBalance === 'undefined') {
        toast({variant: "destructive", title: "Registration Error", description: "Received incomplete user data from server after registration."})
        throw new Error("Registration response did not include a valid user with ID and bankBalance.");
    }
    setUser(newUserFromApi);
    localStorage.setItem(USER_STORAGE_KEY, encryptData(JSON.stringify(newUserFromApi)));

    setBalanceState(DEFAULT_COIN_BALANCE);
    localStorage.setItem(BALANCE_STORAGE_KEY_PREFIX + newUserFromApi.id, encryptData(DEFAULT_COIN_BALANCE.toString()));

    setLocalPendingTransactionsState([]);
    localStorage.setItem(LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + newUserFromApi.id, encryptData(JSON.stringify([])));

    localStorage.setItem(LOCAL_DEBIT_RECORDS_KEY_PREFIX + newUserFromApi.id, encryptData(JSON.stringify([])));


    router.push('/dashboard');
  }, [router, toast]);

  const logout = useCallback(() => {
    const currentUserId = user?.id; 
    setUser(null);
    setBalanceState(0);
    setLocalPendingTransactionsState([]);
    localStorage.removeItem(USER_STORAGE_KEY);
    if (currentUserId) {
        localStorage.removeItem(BALANCE_STORAGE_KEY_PREFIX + currentUserId);
        localStorage.removeItem(LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + currentUserId);
        localStorage.removeItem(LOCAL_DEBIT_RECORDS_KEY_PREFIX + currentUserId);
    }
    router.push('/login');
  }, [router, user?.id]);


  const updateBalance = useCallback((amount: number, type: 'add' | 'subtract'): boolean => {
    if (!user || !user.id) {
        console.error("AppContext: User not identified for coin balance update.");
        toast({ variant: "destructive", title: "Internal Error", description: "User session error. Cannot update coin balance." });
        return false;
    }
    const validatedAmount = roundToTwoDecimals(amount);
    if (typeof validatedAmount !== 'number' || isNaN(validatedAmount) || validatedAmount < 0) {
        console.error(`AppContext: Invalid amount for coin balance update: ${validatedAmount}`);
        toast({ variant: "destructive", title: "Internal Error", description: `Invalid transaction amount: ${validatedAmount}` });
        return false;
    }
    if (validatedAmount === 0 && type === 'subtract') { 
        return true; 
    }

    let success = true;
    setBalanceState(prevBalance => {
      const currentRoundedBalance = roundToTwoDecimals(prevBalance);
      let newBalance;
      if (type === 'add') {
        newBalance = roundToTwoDecimals(currentRoundedBalance + validatedAmount);
      } else {
        if (currentRoundedBalance < validatedAmount) {
          console.warn(`AppContext: Insufficient coin balance for subtraction. Current: ${currentRoundedBalance}, Tried to subtract: ${validatedAmount}`);
          toast({ variant: "destructive", title: "Coin Balance Error", description: "Insufficient coin funds for this operation." });
          success = false;
          return currentRoundedBalance;
        }
        newBalance = roundToTwoDecimals(currentRoundedBalance - validatedAmount);
      }
      localStorage.setItem(BALANCE_STORAGE_KEY_PREFIX + user.id, encryptData(newBalance.toString()));
      return newBalance;
    });
    return success;
  }, [user, toast]);

  const setBalance = useCallback((newBalance: number) => {
    if (!user || !user.id) {
        console.error("AppContext: User not identified for setting coin balance.");
        toast({ variant: "destructive", title: "Internal Error", description: "User session error. Cannot set coin balance." });
        return;
    }
    const roundedNewBalance = roundToTwoDecimals(newBalance);
    if (typeof roundedNewBalance !== 'number' || isNaN(roundedNewBalance) || roundedNewBalance < 0) {
        console.error(`AppContext: Invalid new coin balance value: ${roundedNewBalance}`);
        toast({ variant: "destructive", title: "Internal Error", description: `Invalid coin balance value specified.` });
        return;
    }
    setBalanceState(roundedNewBalance);
    localStorage.setItem(BALANCE_STORAGE_KEY_PREFIX + user.id, encryptData(roundedNewBalance.toString()));
  }, [user, toast]);

  const updateContextUserBankBalance = useCallback((newServerBankBalance: number) => {
    const roundedBankBalance = roundToTwoDecimals(newServerBankBalance);
    if (typeof roundedBankBalance !== 'number' || isNaN(roundedBankBalance) || roundedBankBalance < 0) {
        console.error(`AppContext: Invalid new bank balance value from server: ${roundedBankBalance}`);
        toast({ variant: "destructive", title: "Bank Balance Update Error", description: "Received invalid bank balance from server." });
        return;
    }
    setUser(prevUser => {
        if (!prevUser) return null;
        const updatedUser = { ...prevUser, bankBalance: roundedBankBalance };
        localStorage.setItem(USER_STORAGE_KEY, encryptData(JSON.stringify(updatedUser)));
        return updatedUser;
    });
  }, [toast]);


  const addLocalPendingTransaction = useCallback((details: { otpOrTxId: string; amount: number; senderUpiId?: string, initialStatus?: LocalPendingTransactionStatus }) => {
    if (!user || !user.id) {
      toast({ variant: "destructive", title: "User Error", description: "Cannot add pending transaction: User not identified. Please relogin." });
      return null;
    }
    const roundedAmount = roundToTwoDecimals(details.amount);
    if (typeof roundedAmount !== 'number' || isNaN(roundedAmount) || roundedAmount <= 0) {
      toast({ variant: "destructive", title: "Input Error", description: "Invalid amount for pending transaction. Amount must be positive." });
      return null;
    }
    const localId = `${Date.now()}-${details.otpOrTxId}`;
    const newPendingTx: LocalPendingTransaction = {
      localId: localId, 
      otpOrTxId: details.otpOrTxId,
      senderUpiId: details.senderUpiId,
      amountEnteredOffline: roundedAmount,
      timestampAdded: Date.now(),
      status: details.initialStatus || 'pending_qr_scan_confirmation', 
    };

    setLocalPendingTransactionsState(prev => {
      const existing = prev.find(tx => tx.otpOrTxId === newPendingTx.otpOrTxId && tx.status !== 'confirmed_with_server' && tx.status !== 'claim_rejected_by_server_funds_reverted' && tx.status !== 'critical_reversal_failed_contact_support'); 
      if (existing) {
        console.log("Tx already in a non-final state, not re-adding:", existing.otpOrTxId);
        return prev; 
      }
      const updatedTxs = [...prev, newPendingTx];
      localStorage.setItem(LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + user.id, encryptData(JSON.stringify(updatedTxs)));
      return updatedTxs;
    });
    return localId;
  }, [user, toast]);


  const updateLocalPendingTransactionStatus = useCallback((localId: string, newStatus: LocalPendingTransactionStatus, message?: string) => {
    if (!user || !user.id) return;
    setLocalPendingTransactionsState(prev => {
        const updatedTxs = prev.map(tx => 
            tx.localId === localId 
            ? { ...tx, status: newStatus, lastAttemptMessage: message || tx.lastAttemptMessage } 
            : tx
        );
        localStorage.setItem(LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + user.id, encryptData(JSON.stringify(updatedTxs)));
        return updatedTxs;
    });
  }, [user]);


  const removeLocalPendingTransaction = useCallback((localId: string) => {
    if (!user || !user.id) {
        console.error("AppContext: User not identified for removing pending transaction.");
        return;
    }
    setLocalPendingTransactionsState(prev => {
        const updatedTxs = prev.filter(tx => tx.localId !== localId);
        localStorage.setItem(LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + user.id, encryptData(JSON.stringify(updatedTxs)));
        return updatedTxs;
    });
  }, [user]);

  const dismissStuckLocalPendingTransaction = useCallback((localId: string) => {
    if (!user || !user.id) {
      toast({ variant: "destructive", title: "User Error", description: "Cannot dismiss pending transaction: User not identified." });
      return;
    }
    const txToDismiss = localPendingTransactions.find(tx => tx.localId === localId);

    if (txToDismiss) {
       toast({ title: "Pending Item Dismissed", description: `Item ${txToDismiss.otpOrTxId} (status: ${txToDismiss.status}) removed from view. This does not affect server records or already processed credits/debits.` });
    }
    
    setLocalPendingTransactionsState(prev => {
      const updatedTxs = prev.filter(tx => tx.localId !== localId);
      localStorage.setItem(LOCAL_PENDING_TRANSACTIONS_KEY_PREFIX + user.id, encryptData(JSON.stringify(updatedTxs)));
      return updatedTxs;
    });
  }, [user, toast, localPendingTransactions]);

  const attemptClaimPendingTransaction = useCallback(async (localId: string) => {
    if (!user || !user.upiId || !user.id) {
      updateLocalPendingTransactionStatus(localId, 'failed_attempt', "User UPI ID not found. Cannot claim. Please relogin.");
      toast({ variant: "destructive", title: "User Error", description: "User UPI ID not found. Cannot claim. Please relogin." });
      return;
    }

    const txToClaim = localPendingTransactions.find(tx => tx.localId === localId);
    if (!txToClaim || txToClaim.status === 'confirmed_with_server') {
      console.log(`AppContext: attemptClaimPendingTransaction: tx with localId ${localId} not found or already confirmed.`);
      return;
    }

    // Handle OFFLINE "Claim" click from Pending Wallet
    if (!navigator.onLine) {
        const isEligibleForOfflineLocalCredit = (txToClaim.status === 'pending_qr_scan_confirmation' || txToClaim.status === 'failed_attempt');
        if (isEligibleForOfflineLocalCredit) {
            const localCreditSuccess = updateBalance(txToClaim.amountEnteredOffline, 'add');
            if (localCreditSuccess) {
            updateLocalPendingTransactionStatus(localId, 'locally_credited_offline_pending_server_sync', 'Locally credited while offline.');
            toast({
                title: "Coins Locally Credited (Offline)",
                description: `${txToClaim.amountEnteredOffline.toFixed(2)} coins added to your main wallet. Will sync with server when online.`,
            });
            } else {
            updateLocalPendingTransactionStatus(localId, 'failed_attempt', 'Failed to credit coins locally (offline attempt).');
            toast({ variant: "destructive", title: "Local Credit Failed", description: "Could not add coins to your local wallet. Please check your balance." });
            }
        } else if (txToClaim.status === 'locally_credited_offline_pending_server_sync') {
            toast({ title: "Offline", description: "Already locally credited. Waiting for online connection to sync with server."});
        }
        return; 
    }

    // Handle ONLINE "Claim" click or automatic online sync
    // Immediately credit locally, then notify server.
    const alreadyCredited = txToClaim.status === 'locally_credited_offline_pending_server_sync' || txToClaim.status === 'confirmed_with_server';
    
    if (!alreadyCredited) {
        const localCreditSuccess = updateBalance(txToClaim.amountEnteredOffline, 'add');
        if (!localCreditSuccess) {
            updateLocalPendingTransactionStatus(localId, 'failed_attempt', 'Online claim: Failed to credit coins to local wallet.');
            toast({ variant: "destructive", title: "Local Credit Failed (Online)", description: "Could not add coins to your local wallet for claim." });
            return;
        }
    }

    updateLocalPendingTransactionStatus(localId, 'confirmed_with_server', 'Coins credited. Syncing claim with server...');
    if (!alreadyCredited) {
        toast({
            title: "Coins Credited to Main Wallet!",
            description: `${txToClaim.amountEnteredOffline.toFixed(2)} coins added. Attempting to notify server.`,
        });
    } else {
        // Silent on resync unless there's an error
    }
    
    // Now, attempt to notify the server (fire-and-forget for local balance)
    try {
      const response = await fetch('/api/transactions/otp/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp: txToClaim.otpOrTxId, 
          transactionId: txToClaim.otpOrTxId,
          claimingUserUpiId: user.upiId,
        }),
      });
      
      const result = await response.json();
      if (response.ok && result.success) {
        toast({
            title: "Claim Synced with Server!",
            description: `Claim for TxID ${txToClaim.otpOrTxId} successfully recorded by the server.`,
        });
      } else { // Server had an issue with the claim.
        let serverMessage = result.message || `Server error: ${response.status} for TxID ${txToClaim.otpOrTxId}`;
        toast({
            variant: "destructive",
            title: "Server Sync Warning",
            description: `Coins remain credited locally. Server did not confirm claim for TxID ${txToClaim.otpOrTxId}: ${serverMessage}. This may lead to discrepancies if the sender didn't finalize. A future reconciliation might reverse this credit.`,
            duration: 10000,
        });
      }
    } catch (error: any) { // Network error
        toast({ 
            title: "Server Sync Issue (Network)", 
            description: `Coins remain credited locally. Network error syncing claim for TxID ${txToClaim.otpOrTxId}. App will retry sync later.`, 
            duration: 7000 
        });
    }
  }, [user, localPendingTransactions, updateBalance, toast, updateLocalPendingTransactionStatus]);


  const getLocalDebitRecords = useCallback((): LocalDebitRecord[] => {
    if (!user || !user.id || typeof window === 'undefined') return [];
    const key = `${LOCAL_DEBIT_RECORDS_KEY_PREFIX}${user.id}`;
    const stored = localStorage.getItem(key);
    try {
      return stored ? decryptData(stored) : [];
    } catch (e) {
      console.error("Error decrypting local debit records:", e);
      localStorage.removeItem(key); 
      return [];
    }
  }, [user]);

  const addLocalDebitRecord = useCallback((record: LocalDebitRecord) => {
    if (!user || !user.id || typeof window === 'undefined') return;
    if (!user.upiId || record.senderUpiId.toLowerCase() !== user.upiId.toLowerCase()) {
        console.warn("Attempted to add local debit record for a different user UPI ID. Aborting.");
        toast({variant: "destructive", title: "Internal Error", description: "Debit record UPI ID mismatch."});
        return;
    }
    const key = `${LOCAL_DEBIT_RECORDS_KEY_PREFIX}${user.id}`;
    const records = getLocalDebitRecords();
    const completeRecord: LocalDebitRecord = { 
        id: record.id,
        amount: roundToTwoDecimals(record.amount),
        timestamp: record.timestamp,
        senderUpiId: record.senderUpiId,
        recipientUpiId: record.recipientUpiId, 
    };

    if (!records.find(r => r.id === completeRecord.id)) { 
        records.push(completeRecord);
        localStorage.setItem(key, encryptData(JSON.stringify(records)));
    } else {
        console.warn("Attempted to add duplicate local debit record for txId:", completeRecord.id);
    }
  }, [user, getLocalDebitRecords, toast]);

  const updateLocalDebitRecords = useCallback((updatedRecords: LocalDebitRecord[]) => {
    if (!user || !user.id || typeof window === 'undefined') return;
    const key = `${LOCAL_DEBIT_RECORDS_KEY_PREFIX}${user.id}`;
    const roundedRecords = updatedRecords.map(record => ({
        ...record, 
        amount: roundToTwoDecimals(record.amount)
    }));
    localStorage.setItem(key, encryptData(JSON.stringify(roundedRecords)));
  }, [user]);


  const processPendingClaims = useCallback(async () => {
    if (isAutoProcessingPendingClaims || !navigator.onLine || !user || !user.id || localPendingTransactions.length === 0) {
      return;
    }

    const claimableTransactions = localPendingTransactions.filter(
      tx => tx.status === 'pending_qr_scan_confirmation' || tx.status === 'failed_attempt' || tx.status === 'locally_credited_offline_pending_server_sync'
    );

    if (claimableTransactions.length === 0) {
      return;
    }
    
    setIsAutoProcessingPendingClaims(true);
    try {
      for (const tx of claimableTransactions) {
        await new Promise(resolve => setTimeout(resolve, 500)); 
        await attemptClaimPendingTransaction(tx.localId);
      }
    } catch (error) {
        console.error("AppContext: Error during automatic processing of pending claims:", error);
    } finally {
        setIsAutoProcessingPendingClaims(false);
    }
  }, [user, localPendingTransactions, attemptClaimPendingTransaction, isAutoProcessingPendingClaims]);

  const processSenderSyncs = useCallback(async () => {
    if (isAutoProcessingSenderSyncs || !navigator.onLine || !user || !user.id) {
        return;
    }
    const localDebits = getLocalDebitRecords();
    if (localDebits.length === 0) {
        return;
    }

    setIsAutoProcessingSenderSyncs(true);
    let updatedDebits = [...localDebits];

    for (const debit of localDebits) {
        if (!debit.recipientUpiId) { 
            console.warn(`Skipping sender sync for debit ${debit.id} due to missing recipientUpiId.`);
            continue;
        }
        try {
            await new Promise(resolve => setTimeout(resolve, 500)); 
            const response = await fetch('/api/transactions/otp/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    otp: debit.id,
                    transactionId: debit.id,
                    senderUpiId: debit.senderUpiId,
                    recipientUpiId: debit.recipientUpiId,
                    amount: debit.amount,
                    createdAt: debit.timestamp, // Pass the client's timestamp
                }),
            });

            if (response.ok) { 
                toast({ title: "Offline Transaction Synced", description: `Your initiated transaction (ID: ${debit.id}) has been successfully sent to the server.`, duration: 5000});
                updatedDebits = updatedDebits.filter(d => d.id !== debit.id);
            } else {
                 const errorData = await response.json().catch(() => ({}));
                 const serverMessage = errorData.message || `Server error ${response.status} during sync for TxID ${debit.id}`;
                 console.error(`Sender sync: Failed to sync debit ${debit.id}. Server: ${serverMessage}`);
            }
        } catch (error: any) {
            console.error(`Sender sync: Network error during sync for debit ${debit.id}:`, error.message);
        }
    }
    
    if (updatedDebits.length !== localDebits.length) {
        updateLocalDebitRecords(updatedDebits);
    }
    setIsAutoProcessingSenderSyncs(false);

  }, [user, getLocalDebitRecords, updateLocalDebitRecords, isAutoProcessingSenderSyncs, toast]);


  useEffect(() => {
    if (typeof window !== 'undefined' && !loading && user) {
        if (navigator.onLine) {
            processPendingClaims();
            processSenderSyncs(); 
        }
    }
    
    const handleOnline = () => {
      if (user && !loading) {
        processPendingClaims();
        processSenderSyncs(); 
      }
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [processPendingClaims, processSenderSyncs, loading, user]);


  const isAuthenticated = !!user;

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-background text-foreground"><p>Loading App Data...</p></div>;
  }

  return (
    <AppContext.Provider value={{
        isAuthenticated,
        user,
        balance,
        pendingReceivedBalance,
        localPendingTransactions,
        getLocalDebitRecords,
        addLocalDebitRecord,
        updateLocalDebitRecords,
        loginWithApi,
        logout,
        registerWithApi,
        updateBalance,
        setBalance,
        updateContextUserBankBalance,
        addLocalPendingTransaction,
        attemptClaimPendingTransaction,
        removeLocalPendingTransaction,
        dismissStuckLocalPendingTransaction,
        updateLocalPendingTransactionStatus
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
