
import { config } from 'dotenv';
config();

import '@/ai/flows/detect-fraud.ts';
// Removed AI-based OTP generation: import '@/ai/flows/generate-otp.ts';
import '@/ai/flows/faq-chatbot-flow.ts';
import '@/ai/flows/analyze-coin-usage-flow.ts'; // Added new flow
