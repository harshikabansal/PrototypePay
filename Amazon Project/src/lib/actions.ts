
"use server";

import { detectFraud as genkitDetectFraud, type DetectFraudInput } from "@/ai/flows/detect-fraud";
import { analyzeCoinUsage as genkitAnalyzeCoinUsage, type AnalyzeCoinUsageInput, type AnalyzeCoinUsageOutput } from "@/ai/flows/analyze-coin-usage-flow";

interface DetectFraudActionResult {
  isFraudulent?: boolean;
  fraudExplanation?: string;
  riskScore?: number;
  error?: string;
}

export async function detectFraudAction(input: DetectFraudInput): Promise<DetectFraudActionResult> {
  try {
    const result = await genkitDetectFraud(input);
    return result;
  } catch (error) {
    console.error("Error in detectFraudAction:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: "An unknown error occurred during fraud detection." };
  }
}

// The component will now pass `currentDate`
export async function analyzeCoinUsageAction(input: AnalyzeCoinUsageInput): Promise<AnalyzeCoinUsageOutput & { error?: string }> {
  try {
    // Use the date from the client if provided, otherwise default to now.
    // This ensures the AI's context of "today" matches the user's.
    const analysisInput = {
      ...input,
      currentDate: input.currentDate || new Date().toISOString(),
    };
    const result = await genkitAnalyzeCoinUsage(analysisInput);
    return result;
  } catch (error) {
    console.error("Error in analyzeCoinUsageAction:", error);
    const fallbackOutput: AnalyzeCoinUsageOutput = {
      totalCoinsSpent: 0,
      numberOfTransactions: 0,
      analysisPeriodDays: 0,
      oldestTransactionIsoDate: null,
      latestTransactionIsoDate: null,
      historicalAverages: { daily: 0 },
      spendingForecast: { forecastForRestOfMonth: 0 },
      monthlyChartData: [],
      calculationNotes: "Error performing analysis.",
    };
    if (error instanceof Error) {
      return { ...fallbackOutput, error: error.message, calculationNotes: `Error: ${error.message}` };
    }
    return { ...fallbackOutput, error: "An unknown error occurred during coin usage analysis.", calculationNotes: "Unknown error during analysis." };
  }
}
