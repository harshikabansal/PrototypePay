// This is an AI-powered fraud detection agent for transactions.
//
// - detectFraud - A function that handles the fraud detection process.
// - DetectFraudInput - The input type for the detectFraud function.
// - DetectFraudOutput - The return type for the detectFraud function.

'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DetectFraudInputSchema = z.object({
  transactionDetails: z
    .string()
    .describe('Details of the transaction, including sender, receiver, amount, and timestamp.'),
  userHistory: z
    .string()
    .describe('The user transaction history, including past transactions and account details.'),
});
export type DetectFraudInput = z.infer<typeof DetectFraudInputSchema>;

const DetectFraudOutputSchema = z.object({
  isFraudulent: z
    .boolean()
    .describe(
      'Whether the transaction is determined to be fraudulent based on the analysis.'
    ),
  fraudExplanation: z
    .string()
    .describe('Explanation of why the transaction is considered fraudulent.'),
  riskScore: z.number().describe('A numerical risk score indicating the likelihood of fraud.'),
});
export type DetectFraudOutput = z.infer<typeof DetectFraudOutputSchema>;

export async function detectFraud(input: DetectFraudInput): Promise<DetectFraudOutput> {
  return detectFraudFlow(input);
}

const prompt = ai.definePrompt({
  name: 'detectFraudPrompt',
  input: {schema: DetectFraudInputSchema},
  output: {schema: DetectFraudOutputSchema},
  prompt: `You are an AI security expert tasked with detecting fraudulent transactions.
  Analyze the provided transaction details and user history to determine if the transaction is fraudulent.
  Provide a fraud explanation and a risk score between 0 and 1 (0 being very low risk, 1 being very high risk).

  Transaction Details: {{{transactionDetails}}}
  User History: {{{userHistory}}} `,
});

const detectFraudFlow = ai.defineFlow(
  {
    name: 'detectFraudFlow',
    inputSchema: DetectFraudInputSchema,
    outputSchema: DetectFraudOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
