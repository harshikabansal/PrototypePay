
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Bot } from 'lucide-react';

export function FloatingChatbotButton() {
  return (
    <Button
      asChild
      variant="outline"
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground border-2 border-background z-50 flex items-center justify-center"
      aria-label="Open Propo Chatbot"
    >
      <Link href="/chatbot">
        <Bot className="h-7 w-7" />
      </Link>
    </Button>
  );
}
