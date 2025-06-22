
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AddFundsSchema, type AddFundsFormData } from "@/lib/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppContext } from "@/contexts/AppContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AddFundsForm() {
  const { user, balance: coinWalletBalance, updateBalance: updateCoinWalletBalance, updateContextUserBankBalance } = useAppContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AddFundsFormData>({
    resolver: zodResolver(AddFundsSchema),
    defaultValues: {
      amount: 0,
      pin: "",
    },
  });

  const onSubmit = async (data: AddFundsFormData) => {
    setIsLoading(true);

    if (!user || !user.id || typeof user.bankBalance === 'undefined') {
      toast({ variant: "destructive", title: "Error", description: "User data or bank balance not found. Please relogin." });
      setIsLoading(false);
      return;
    }

    if (data.amount > user.bankBalance) {
      form.setError("amount", { type: "manual", message: "Insufficient bank balance." });
      setIsLoading(false);
      return;
    }
     if (data.amount <= 0) {
      form.setError("amount", { type: "manual", message: "Amount must be greater than zero." });
      setIsLoading(false);
      return;
    }


    try {
      const response = await fetch('/api/user/add-funds-to-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: data.amount,
          pin: data.pin,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toast({
          variant: "destructive",
          title: "Failed to Add Funds",
          description: result.message || "An unexpected error occurred. Please try again.",
        });
        setIsLoading(false);
        return;
      }

      // Server has debited bank balance and verified PIN.
      // Now, update client-side balances.
      updateContextUserBankBalance(result.newBankBalance); // Update bank balance in context
      const coinCreditSuccess = updateCoinWalletBalance(data.amount, 'add'); // Add to coin wallet

      if (!coinCreditSuccess) {
        // This is a critical issue if coin crediting fails after bank debit
        toast({
          variant: "destructive",
          title: "Critical Error",
          description: "Bank balance updated, but failed to credit Coin Wallet. Please contact support immediately.",
          duration: 10000,
        });
      } else {
        toast({
          title: "Funds Added Successfully!",
          description: `${data.amount.toFixed(2)} coins added to your wallet. Your new bank balance is ${result.newBankBalance.toFixed(2)}.`,
        });
      }
      form.reset();

    } catch (error: any) {
      let description = "An unexpected error occurred. Please ensure you are online and try again.";
      if (error instanceof TypeError && error.message.toLowerCase().includes("failed to fetch")) {
        description = "You appear tobe offline. This feature requires an internet connection.";
      } else if (error.message) {
        description = error.message;
      }
      toast({
        variant: "destructive",
        title: "Error Adding Funds",
        description: description,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline">Add Funds to Coin Wallet</CardTitle>
        <CardDescription>
          Transfer funds from your bank account to your PrototypePay wallet.
          (1 Bank Currency Unit = 1 Coin). Transaction limit: 1000. This is an online process.
        </CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Add (Max 1000)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      step="0.01"
                      max={1000}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      placeholder="e.g., 100"
                    />
                  </FormControl>
                  <FormDescription>
                    Your current bank balance: {(user?.bankBalance ?? 0).toFixed(2)} LCUs <br/>
                    Your current coin wallet balance: {coinWalletBalance.toFixed(2)} COINS
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
                    Enter the 4-digit PIN you set during registration.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="flex flex-col items-stretch gap-2">
            <Button type="submit" className="w-full" disabled={isLoading || !navigator.onLine}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLoading ? "Processing..." : "Add Funds"}
            </Button>
            {!navigator.onLine && (
                <p className="text-xs text-destructive text-center w-full pt-1">
                    This feature requires an internet connection.
                </p>
            )}
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
