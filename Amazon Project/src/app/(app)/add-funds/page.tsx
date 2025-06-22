
import { AddFundsForm } from '@/components/transactions/AddFundsForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Add Funds to Wallet | PrototypePay',
  description: 'Transfer funds from your bank account to your PrototypePay wallet.',
};

export default function AddFundsPage() {
  return (
    <div className="container mx-auto py-8">
      <AddFundsForm />
    </div>
  );
}
