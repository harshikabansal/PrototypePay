
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Send, Bot, User } from "lucide-react";
// Removed: import { faqChatbot as askPropo, type FaqChatbotInput } from "@/ai/flows/faq-chatbot-flow";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
}

// Embedded FAQ data and logic
const FAQS_DATA = [
  {
    q: "How can I make a payment using the app without an internet connection?",
    a: "The app uses secure offline protocols such as OTP-based device-to-device authentication, allowing you to complete transactions even when you or the recipient are not connected to the internet. As Propo, I can guide you through each step of the process to ensure your payment is successful and secure."
  },
  {
    q: "Is my transaction data safe and private when using the chatbot?",
    a: "Yes, your transaction data is protected using advanced encryption and security measures. I, Propo, am designed to handle sensitive information securely and never share your data without your consent."
  },
  {
    q: "What should I do if my payment fails or is not confirmed?",
    a: "If a payment fails or is not confirmed, I, Propo, will provide troubleshooting steps, such as verifying the OTP, checking device compatibility, or retrying the transaction. You can also request a transaction status update or escalate the issue to customer support directly through me."
  },
  {
    q: "Can the chatbot help me check my transaction history or balance?",
    a: "Absolutely! I, Propo, can instantly provide your recent transaction history, current balance, and other account details upon request, making it easy to track your spending and manage your finances."
  },
  {
    q: "What types of support can the chatbot provide?",
    a: "I, Propo, am available 24/7 to answer common questions, assist with payments, guide you through troubleshooting, and connect you to a human agent if needed. I am designed to automate repetitive tasks and provide real-time support for a seamless user experience."
  }
];

const FAQ_QUESTIONS_LIST_TEXT = FAQS_DATA.map((faq, index) => `${index + 1}. ${faq.q}`).join('\n');
const CUSTOMER_CARE_PHONE = "1-800-PROTOTYPE";
const CUSTOMER_CARE_EMAIL = "support@prototypepay.com";

const getPropoResponse = (userInput: string): string | string[] => {
  const lowerInput = userInput.toLowerCase().trim();

  // Handle greetings
  const greetings = ['hello', 'hi', 'good day', 'good morning', 'good afternoon', 'good evening', 'hey', 'sup', 'yo'];
  if (greetings.includes(lowerInput.replace(/[^\w\s]/gi, ''))) {
    let isOnlyGreeting = true;
    for (const faq of FAQS_DATA) {
        if (lowerInput.includes(faq.q.toLowerCase().substring(0,15))) { 
            isOnlyGreeting = false;
            break;
        }
    }
     if (lowerInput.split(" ").length > 3 && lowerInput.includes("?")) isOnlyGreeting = false;


    if (isOnlyGreeting) {
        const greetingMessages = [
            "Hello there! I'm Propo, your PrototypePay AI assistant.",
            "Greetings! Propo at your service.",
            "Hi! I am Propo, ready to help."
        ];
        const randomGreeting = greetingMessages[Math.floor(Math.random() * greetingMessages.length)];
        return [
            randomGreeting,
            `I can answer questions on the following topics based on our FAQs:\n${FAQ_QUESTIONS_LIST_TEXT}\n\nFeel free to ask me about any of these!`
        ];
    }
  }

  // Handle requests for listing all FAQs
  const listFaqTriggers = ["list all faqs", "show all questions", "what can you help with?", "what are your faqs?", "what questions can you answer?", "list faqs", "show faqs"];
  if (listFaqTriggers.some(trigger => lowerInput.includes(trigger))) {
    return `Certainly! I can answer questions on the following topics based on our FAQs:\n${FAQ_QUESTIONS_LIST_TEXT}\n\nFeel free to ask me about any of these!`;
  }

  // Attempt to match the question to FAQs
  for (const faq of FAQS_DATA) {
    const faqKeywords = faq.q.toLowerCase().split(" ").filter(word => word.length > 3); 
    const userWords = lowerInput.split(" ");
    
    let matchScore = 0;
    if (lowerInput.includes(faq.q.toLowerCase().substring(0, Math.min(faq.q.length, 25) ))) matchScore = faqKeywords.length; 
    else {
        faqKeywords.forEach(keyword => {
            if (userWords.some(userWord => userWord.includes(keyword))) {
            matchScore++;
            }
        });
    }

    if (matchScore > faqKeywords.length / 2 && matchScore > 1) { 
      return `${faq.a} I hope that clears things up! Can I help with anything else from our FAQs today?`;
    }
  }

  // If no match, handle questions not in FAQs
  return `I'm sorry, I don't have the answer to that in my current FAQ knowledge. For more complex queries, you can reach out to our PrototypePay support team at ${CUSTOMER_CARE_PHONE} or email ${CUSTOMER_CARE_EMAIL}. Can I help with anything else from our FAQs?`;
};


export function FaqChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollableViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollableViewport) {
        scrollableViewport.scrollTop = scrollableViewport.scrollHeight;
      }
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (input.trim() === "" || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: "user",
    };
    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");
    setIsLoading(true);

    // Simulate AI thinking time
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500));

    try {
      const propoResponseOutput = getPropoResponse(currentInput);
      
      const addBotMessage = (responseText: string) => {
        const botMessage: Message = {
          id: (Date.now() + Math.random()).toString(), // Ensure unique ID for potentially rapid messages
          text: responseText,
          sender: "bot",
        };
        setMessages((prevMessages) => [...prevMessages, botMessage]);
      };

      if (Array.isArray(propoResponseOutput)) {
        for (let i = 0; i < propoResponseOutput.length; i++) {
          addBotMessage(propoResponseOutput[i]);
          if (i < propoResponseOutput.length - 1) {
            // Optional: Add a small delay between Propo's messages
            await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 200));
          }
        }
      } else {
        addBotMessage(propoResponseOutput);
      }
    } catch (error: any) {
      console.error("Error generating Propo response (client-side):", error);
      toast({
        variant: "destructive",
        title: "Propo Error",
        description: error.message || "Could not get a response from Propo.",
      });
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Apologies, I encountered an internal hiccup. Please try your question again.",
        sender: "bot",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-xl flex flex-col h-[70vh]">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center">
          <Bot className="mr-2 h-7 w-7 text-primary" />
          Propo - Your PrototypePay AI Assistant
        </CardTitle>
        <CardDescription>Ask me, Propo, anything about PrototypePay based on our FAQs! (Offline Capable)</CardDescription>
      </CardHeader>
      
      <CardContent className="flex-grow overflow-hidden p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-end space-x-2 ${
                  message.sender === "user" ? "justify-end" : ""
                }`}
              >
                {message.sender === "bot" && (
                  <Avatar className="h-8 w-8">
                    <AvatarFallback><Bot size={18} /></AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-2 ${
                    message.sender === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                </div>
                {message.sender === "user" && (
                  <Avatar className="h-8 w-8">
                     <AvatarFallback><User size={18} /></AvatarFallback>
                  </Avatar>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center space-x-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback><Bot size={18} /></AvatarFallback>
                </Avatar>
                <div className="max-w-[70%] rounded-lg px-4 py-2 bg-muted text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter className="p-4 border-t">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex w-full items-center space-x-2"
        >
          <Input
            type="text"
            placeholder="Ask Propo a question..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            className="flex-grow"
            autoComplete="off"
          />
          <Button type="submit" disabled={isLoading} size="icon" aria-label="Send message">
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
