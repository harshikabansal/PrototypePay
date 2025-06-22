"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/AppContext';

export default function HomePage() {
  const { isAuthenticated, user } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    // Wait for context to determine auth status
    if (user !== undefined) { // Check if context has loaded user state
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, user, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <p className="text-foreground">Loading PrototypePay...</p>
      {/* You can add a spinner here */}
    </div>
  );
}
