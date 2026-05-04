import { AnalyzedInterval } from "@/lib/types";

interface GeminiPayload {
  planText: string;
  compliance: number;
  results: AnalyzedInterval[];
  sport: string;
}

const GEMINI_MODEL = "gemini-2.5-flash";

export class GeminiQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiQuotaError";
  }
}

interface GeminiErrorBody {
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

function bestAndWorstIntervals(results: AnalyzedInterval[]) {
  const sorted = [...results].sort((a, b) => b.deltaPercent - a.deltaPercent);
  return {
    best: sorted[0],
    weakest: sorted[sorted.length - 1],
  };
}

export function generateLocalInsight(payload: GeminiPayload): string {
  const { best, weakest } = bestAndWorstIntervals(payload.results);
  const compliance = payload.compliance.toFixed(1);
  const sportLabel = payload.sport.toLowerCase();

  if (!payload.results.length) {
    return 'Local coaching summary: I could not find parsed intervals to analyze yet. Add a planned workout such as "5x5 min @ 4:30" for run/swim pace or "5x5 min @ 300W" for bike power, then generate insight again.';
  }

  const trend =
    payload.compliance >= 90
      ? "You matched the plan closely, with only small deviations from the target."
      : payload.compliance >= 75
      ? "You were broadly on plan, but a few intervals drifted enough to be worth reviewing."
      : "The executed session diverged meaningfully from the plan, so the useful takeaway is pacing control rather than the headline average.";

  const bestText = best
    ? `Best-matched interval was #${best.interval.index}, averaging ${best.actualAverage.toFixed(1)} against a target of ${best.interval.target.toFixed(1)}.`
    : "";
  const weakestText = weakest
    ? `The biggest gap was #${weakest.interval.index}, averaging ${weakest.actualAverage.toFixed(1)} against ${weakest.interval.target.toFixed(1)}.`
    : "";

  return [
    `Local coaching summary: ${sportLabel} compliance was ${compliance}%. ${trend}`,
    `${bestText} ${weakestText}`.trim(),
    "For the next session, aim to settle into the target earlier in each rep and keep the recovery controlled so the later intervals do not drift.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function readGeminiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as GeminiErrorBody;
    return body.error?.message ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function generateGeminiInsight(apiKey: string, payload: GeminiPayload): Promise<string> {
  const systemPrompt = `You are a supportive triathlon and endurance coach. Respond with 2-3 concise paragraphs: summary, pacing/cadence/efficiency insight, and advice for next session.`;
  const intervalSummary = payload.results.map((result) => ({
    interval: result.interval.index,
    target: Number(result.interval.target.toFixed(1)),
    actualAverage: Number(result.actualAverage.toFixed(1)),
    compliance: Number(result.deltaPercent.toFixed(1)),
  }));

  const body = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\nSport: ${payload.sport}\nPlan: ${payload.planText}\nCompliance: ${payload.compliance.toFixed(1)}%\nInterval results: ${JSON.stringify(intervalSummary)}`,
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 450,
      temperature: 0.4,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey.trim()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const detail = await readGeminiError(response);
    if (response.status === 429) {
      throw new GeminiQuotaError(
        `Gemini quota or rate limit reached. Wait a minute and try again, or check this API key's Google AI Studio quota/billing. Gemini said: ${detail}`,
      );
    }
    throw new Error(`Gemini API error: ${response.status}. ${detail}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "No insight generated.";
}
