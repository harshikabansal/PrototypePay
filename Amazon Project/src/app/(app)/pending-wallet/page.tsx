
import { PendingTransactionManager } from '@/components/pending-wallet/PendingTransactionManager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pending Received Coins | PrototypePay',
  description: 'Manage and confirm coins received while offline.',
};

export default function PendingWalletPage() {
  return (
    <div className="container mx-auto py-8">
      <PendingTransactionManager />
    </div>
  );
}
