
"use client";

import { useState } from 'react';
import { useAppContext, type LocalPendingTransaction, type LocalPendingTransactionStatus } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, Hourglass, Loader2, RefreshCw, Trash2, QrCode, ShieldCheck, CloudOff, HelpCircle, Coins, AlertCircleIcon } from 'lucide-react'; // Added Coins, AlertCircleIcon
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STUCK_PENDING_CLEANUP_THRESHOLD_HOURS = 48; 
const STUCK_PENDING_CLEANUP_THRESHOLD_MS = STUCK_PENDING_CLEANUP_THRESHOLD_HOURS * 60 * 60 * 1000;

export function PendingTransactionManager() {
  const { localPendingTransactions, attemptClaimPendingTransaction, dismissStuckLocalPendingTransaction } = useAppContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({}); 

  const handleAttemptClaim = async (localId: string) => {
    setIsLoading(prev => ({ ...prev, [localId]: true }));
    try {
      await attemptClaimPendingTransaction(localId);
      // Toast messages for success/failure are handled within attemptClaimPendingTransaction in AppContext
    } catch (error: any) { // Should be rare as AppContext handles its own errors
      toast({
        variant: "destructive",
        title: "Claim Error",
        description: error.message || "An unexpected error occurred while trying to claim.",
      });
    } finally {
      setIsLoading(prev => ({ ...prev, [localId]: false }));
    }
  };

  const handleDismiss = (localId: string) => {
    dismissStuckLocalPendingTransaction(localId);
  };

  const getStatusBadge = (tx: LocalPendingTransaction) => {
    let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
    let text = tx.status.replace(/_/g, ' ').toUpperCase();
    let IconComponent = Hourglass;

    switch (tx.status) {
      case 'pending_qr_scan_confirmation':
        variant = 'outline';
        text = 'PENDING SERVER CLAIM';
        IconComponent = QrCode;
        break;
      case 'locally_credited_offline_pending_server_sync':
        variant = 'default';
        text = 'LOCALLY CREDITED - SYNCING';
        IconComponent = Coins;
        break;
      case 'failed_attempt':
        variant = 'destructive';
        text = `RETRY: ${tx.lastAttemptMessage?.substring(0,30) || 'Unknown reason'}${tx.lastAttemptMessage && tx.lastAttemptMessage.length > 30 ? '...' : ''}`;
        IconComponent = AlertTriangle;
        break;
      case 'confirmed_with_server':
        variant = 'default'; 
        text = 'CLAIMED & CREDITED';
        IconComponent = ShieldCheck;
        break;
      case 'claim_rejected_by_server_funds_reverted':
        variant = 'destructive';
        text = 'SERVER REJECTED - REVERSED';
        IconComponent = AlertCircleIcon;
        break;
      case 'critical_reversal_failed_contact_support':
        variant = 'destructive';
        text = 'CRITICAL ERROR - CONTACT SUPPORT';
        IconComponent = AlertTriangle;
        break;
      default: 
        text = tx.status.replace(/_/g, ' ').toUpperCase();
        IconComponent = HelpCircle;
    }
    return <Badge variant={variant} className="flex items-center gap-1 whitespace-nowrap"><IconComponent className="h-3 w-3" /> {text}</Badge>;
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const isActionable = (tx: LocalPendingTransaction) => {
    return tx.status === 'pending_qr_scan_confirmation' || 
           tx.status === 'failed_attempt' || 
           tx.status === 'locally_credited_offline_pending_server_sync';
  };
  
  const relevantPendingTransactions = localPendingTransactions.filter(
    tx => tx.status !== 'confirmed_with_server' && tx.status !== 'claim_rejected_by_server_funds_reverted'
  );


  const isDismissible = (tx: LocalPendingTransaction): boolean => {
    const isOldEnough = (Date.now() - tx.timestampAdded) > STUCK_PENDING_CLEANUP_THRESHOLD_MS;
    // Allow dismissing older items or those in critical error state.
    return (isOldEnough && (tx.status === 'failed_attempt' || tx.status === 'pending_qr_scan_confirmation' || tx.status === 'locally_credited_offline_pending_server_sync')) || tx.status === 'critical_reversal_failed_contact_support';
  };


  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline">Pending Wallet</CardTitle>
        <CardDescription>
          These transactions were scanned from QR codes. If offline, "Claim" will credit locally. Online, it syncs with the server.
          Your main wallet reflects changes based on these actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {relevantPendingTransactions.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="text-xl">No transactions awaiting action!</p>
            <p>Your pending wallet is clear or all items have been fully processed.</p>
          </div>
        ) : (
          <Table>
            <TableCaption>{relevantPendingTransactions.length > 0 ? `List of transactions requiring action or monitoring. Total: ${relevantPendingTransactions.length}` : "All pending items have been processed."}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Scanned At</TableHead>
                <TableHead>TxID</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relevantPendingTransactions.map((tx) => ( 
                <TableRow key={tx.localId}>
                  <TableCell>{formatDate(tx.timestampAdded)}</TableCell>
                  <TableCell className="font-mono">{tx.otpOrTxId}</TableCell>
                  <TableCell className="text-right font-medium">{tx.amountEnteredOffline.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(tx)}</TableCell>
                  <TableCell className="text-center space-x-2">
                    {isActionable(tx) && (
                      <Button
                        onClick={() => handleAttemptClaim(tx.localId)}
                        disabled={isLoading[tx.localId]}
                        size="sm"
                        variant="default" 
                      >
                        {isLoading[tx.localId] && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading[tx.localId] ? "Processing..." : 
                         tx.status === 'locally_credited_offline_pending_server_sync' ? "Retry Sync" :
                         tx.status === 'failed_attempt' ? "Retry Claim" :
                         "Claim"}
                      </Button>
                    )}
                    {isDismissible(tx) && (
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={isLoading[tx.localId]}
                            title={`Dismiss this item (TxID: ${tx.otpOrTxId})`}
                          >
                            <Trash2 className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Dismiss</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure you want to dismiss this item?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action will remove the item (TxID: {tx.otpOrTxId}, Amount: {tx.amountEnteredOffline.toFixed(2)}, Status: {tx.status.replace(/_/g, ' ')}) from this list.
                              {tx.status === 'critical_reversal_failed_contact_support' && <strong> This is a critical error item. Dismissing it acknowledges you've seen it, but please contact support.</strong>}
                              Dismissing does not affect server records or balances if already processed/credited.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDismiss(tx.localId)}>
                              Yes, Dismiss
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                     {(tx.status === 'confirmed_with_server' || tx.status === 'claim_rejected_by_server_funds_reverted') && (
                        <span className={`text-sm flex items-center justify-center ${tx.status === 'confirmed_with_server' ? 'text-green-600' : 'text-orange-600'}`}>
                            {tx.status === 'confirmed_with_server' ? <ShieldCheck className="h-4 w-4 mr-1" /> : <AlertCircleIcon className="h-4 w-4 mr-1" />}
                            {tx.status === 'confirmed_with_server' ? 'Claimed' : 'Reversed'}
                        </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
       {!navigator.onLine && relevantPendingTransactions.some(isActionable) && (
          <CardFooter>
            <p className="text-sm text-orange-600 text-center w-full flex items-center justify-center gap-1">
              <CloudOff className="h-4 w-4" /> You appear to be offline. "Claim" will credit locally. Server sync will occur when online.
            </p>
          </CardFooter>
        )}
    </Card>
  );
}
