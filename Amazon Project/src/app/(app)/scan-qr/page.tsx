
import { ScanQrCodeClient } from '@/components/transactions/ScanQrCodeClient';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scan QR to Receive Coins | PrototypePay',
  description: 'Scan a QR code from the sender to receive coins.',
};

export default function ScanQrPage() {
  return (
    <div className="container mx-auto py-8">
      <ScanQrCodeClient />
    </div>
  );
}
