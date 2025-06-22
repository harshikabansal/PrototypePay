
import { FaqChatbot } from '@/components/chatbot/FaqChatbot';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ Chatbot | PrototypePay',
  description: 'Get answers to frequently asked questions about PrototypePay.',
};

export default function ChatbotPage() {
  return (
    <div className="container mx-auto py-8 flex flex-col items-center">
      <FaqChatbot />
    </div>
  );
}
