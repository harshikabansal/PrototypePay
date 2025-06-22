import type React from 'react';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-primary/30 via-background to-accent/30 p-4">
      <main className="w-full max-w-md rounded-xl bg-card p-8 shadow-2xl">
        {children}
      </main>
      <footer className="mt-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PrototypePay. All rights reserved.</p>
      </footer>
    </div>
  );
}
