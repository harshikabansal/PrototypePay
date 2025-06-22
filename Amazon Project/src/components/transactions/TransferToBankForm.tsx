
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { TransferToBankSchema, type TransferToBankFormData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { detectFraudAction } from "@/lib/actions";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import type { DetectFraudInput } from "@/ai/flows/detect-fraud";
import { addBankTransfer } from "@/lib/bankTransferStore"; // For logging the transfer attempt locally


export function TransferToBankForm() {
  const { balance, user, updateBalance, updateContextUserBankBalance } = useAppContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<TransferToBankFormData>({
    resolver: zodResolver(TransferToBankSchema),
    defaultValues: {
      amount: 0,
      pin: "",
    },
  });

  const onSubmit = async (data: TransferToBankFormData) => {
    if (!user || !user.id || !user.upiId || typeof user.bankBalance === 'undefined') {
       toast({ variant: "destructive", title: "Error", description: "User information or bank balance is missing. Please relogin." });
       setIsLoading(false);
       return;
    }
    if (data.amount <= 0) {
       form.setError("amount", { type: "manual", message: "Amount must be greater than zero." });
       setIsLoading(false);
      return;
    }
    if (data.amount > balance) {
      form.setError("amount", { type: "manual", message: "Insufficient coin balance." });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    // AI Fraud Check First
    const fraudInput: DetectFraudInput = {
      transactionDetails: `User ${user.email || 'Unknown User'} (UPI: ${user.upiId}) initiating transfer of ${data.amount} coins to their linked bank account. Current coin balance: ${balance}, current bank balance: ${user.bankBalance}.`,
      userHistory: `User ${user.email || 'Unknown User'} has current coin balance of ${balance} and bank balance of ${user.bankBalance}. This is a transfer to their own linked bank account.`,
    };

    const fraudResult = await detectFraudAction(fraudInput);

    if (fraudResult.error || (fraudResult.isFraudulent && (fraudResult.riskScore ?? 0) > 0.7)) {
      toast({
        variant: "destructive",
        title: "Transfer Security Check Failed",
        description: fraudResult.error || `This transaction has been flagged as potentially high-risk. Please contact support. Risk: ${fraudResult.riskScore?.toFixed(2)}. Reason: ${fraudResult.fraudExplanation}`,
      });
      addBankTransfer({
        userId: user.id,
        userUpiId: user.upiId,
        amount: data.amount,
        status: 'failed',
      });
      setIsLoading(false);
      return;
    }
    
    if (fraudResult.isFraudulent) {
       toast({
        variant: "default",
        title: "Security Warning",
        description: `This transaction shows some unusual patterns (Risk: ${fraudResult.riskScore?.toFixed(2)}). Proceeding with caution. Reason: ${fraudResult.fraudExplanation}`,
      });
    } else {
       toast({
        title: "Security Check Passed",
        description: `Transaction looks good (Risk: ${fraudResult.riskScore?.toFixed(2)}).`,
      });
    }

    // Step 1: Debit coins locally
    const coinDebitSuccess = updateBalance(data.amount, 'subtract');
    if (!coinDebitSuccess) {
      toast({
        variant: "destructive",
        title: "Transfer Failed",
        description: "Could not debit coins from your wallet. Please check your coin balance and try again.",
      });
      addBankTransfer({
        userId: user.id,
        userUpiId: user.upiId,
        amount: data.amount,
        status: 'failed',
      });
      setIsLoading(false);
      return;
    }

    // Step 2: Update bank balance on the server (this API will now also check PIN)
    const newTheoreticalBankBalance = user.bankBalance + data.amount;
    try {
      const response = await fetch('/api/user/update-bank-balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            userId: user.id, 
            amountToAddTobank: data.amount, // Send the amount to be added to bank
            pin: data.pin // Send the PIN for verification
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        // Rollback local coin debit if server update fails (e.g. wrong PIN, server error)
        updateBalance(data.amount, 'add');
        toast({
          variant: "destructive",
          title: "Transfer Failed",
          description: result.message || "Could not update bank balance on the server. Your coin balance has been restored.",
        });
        addBankTransfer({
            userId: user.id,
            userUpiId: user.upiId,
            amount: data.amount,
            status: 'failed',
        });
        setIsLoading(false);
        return;
      }

      // Server update successful (PIN was correct, bank balance updated)
      updateContextUserBankBalance(result.updatedUser.bankBalance); // Update context with server-confirmed balance
      toast({
        title: "Transfer Initiated!",
        description: `${data.amount} coins are being transferred to your linked bank account. Your bank balance has been updated.`,
      });
      addBankTransfer({
        userId: user.id,
        userUpiId: user.upiId,
        amount: data.amount, 
        status: 'completed',
      });
      form.reset();

    } catch (error) {
      // Network or other fetch error, rollback local coin debit
      updateBalance(data.amount, 'add');
      toast({
        variant: "destructive",
        title: "Transfer Error",
        description: "A network error occurred while trying to update your bank balance. Your coin balance has been restored.",
      });
      addBankTransfer({
        userId: user.id,
        userUpiId: user.upiId,
        amount: data.amount,
        status: 'failed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline">Transfer Coins to Bank Account</CardTitle>
        <CardDescription>Convert your coins to local currency (1 Coin = 1 Local Currency Unit) and send them to your linked bank account. This is an online feature.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount in Coins to Transfer</FormLabel>
                  <FormControl>
                    <Input 
                        type="number" 
                        {...field} 
                        step="0.01" 
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormDescription>
                    Your current coin balance: {balance.toFixed(2)} COINS <br/>
                    Your current bank balance: {(user?.bankBalance ?? 0).toFixed(2)} LCUs (Local Currency Units)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>4-Digit PIN</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      {...field}
                      autoComplete="one-time-code"
                      placeholder="Enter your 4-digit PIN"
                    />
                  </FormControl>
                  <FormDescription>
                    Enter the 4-digit PIN you set during registration to authorize this transfer.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || !navigator.onLine}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Processing Transfer..." : "Transfer to My Bank"}
            </Button>
          </CardFooter>
            {!navigator.onLine && (
                <p className="text-xs text-destructive text-center w-full pt-2">
                    This feature requires an internet connection.
                </p>
            )}
        </form>
      </Form>
    </Card>
  );
}
