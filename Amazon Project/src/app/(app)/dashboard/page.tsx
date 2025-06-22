
import { CoinWalletCard } from '@/components/dashboard/CoinWalletCard';
import { PendingCoinWalletCard } from '@/components/dashboard/PendingCoinWalletCard';
import { BankBalanceCard } from '@/components/dashboard/BankBalanceCard';
import { CoinUsageAnalysisCard } from '@/components/dashboard/CoinUsageAnalysisCard'; // New import
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard | PrototypePay',
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold font-headline text-foreground">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <CoinWalletCard />
        <BankBalanceCard />
        <PendingCoinWalletCard />
      </div>

      <CoinUsageAnalysisCard />
    </div>
  );
}
