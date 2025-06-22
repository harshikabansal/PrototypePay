
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAppContext, type LocalDebitRecord } from '@/contexts/AppContext'; // Import LocalDebitRecord
import type { OfflineOtpTransaction } from '@/lib/otpTransactions';
import { loadBankTransfersForUser, type BankTransferRecord } from '@/lib/bankTransferStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Clock, XCircle, Ban, Hourglass, RefreshCw, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type CombinedTransaction = (OfflineOtpTransaction & { type: 'otp' }) | (BankTransferRecord & { type: 'bank' });

export function TransactionHistory() {
  const { user, balance, updateBalance, getLocalDebitRecords, updateLocalDebitRecords } = useAppContext();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<CombinedTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const reconcileSenderBalance = useCallback(async (otpTransactionsFromServer: OfflineOtpTransaction[]) => {
    if (!user || !user.upiId || !user.id) return;

    let localDebitRecords: LocalDebitRecord[] = getLocalDebitRecords();
    let updatedLocalDebitRecords = [...localDebitRecords]; // Work on a copy

    const serverTxMap = new Map(otpTransactionsFromServer.map(tx => [tx.transactionId, tx]));

    for (const localDebit of localDebitRecords) {
      if (localDebit.senderUpiId.toLowerCase() !== user.upiId.toLowerCase()) {
        continue;
      }

      const serverTx = serverTxMap.get(localDebit.id);

      if (serverTx) { // Transaction IS found on the server
        if (serverTx.status === 'claimed') {
          // If claimed, the debit was correct. Remove the local debit record as it's now fully processed.
          updatedLocalDebitRecords = updatedLocalDebitRecords.filter(r => r.id !== localDebit.id);
        } else if (serverTx.status === 'expired' || serverTx.status === 'cancelled') {
          // If expired or cancelled on server, refund the sender and remove the local debit record.
          const refundSuccess = updateBalance(localDebit.amount, 'add');
          if (refundSuccess) {
            toast({
              title: "Balance Reconciled (Refund)",
              description: `Credited back ${localDebit.amount.toFixed(2)} coins for ${serverTx.status} transaction (ID: ${localDebit.id}).`
            });
            updatedLocalDebitRecords = updatedLocalDebitRecords.filter(r => r.id !== localDebit.id);
          } else {
            toast({
                variant: "destructive",
                title: "Reconciliation Error (Expired/Cancelled)",
                description: `Failed to refund ${localDebit.amount.toFixed(2)} for ${serverTx.status} transaction ID: ${localDebit.id}. The debit record will remain for a future attempt.`
            });
          }
        }
        // If 'pending' on server, local debit record remains until status changes or it expires.
      } else {
        // Transaction IS NOT found on the server.
        // The sender's local balance remains debited.
        // No automatic refund here. The transaction might be synced later by the sender's app
        // or a more robust retry mechanism if implemented in the future.
        // If it never gets to the server, the recipient can't claim it.
        // The local debit record remains, reflecting the sender's local action.
        console.log(`Local debit record ${localDebit.id} for ${localDebit.amount} coins not found on server. No automatic refund. Will await potential future sync or server-side expiry if synced later.`);
      }
    }

    // This second loop is for server 'claimed' transactions where a local debit record might have been missed or prematurely cleared.
    // The primary debit occurs in SendCoinForm.
    for (const serverTx of otpTransactionsFromServer) {
        if (serverTx.senderUpiId.toLowerCase() === user.upiId.toLowerCase() && serverTx.status === 'claimed') {
            const correspondingLocalDebitExists = updatedLocalDebitRecords.some(r => r.id === serverTx.transactionId);
            if (!correspondingLocalDebitExists) {
                 // This situation implies the local debit was somehow cleared before server confirmation of 'claimed',
                 // or the debit happened on another device. The server status is 'claimed', so balance should reflect that.
                 // No action needed here IF the initial debit was successful on SendCoinForm.
                 // console.log(`Server tx ${serverTx.transactionId} is 'claimed'. No local debit record found or already reconciled.`);
            }
        }
    }

    if (updatedLocalDebitRecords.length !== localDebitRecords.length) {
      updateLocalDebitRecords(updatedLocalDebitRecords);
    }

  }, [user, updateBalance, getLocalDebitRecords, updateLocalDebitRecords, toast]);


  const fetchTransactions = useCallback(async () => {
    if (user && user.upiId && user.id) {
      setIsLoading(true);
      try {
        const otpResponse = await fetch(`/api/transactions/otp/history?userUpiId=${encodeURIComponent(user.upiId)}`, { cache: 'no-store' });
        if (!otpResponse.ok) {
          const errorData = await otpResponse.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch OTP transaction history');
        }
        const otpTxsDataFromServer: OfflineOtpTransaction[] = await otpResponse.json();

        await reconcileSenderBalance(otpTxsDataFromServer);

        const otpTxs: CombinedTransaction[] = otpTxsDataFromServer.map((tx) => ({ ...tx, type: 'otp' as const }));

        let bankTxsData: BankTransferRecord[] = [];
        if (typeof window !== 'undefined') {
            bankTxsData = loadBankTransfersForUser(user.id);
        }
        const bankTxs: CombinedTransaction[] = bankTxsData.map(tx => ({ ...tx, type: 'bank' as const }));

        const combined = [...otpTxs, ...bankTxs].sort((a, b) => {
          const dateA = a.type === 'otp' ? a.createdAt : a.timestamp;
          const dateB = b.type === 'otp' ? b.createdAt : b.timestamp;
          return dateB - dateA;
        });
        setTransactions(combined);
      } catch (error: any) {
        let description = "Could not fetch transaction history.";
        if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
            description = "You appear to be offline. Transaction history could not be fetched from the server. Some local balance reconciliations might be pending until you're online.";
        } else if (error.message) {
            description = error.message;
        }
        toast({ variant: "destructive", title: "Error Fetching History", description: description, duration: 7000 });
        setTransactions([]);
      } finally {
        setIsLoading(false);
      }
    } else {
      setTransactions([]);
      setIsLoading(false);
    }
  }, [user, toast, reconcileSenderBalance]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions, refreshTrigger]);

  const getStatusBadge = (tx: CombinedTransaction) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let text = tx.status?.toUpperCase() || "UNKNOWN";
    let IconComponent = Clock;

    if (tx.type === 'otp') {
      switch (tx.status) {
        case 'pending':
          variant = 'outline';
          text = 'PENDING (OTP)';
          IconComponent = Hourglass;
          break;
        case 'claimed':
          variant = 'default';
          text = 'COMPLETED (OTP)';
          IconComponent = CheckCircle2;
          break;
        case 'expired':
          variant = 'destructive';
          text = 'EXPIRED (OTP)';
          IconComponent = XCircle;
          break;
        case 'cancelled':
          variant = 'destructive';
          text = 'CANCELLED (OTP)';
          IconComponent = Ban;
          break;
      }
    } else if (tx.type === 'bank') {
      switch (tx.status) {
        case 'completed':
          variant = 'default';
          text = 'COMPLETED (BANK)';
          IconComponent = CheckCircle2;
          break;
        case 'failed':
          variant = 'destructive';
          text = 'FAILED (BANK)';
          IconComponent = AlertTriangle;
          break;
      }
    }
    return <Badge variant={variant} className="flex items-center gap-1 whitespace-nowrap"><IconComponent className="h-3 w-3" /> {text}</Badge>;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading && transactions.length === 0) {
    return <div className="text-center py-10">Loading transaction history... (Online connection required for latest status & reconciliation)</div>;
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-3xl font-headline">Transaction History</CardTitle>
          <Button variant="outline" size="icon" onClick={() => setRefreshTrigger(prev => prev + 1)} disabled={isLoading} aria-label="Refresh history">
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>View your transactions. Balances are updated based on server status when online. Offline actions are reconciled here.</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 && !isLoading ? (
          <div className="text-center py-10 text-muted-foreground">
            <p>No transactions found. If you recently performed offline actions, connect to the internet and refresh.</p>
          </div>
        ) : (
          <Table>
             <TableCaption>{transactions.length > 10 ? "Scroll for more transactions." : "A list of your recent transactions."}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type / Details</TableHead>
                <TableHead className="text-right">Amount (COINS)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => {
                let details = "";
                let amountDisplay: string | number = tx.amount;
                let isSender = false;

                if (tx.type === 'otp') {
                  isSender = tx.senderUpiId.toLowerCase() === user?.upiId?.toLowerCase();

                  if (isSender) {
                    details = `To: ${tx.recipientUpiId} (OTP: ${tx.otp}, ID: ${tx.transactionId})`;
                    amountDisplay = `-${tx.amount.toFixed(2)}`;
                  } else {
                    details = `From: ${tx.senderUpiId} (OTP: ${tx.otp}, ID: ${tx.transactionId})`;
                    amountDisplay = `+${tx.amount.toFixed(2)}`;
                  }
                } else {
                  details = `To: Linked Bank Account (User: ${tx.userUpiId})`;
                  amountDisplay = `-${tx.amount.toFixed(2)}`;
                }

                return (
                  <TableRow key={tx.type === 'otp' ? tx.transactionId + tx.otp : tx.id}>
                    <TableCell>{formatDate(tx.type === 'otp' ? tx.createdAt : tx.timestamp)}</TableCell>
                    <TableCell>{details}</TableCell>
                    <TableCell className={`text-right font-medium ${amountDisplay.toString().startsWith('-') ? 'text-destructive' : 'text-green-600'}`}>
                      {amountDisplay}
                    </TableCell>
                    <TableCell>{getStatusBadge(tx)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
