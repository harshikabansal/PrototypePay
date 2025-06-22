
"use client";

import type React from 'react';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/AppContext';
import { Header } from '@/components/layout/Header';
import { FloatingChatbotButton } from '@/components/chatbot/FloatingChatbotButton';
import { motion, AnimatePresence } from 'framer-motion';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAppContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
     // Wait for context to determine auth status
    if (user !== undefined) { // Check if context has loaded user state
      if (!isAuthenticated) {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, user, router]);

  if (user === undefined) { // Context is loading
    return <div className="flex h-screen items-center justify-center"><p>Loading App...</p></div>;
  }
  
  if (!isAuthenticated) { // Should be caught by useEffect, but as a safeguard
    return null; // Or a loading/redirecting message
  }

  const pageVariants = {
    hidden: { opacity: 0, x: "100%" },    // Start off-screen to the right
    enter: { opacity: 1, x: "0%" },      // Animate to center
    exit: { opacity: 0, x: "-100%" },     // Animate off-screen to the left
  };

  const pageTransition = {
    type: "tween",
    ease: "easeInOut",
    duration: 0.4,
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1 container py-8 overflow-x-hidden"> {/* overflow-x-hidden is crucial */}
        <AnimatePresence mode="wait" initial={false}> {/* mode="wait" ensures one animation completes before the next */}
          <motion.div
            key={pathname} // Keyed by pathname to trigger animation on route change
            variants={pageVariants}
            initial="hidden"
            animate="enter"
            exit="exit"
            transition={pageTransition} // Apply the consistent transition configuration
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      {pathname !== '/chatbot' && <FloatingChatbotButton />} {/* Conditionally render the button */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t">
         &copy; {new Date().getFullYear()} PrototypePay. Your secure coin platform.
      </footer>
    </div>
  );
}
