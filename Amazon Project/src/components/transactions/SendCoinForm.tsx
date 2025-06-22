
"use client";

import { useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { SendCoinSchema, type SendCoinFormData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, QrCode, RotateCcw, ShieldCheck } from "lucide-react";
import QRCodeStylized from "qrcode.react";
import { generateOfflineTransactionDetails } from "@/lib/offlineOtpUtils";

interface QrCodePayload {
  txid: string;
  sUPI: string;
  rUPI: string;
  amt: number;
}

export function SendCoinForm() {
  const { balance, user, updateBalance, addLocalDebitRecord } = useAppContext();
  const { toast } = useToast();
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState<string | null>(null);
  const [generatedTxDetails, setGeneratedTxDetails] = useState<QrCodePayload | null>(null);
  const [transactionFinalized, setTransactionFinalized] = useState(false); // Used to show completion message


  const form = useForm<SendCoinFormData>({
    resolver: zodResolver(SendCoinSchema),
    defaultValues: {
      amount: 0,
      recipientUpiId: "",
    },
  });

  // This is the new consolidated function
  const handleGenerateQrAndDebit = async (data: SendCoinFormData) => {
    if (!user || !user.id || !user.upiId) {
      toast({ variant: "destructive", title: "User Error", description: "Your UPI ID is not available. Please relogin." });
      return;
    }
    if (data.amount > balance) {
      form.setError("amount", { type: "manual", message: "Insufficient balance." });
      return;
    }
    if (data.recipientUpiId.toLowerCase() === user.upiId.toLowerCase()){
      form.setError("recipientUpiId", {type: "manual", message: "Sender and recipient UPI ID cannot be the same."});
      return;
    }

    setIsProcessingAction(true);
    
    const transactionTimestamp = Date.now(); // Capture timestamp at the moment of creation

    // Step 1: Debit sender's local balance immediately
    const localDebitSuccess = updateBalance(data.amount, 'subtract');
    if (!localDebitSuccess) {
      toast({ variant: "destructive", title: "Local Balance Error", description: "Could not update your local balance. Transaction not finalized." });
      setIsProcessingAction(false);
      return;
    }

    // Generate unique TxID
    const { transactionId } = generateOfflineTransactionDetails(); 
    const payload: QrCodePayload = {
      txid: transactionId,
      sUPI: user.upiId,
      rUPI: data.recipientUpiId,
      amt: data.amount,
    };
    
    // Step 2: Add to local debit record (this is the queue for server sync)
    addLocalDebitRecord({
      id: payload.txid,
      amount: payload.amt,
      timestamp: transactionTimestamp, // Use the captured timestamp
      senderUpiId: user.upiId,
      recipientUpiId: payload.rUPI,
    });
    
    // Step 3: Attempt to log transaction with server (will be queued if offline)
    try {
      // This fetch is "fire and forget" in terms of blocking the UI.
      // The AppContext's `processSenderSyncs` will handle retries if this fails.
      fetch('/api/transactions/otp/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otp: payload.txid, 
          transactionId: payload.txid,
          senderUpiId: payload.sUPI,
          recipientUpiId: payload.rUPI,
          amount: payload.amt,
          createdAt: transactionTimestamp, // Pass the client's timestamp
        }),
      }).then(response => {
        if (!response.ok) {
            // Log silent failure, AppContext will retry.
            console.warn(`Initial server sync for ${payload.txid} failed, will retry later.`);
        } else {
            console.log(`Initial server sync for ${payload.txid} successful.`);
        }
      }).catch(error => {
        console.warn(`Initial server sync for ${payload.txid} failed with network error, will retry later.`, error);
      });
    } catch (error) {
        // Catch synchronous errors if any, though unlikely for fetch.
        console.error("Synchronous error during initial sync attempt:", error);
    }
    
    // Step 4: Update UI
    setGeneratedTxDetails(payload);
    setQrCodeValue(JSON.stringify(payload));
    setTransactionFinalized(true); // Treat as finalized from sender's POV
    setIsProcessingAction(false);
    toast({ title: "Transaction Prepared & Debited!", description: `Your balance has been updated. Show the QR to the recipient.` });
  };


  const resetFormAndQr = useCallback(() => {
    form.reset({ amount: 0, recipientUpiId: "" });
    setQrCodeValue(null);
    setGeneratedTxDetails(null);
    setTransactionFinalized(false);
    setIsProcessingAction(false);
  }, [form]);

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline flex items-center">
          <QrCode className="mr-2 h-8 w-8 text-primary" /> Send Coins via QR
        </CardTitle>
        <CardDescription>
          Enter details and generate a QR. Your balance will be debited immediately. Show the QR to the recipient for them to claim.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
          <form onSubmit={form.handleSubmit(handleGenerateQrAndDebit)}>
            <CardContent className="space-y-6">
                {!transactionFinalized ? (
                <>
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Amount to Send</FormLabel>
                        <FormControl>
                        <Input
                            type="number"
                            {...field}
                            step="0.01"
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            disabled={isProcessingAction}
                            placeholder="e.g., 50.00"
                        />
                        </FormControl>
                        <FormDescription>Your current balance: {balance.toFixed(2)} COINS</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="recipientUpiId"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Recipient UPI ID</FormLabel>
                        <FormControl>
                        <Input
                            type="text"
                            {...field}
                            disabled={isProcessingAction}
                            placeholder="e.g., receiver@prototypepay"
                        />
                        </FormControl>
                        <FormDescription>Enter the recipient's exact UPI ID.</FormDescription>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </>
                ) : null}

                {qrCodeValue && generatedTxDetails && (
                <div className="mt-2 p-4 border rounded-lg text-center space-y-3 border-green-500 bg-green-50/50">
                    <div className="flex items-center justify-center text-green-600">
                        <ShieldCheck className="mr-2 h-6 w-6" />
                        <p className="text-lg font-semibold">Transaction Debited & QR Ready!</p>
                    </div>

                    <p className="text-sm">
                        Show this QR to Recipient to Scan.
                    </p>
                    <div className="flex justify-center my-2">
                    <QRCodeStylized value={qrCodeValue} size={200} level="M" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                    TxID: {generatedTxDetails.txid} <br />
                    Amount: {generatedTxDetails.amt.toFixed(2)} COINS for {generatedTxDetails.rUPI}
                    </p>
                </div>
                )}
            </CardContent>
            <CardFooter className="flex flex-col items-stretch gap-4">
                {!transactionFinalized ? (
                    <Button type="submit" className="w-full" disabled={isProcessingAction || balance <= 0}>
                        {isProcessingAction && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <QrCode className="mr-2 h-4 w-4" />
                        Generate QR & Debit Coins
                    </Button>
                ) : (
                    <Button type="button" onClick={resetFormAndQr} variant="outline" className="w-full mt-2">
                        <RotateCcw className="mr-2 h-4 w-4"/>
                        Start New Transaction
                    </Button>
                )}
            </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
