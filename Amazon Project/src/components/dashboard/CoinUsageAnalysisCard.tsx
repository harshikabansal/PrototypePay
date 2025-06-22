
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { analyzeCoinUsageAction } from '@/lib/actions';
import type { AnalyzeCoinUsageOutput } from '@/ai/flows/analyze-coin-usage-flow';
import type { OfflineOtpTransaction } from '@/lib/otpTransactions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, BarChart3, AlertCircle, TrendingUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { Separator } from '../ui/separator';

const chartConfig = {
  actual: {
    label: 'Actual Spend',
    color: 'hsl(var(--primary))',
  },
  predicted: {
    label: 'Predicted Spend',
    color: 'hsl(var(--accent))',
  },
} satisfies ChartConfig;

export function CoinUsageAnalysisCard() {
  const { user, getLocalDebitRecords, updateLocalDebitRecords, updateBalance } = useAppContext();
  const { toast } = useToast();
  const [analysisResult, setAnalysisResult] = useState<AnalyzeCoinUsageOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconcileAndAnalyze = useCallback(async () => {
    if (!user || !user.upiId || !user.id) {
      setError("User information not available.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setAnalysisResult(null);

    try {
      // Step 1: Fetch server transactions
      const otpResponse = await fetch(`/api/transactions/otp/history?userUpiId=${encodeURIComponent(user.upiId)}`, { cache: 'no-store' });
      let otpTxsFromServer: OfflineOtpTransaction[] = [];
      if (otpResponse.ok) {
        otpTxsFromServer = await otpResponse.json();
      } else {
        console.warn('Failed to fetch OTP transaction history for analysis.');
      }
      
      // Step 2: Reconcile local debits
      let localDebits = getLocalDebitRecords();
      let debitsToKeep = [...localDebits];
      const serverTxMap = new Map(otpTxsFromServer.map(tx => [tx.transactionId, tx]));

      for (const localDebit of localDebits) {
          if (localDebit.senderUpiId.toLowerCase() !== user.upiId.toLowerCase()) continue;

          const serverTx = serverTxMap.get(localDebit.id);
          if (serverTx && (serverTx.status === 'claimed' || serverTx.status === 'expired' || serverTx.status === 'cancelled')) {
              // Server has reached a final state for this tx, so local debit record is no longer needed.
              // Note: Reconciliation for expired/cancelled refunds happens on the history page.
              debitsToKeep = debitsToKeep.filter(d => d.id !== localDebit.id);
          }
      }
      if (debitsToKeep.length !== localDebits.length) {
          updateLocalDebitRecords(debitsToKeep);
      }
      localDebits = debitsToKeep; // Use the reconciled list for the analysis

      // Step 3: Combine for analysis, converting timestamps to ISO strings for the AI
      let combinedSpendingTransactions: any[] = [];
      otpTxsFromServer.forEach(tx => {
        if (tx.senderUpiId.toLowerCase() === user.upiId?.toLowerCase() && (tx.status === 'claimed' || tx.status === 'pending')) {
          combinedSpendingTransactions.push({
            type: 'otp', 
            status: tx.status, 
            amount: tx.amount, 
            createdAt: tx.createdAt, // Keep original timestamp for any non-AI use
            createdAtISO: new Date(tx.createdAt).toISOString(), // Add ISO string for AI
            senderUpiId: tx.senderUpiId,
          });
        }
      });
      
      const serverTxIds = new Set(otpTxsFromServer.map(tx => tx.transactionId));
      localDebits.forEach(localDebit => {
        if (!serverTxIds.has(localDebit.id) && localDebit.senderUpiId.toLowerCase() === user.upiId?.toLowerCase()) {
            combinedSpendingTransactions.push({
                type: 'otp', 
                status: 'pending', 
                amount: localDebit.amount, 
                createdAt: localDebit.timestamp, // Keep original timestamp
                createdAtISO: new Date(localDebit.timestamp).toISOString(), // Add ISO string for AI
                senderUpiId: localDebit.senderUpiId,
            });
        }
      });
      
      if (combinedSpendingTransactions.length === 0) {
        setAnalysisResult({
          totalCoinsSpent: 0, numberOfTransactions: 0, analysisPeriodDays: 0,
          oldestTransactionIsoDate: null, latestTransactionIsoDate: null,
          historicalAverages: { daily: 0 },
          spendingForecast: { forecastForRestOfMonth: 0 },
          monthlyChartData: [],
          calculationNotes: "No user-to-user spending transactions (pending or completed) found to analyze.",
        });
        setIsLoading(false);
        return;
      }

      const transactionHistoryJson = JSON.stringify(combinedSpendingTransactions);

      const result = await analyzeCoinUsageAction({ 
        userUpiId: user.upiId, 
        transactionHistoryJson,
        currentDate: new Date().toISOString()
      });

      if (result.error) throw new Error(result.error);
      
      const localTxCount = localDebits.filter(ld => !serverTxIds.has(ld.id)).length;
      if (localTxCount > 0 && result.calculationNotes) {
        result.calculationNotes += ` Analysis includes ${localTxCount} unsynced offline transaction(s).`;
      }
      
      setAnalysisResult(result);

    } catch (err: any) {
      console.error("Error analyzing coin usage:", err);
      setError(err.message || "Failed to analyze coin usage.");
      toast({
        variant: "destructive", title: "Analysis Error", description: err.message || "Could not retrieve or analyze coin usage data.",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast, getLocalDebitRecords, updateLocalDebitRecords]);

  useEffect(() => {
    if (user && user.upiId) {
        reconcileAndAnalyze();
    } else if (!user) {
        setAnalysisResult(null);
        setError(null);
    }
  }, [reconcileAndAnalyze, user]);

  const StatDisplay: React.FC<{ label: string; value: string | number; unit?: string, note?: string }> = ({ label, value, unit, note }) => (
    <div className="text-center p-3 bg-muted/50 rounded-lg">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold text-primary">
        {typeof value === 'number' ? value.toFixed(2) : value}
        {unit && <span className="text-sm font-normal text-foreground ml-1">{unit}</span>}
      </p>
      {note && <p className="text-xs text-muted-foreground mt-0.5">{note}</p>}
    </div>
  );

  const renderContent = () => {
    if (!user) {
      return <div className="flex flex-col items-center justify-center h-40"><p className="text-muted-foreground">Login to view Propo's spending analysis.</p></div>;
    }
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Propo is analyzing your spending...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-destructive">
          <AlertCircle className="h-8 w-8 mb-2" />
          <p className="font-semibold">Error Analyzing Usage</p>
          <p className="text-xs text-center">{error}</p>
        </div>
      );
    }
    if (analysisResult) {
       if (analysisResult.numberOfTransactions === 0) {
         return <p className="text-sm text-center text-muted-foreground py-4">{analysisResult.calculationNotes || "Propo found no user-to-user spending transactions to analyze."}</p>;
       }
       return (
        <div className="space-y-6">
          {/* Section 1: Historical Analysis */}
          <div>
            <h3 className="text-lg font-semibold mb-2">Historical Analysis</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <StatDisplay label="Total Spent" value={analysisResult.totalCoinsSpent} unit="COINS" />
              <StatDisplay label="Transactions" value={analysisResult.numberOfTransactions} unit="count" />
              <StatDisplay label="Daily Average" value={analysisResult.historicalAverages.daily} unit="COINS" />
            </div>

            {analysisResult.monthlyChartData && analysisResult.monthlyChartData.length > 0 && (
               <div className="h-[200px] w-full mt-4">
                <ChartContainer config={chartConfig} className="w-full h-full">
                    <LineChart data={analysisResult.monthlyChartData} accessibilityLayer margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value) => value.slice(0, 3)}
                      />
                       <YAxis 
                         tickLine={false}
                         axisLine={false}
                         tickMargin={8}
                       />
                      <ChartTooltip 
                        cursor={false}
                        content={<ChartTooltipContent indicator="dot" />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        dataKey="actual"
                        type="monotone"
                        stroke="var(--color-actual)"
                        strokeWidth={2}
                        dot={{
                          fill: "var(--color-actual)",
                        }}
                        activeDot={{
                          r: 6,
                        }}
                      />
                      <Line
                        dataKey="predicted"
                        type="monotone"
                        stroke="var(--color-predicted)"
                        strokeWidth={2}
                        strokeDasharray="3 4"
                        dot={false}
                      />
                    </LineChart>
                </ChartContainer>
              </div>
            )}
          </div>
          
          <Separator />

          {/* Section 2: Propo's Spending Forecast */}
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center">
              <TrendingUp className="h-5 w-5 mr-2 text-primary"/>
              Propo's Spending Forecast
            </h3>
            <div className="grid grid-cols-1 gap-3">
              <StatDisplay label="For Rest of This Month" value={analysisResult.spendingForecast.forecastForRestOfMonth} unit="COINS" />
            </div>
          </div>
          
          {analysisResult.calculationNotes && (
            <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg text-xs text-accent-foreground">
              <p className="font-semibold mb-1">Propo's Notes:</p>
              <p>{analysisResult.calculationNotes}</p>
              {(analysisResult.oldestTransactionIsoDate || analysisResult.latestTransactionIsoDate) &&
                <p className="mt-1 text-muted-foreground text-xs">
                  Data from: {analysisResult.oldestTransactionIsoDate || 'N/A'} to {analysisResult.latestTransactionIsoDate || 'N/A'}
                </p>
              }
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="shadow-lg hover:shadow-xl transition-shadow duration-300 col-span-1 md:col-span-3">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-medium font-headline flex items-center">
              <BarChart3 className="h-6 w-6 text-primary mr-2" />
              Propo's Analysis
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Spending patterns from your **completed (claimed), pending,** and **unsynced offline** user-to-user transactions.
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={reconcileAndAnalyze} disabled={isLoading || !user} aria-label="Refresh analysis">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
