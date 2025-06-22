
import { SendCoinForm } from '@/components/transactions/SendCoinForm';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Send Coins (Offline) | PrototypePay',
};

export default function SendCoinPage() {
  return (
    <div className="container mx-auto py-8">
      <SendCoinForm />
    </div>
  );
}
