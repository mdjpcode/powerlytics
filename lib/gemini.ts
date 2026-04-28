import { AnalyzedInterval } from "@/lib/types";

interface GeminiPayload {
  planText: string;
  compliance: number;
  results: AnalyzedInterval[];
  sport: string;
}

export async function generateGeminiInsight(apiKey: string, payload: GeminiPayload): Promise<string> {
  const systemPrompt = `You are a supportive triathlon and endurance coach. Respond with 2-3 concise paragraphs: summary, pacing/cadence/efficiency insight, and advice for next session.`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nSport: ${payload.sport}\nPlan: ${payload.planText}\nCompliance: ${payload.compliance.toFixed(1)}%\nInterval results: ${JSON.stringify(payload.results)}`,
          },
        ],
      },
    ],
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No insight generated.";
}
