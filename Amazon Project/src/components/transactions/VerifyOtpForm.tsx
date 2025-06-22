
// This file is being replaced by ScanQrCodeClient.tsx
// It can be deleted.
// Keeping it temporarily to avoid breaking changes if not all references are updated immediately.

"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function VerifyOtpForm() {
  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-headline">Receive Coins</CardTitle>
        <CardDescription>
          This page has been moved. Please use the "Scan QR Code" option from the menu to receive coins.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-center text-muted-foreground">
            Redirecting or use the navigation menu...
        </p>
      </CardContent>
    </Card>
  );
}
