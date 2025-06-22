"use client";

import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Wallet, TrendingUp } from 'lucide-react';

export function CoinWalletCard() {
  const { balance } = useAppContext();

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-medium font-headline">
          My Coin Wallet
        </CardTitle>
        <Wallet className="h-6 w-6 text-primary" />
      </CardHeader>
      <CardContent>
        <div className="text-4xl font-bold text-foreground">
          {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-2xl text-muted-foreground ml-1">COINS</span>
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Your current available balance.
        </CardDescription>
      </CardContent>
    </Card>
  );
}
