
"use client";

import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Hourglass, ArrowRight } from 'lucide-react';

export function PendingCoinWalletCard() {
  const { pendingReceivedBalance } = useAppContext();

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 bg-accent/10 border-accent flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl font-medium font-headline text-accent-foreground">
          Pending Received Coins
        </CardTitle>
        <Hourglass className="h-6 w-6 text-accent" />
      </CardHeader>
      <CardContent className="flex-grow">
        <div className="text-4xl font-bold text-accent-foreground">
          {pendingReceivedBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          <span className="text-2xl text-muted-foreground ml-1">COINS</span>
        </div>
        <CardDescription className="text-xs text-muted-foreground mt-1">
          Coins provisionally received. Requires online confirmation.
        </CardDescription>
      </CardContent>
      <CardFooter>
        <Button asChild variant="outline" className="w-full border-accent text-accent-foreground hover:bg-accent/20">
          <Link href="/pending-wallet">
            Manage Pending Coins
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
