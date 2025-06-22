
import { TransferToBankForm } from '@/components/transactions/TransferToBankForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Transfer Coins to Bank | PrototypePay',
};

export default function TransferToBankPage() {
  return (
    <div className="container mx-auto py-8">
      <TransferToBankForm />
    </div>
  );
}
