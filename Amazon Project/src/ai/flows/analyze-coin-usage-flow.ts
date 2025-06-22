
'use server';
/**
 * @fileOverview Analyzes coin usage patterns and provides spending forecasts.
 *
 * - analyzeCoinUsage - A function that analyzes transaction history.
 * - AnalyzeCoinUsageInput - The input type for the analyzeCoinUsage function.
 * - AnalyzeCoinUsageOutput - The return type for the analyzeCoinUsage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCoinUsageInputSchema = z.object({
  userUpiId: z.string().describe("The UPI ID of the user whose coin usage is being analyzed."),
  transactionHistoryJson: z.string().describe("A JSON string representing an array of the user's outgoing 'claimed' or 'pending' OTP coin transactions. Each object should conform to a structure including 'type' (should be 'otp'), 'status' (should be 'claimed' or 'pending'), 'amount', 'senderUpiId', and a date property ('createdAtISO' in ISO 8601 format). Use 'createdAtISO' for all date calculations."),
  currentDate: z.string().optional().describe("The current date in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ). To be used for calculations like 'rest of month' forecast."),
});
export type AnalyzeCoinUsageInput = z.infer<typeof AnalyzeCoinUsageInputSchema>;

const AnalyzeCoinUsageOutputSchema = z.object({
  totalCoinsSpent: z.number().describe("Total coins spent in user-to-user transactions during the analysis period."),
  numberOfTransactions: z.number().describe("Total number of user-to-user spending transactions analyzed."),
  analysisPeriodDays: z.number().describe("The total number of days covered by the transaction history (from oldest to newest relevant transaction)."),
  oldestTransactionIsoDate: z.string().nullable().describe("The date of the oldest relevant transaction used in ISO format (YYYY-MM-DD). Null if no transactions."),
  latestTransactionIsoDate: z.string().nullable().describe("The date of the latest relevant transaction used in ISO format (YYYY-MM-DD). Null if no transactions."),
  
  historicalAverages: z.object({
    daily: z.number().describe("Average daily coins spent by the user. Calculated as total spent divided by analysis period days."),
    monthly: z.number().optional().describe("Historical average monthly spend. Only calculated if there is at least one full calendar month of transaction data. Otherwise, this field is omitted."),
    yearly: z.number().optional().describe("Historical average yearly spend. Only calculated if there is at least one full calendar year of transaction data. Otherwise, this field is omitted."),
  }).describe("Calculated historical averages based on available data."),

  spendingForecast: z.object({
      forecastForRestOfMonth: z.number().describe("Projected spend for the remainder of the current calendar month, based on the historical daily average."),
  }).describe("Predictable spending based on extrapolation of daily average."),

  monthlyChartData: z.array(z.object({
    month: z.string().describe("The month, formatted as 'MMM YYYY' (e.g., 'Jan 2024')."),
    actual: z.number().optional().describe("The actual total amount spent in that month. Should be present for past months."),
    predicted: z.number().optional().describe("The predicted spending for that month. Should be present for the current and future months."),
  })).describe("Data for charting monthly spending. Includes historical actuals and future predictions."),

  calculationNotes: z.string().optional().describe("Any notes about the calculation, e.g., if the forecast is based on limited data."),
});
export type AnalyzeCoinUsageOutput = z.infer<typeof AnalyzeCoinUsageOutputSchema>;

export async function analyzeCoinUsage(input: AnalyzeCoinUsageInput): Promise<AnalyzeCoinUsageOutput> {
  return analyzeCoinUsageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCoinUsagePrompt',
  input: {schema: AnalyzeCoinUsageInputSchema},
  output: {schema: AnalyzeCoinUsageOutputSchema},
  prompt: `
You are a financial analyst AI called Propo. Your task is to analyze a user's **user-to-user coin transaction history** and provide both a historical analysis and a spending forecast.
The user's UPI ID is {{{userUpiId}}}.
The transaction history is provided as a JSON string: {{{transactionHistoryJson}}}
**IMPORTANT: All date calculations must use the 'createdAtISO' field from the transaction history, which is in standard ISO 8601 format.**
You are given the current date as an ISO string in the 'currentDate' input: {{{currentDate}}}. Use this for time-sensitive calculations.

**IMPORTANT: Only consider transactions where 'type' is 'otp', ('status' (case-insensitive) is "claimed" OR 'status' is "pending"), AND 'senderUpiId' (case-insensitive) matches '{{{userUpiId}}}' (case-insensitive). These are the user's outgoing, successful or pending peer-to-peer coin transfers.**

Follow these steps precisely:

1.  **Parse and Filter Transactions**:
    *   Parse the \`transactionHistoryJson\`. If it's invalid or empty, return a default object with all numbers as 0, dates as null, arrays as empty, and a note in 'calculationNotes'.
    *   Filter for relevant spending transactions: \`type\` is "otp", \`senderUpiId\` matches the user's, and \`status\` is "claimed" or "pending".
    *   If no relevant transactions are found, return a default object with a note in 'calculationNotes'.

2.  **Basic Calculations**:
    *   Sort relevant transactions chronologically using the \`createdAtISO\` field.
    *   Calculate \`totalCoinsSpent\` and \`numberOfTransactions\`.
    *   Determine \`oldestTransactionIsoDate\` and \`latestTransactionIsoDate\` (from \`createdAtISO\`, formatted as YYYY-MM-DD).
    *   Calculate \`analysisPeriodDays\`: the number of days from the start of the oldest transaction's day to the end of the newest transaction's day, based on the \`createdAtISO\` fields. If only one day of txs, this is 1. Use UTC.

3.  **Historical Averages**:
    *   Calculate \`historicalAverages.daily\` = \`totalCoinsSpent\` / \`analysisPeriodDays\`. If period is 0, this is 0.
    *   Calculate \`historicalAverages.monthly\` *only if* the analysis period spans at least one full calendar month. If so, calculate it as (total spent / number of months with activity). If not, **OMIT** the \`monthly\` field from the \`historicalAverages\` object.
    *   Calculate \`historicalAverages.yearly\` *only if* the analysis period spans at least one full calendar year. If so, calculate it as (total spent / number of years with activity). If not, **OMIT** the \`yearly\` field from the \`historicalAverages\` object.

4.  **Spending Forecast**:
    *   This section is for extrapolation. Use the provided \`currentDate\`.
    *   Calculate \`spendingForecast.forecastForRestOfMonth\`: Based on the daily average, project spending for the remaining days of the *current* calendar month.

5.  **Monthly Chart Data ('monthlyChartData')**:
    *   Create the \`monthlyChartData\` array. It should contain objects for each month from the first month of transactions up to 2 months into the future.
    *   **For past months with transactions**: Create an object with \`month\`, and \`actual\` (which is the sum of spending in that month).
    *   **For past months within the range that have NO transactions (to fill gaps)**: Create an object with \`month\` and \`actual: 0\`.
    *   **For the current month**: Create one object with \`month\`, \`actual\` (spending so far this month), and \`predicted\` (total projected spend for the whole month, calculated as \`actual\` so far + forecast for the rest of the month).
    *   **For the next 2 future months**: Create objects with \`month\` and \`predicted\` (total projected spend for that month, calculated as historical daily average * number of days in that month). Omit \`actual\` for future months.
    *   The final array should be sorted chronologically.

6.  **Calculation Notes**:
    *   Populate \`calculationNotes\` with helpful context.
    *   **Crucially**, if \`analysisPeriodDays\` is less than 30, add a note like: "Spending forecast is based on a very short period of data (<30 days) and may not be representative."

7.  **Final Output**:
    *   Populate all fields of the \`AnalyzeCoinUsageOutputSchema\`. Round all monetary values to 2 decimal places.
`,
});

const analyzeCoinUsageFlow = ai.defineFlow(
  {
    name: 'analyzeCoinUsageFlow',
    inputSchema: AnalyzeCoinUsageInputSchema,
    outputSchema: AnalyzeCoinUsageOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    
    // Default structure for fallback
    const fallbackOutput: AnalyzeCoinUsageOutput = {
        totalCoinsSpent: 0,
        numberOfTransactions: 0,
        analysisPeriodDays: 0,
        oldestTransactionIsoDate: null,
        latestTransactionIsoDate: null,
        historicalAverages: { daily: 0 },
        spendingForecast: { forecastForRestOfMonth: 0 },
        monthlyChartData: [],
        calculationNotes: "Failed to generate analysis. AI output was empty.",
    };

    if (!output) {
        return fallbackOutput;
    }

    // Ensure all nested objects and numbers are correctly typed and present
    return {
        totalCoinsSpent: Number(output.totalCoinsSpent || 0),
        numberOfTransactions: Number(output.numberOfTransactions || 0),
        analysisPeriodDays: Number(output.analysisPeriodDays || 0),
        oldestTransactionIsoDate: output.oldestTransactionIsoDate || null,
        latestTransactionIsoDate: output.latestTransactionIsoDate || null,
        historicalAverages: {
            daily: Number(output.historicalAverages?.daily || 0),
            monthly: output.historicalAverages?.monthly ? Number(output.historicalAverages.monthly) : undefined,
            yearly: output.historicalAverages?.yearly ? Number(output.historicalAverages.yearly) : undefined,
        },
        spendingForecast: {
            forecastForRestOfMonth: Number(output.spendingForecast?.forecastForRestOfMonth || 0),
        },
        monthlyChartData: output.monthlyChartData || [],
        calculationNotes: output.calculationNotes || "No notes from Propo.",
    };
  }
);
