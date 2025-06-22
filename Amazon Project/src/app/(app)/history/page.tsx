
import { TransactionHistory } from '@/components/transactions/TransactionHistory';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transaction History | PrototypePay',
};

export default function HistoryPage() {
  return (
    <div className="container mx-auto py-8">
      <TransactionHistory />
    </div>
  );
}
