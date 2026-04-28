import { ActivityStreams, Credentials, IntervalsActivity, SportType } from "@/lib/types";

function authVariants(credentials: Credentials): HeadersInit[] {
  const apiKey = credentials.intervalsApiKey.trim();
  const athleteId = credentials.athleteId.trim();

  return [
    {
      Authorization: `Basic ${btoa(`API_KEY:${apiKey}`)}`,
      "Content-Type": "application/json",
    },
    {
      Authorization: `Basic ${btoa(`${athleteId}:${apiKey}`)}`,
      "Content-Type": "application/json",
    },
    {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  ];
}

async function fetchWithAuthFallback(url: string, credentials: Credentials): Promise<Response> {
  let lastResponse: Response | null = null;

  for (const headers of authVariants(credentials)) {
    const response = await fetch(url, { headers });

    if (response.ok) {
      return response;
    }

    lastResponse = response;

    // If authentication is not the issue, do not continue retrying with other auth shapes.
    if (response.status !== 401 && response.status !== 403) {
      return response;
    }
  }

  if (!lastResponse) {
    throw new Error("Intervals.icu request failed before receiving a response.");
  }

  return lastResponse;
}

function buildIntervalsError(prefix: string, status: number): string {
  if (status === 401 || status === 403) {
    return `${prefix}: ${status}. Access denied. Verify Athlete ID + API key in Intervals.icu settings and confirm API access is enabled for the key.`;
  }
  return `${prefix}: ${status}`;
}

export async function fetchRecentActivities(credentials: Credentials): Promise<IntervalsActivity[]> {
  const oldest = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://intervals.icu/api/v1/athlete/${credentials.athleteId}/activities?oldest=${encodeURIComponent(oldest)}&limit=20`;
  const response = await fetchWithAuthFallback(url, credentials);

  if (!response.ok) {
    throw new Error(buildIntervalsError("Intervals.icu error", response.status));
  }

  return (await response.json()) as IntervalsActivity[];
}

export async function fetchActivityStreams(
  credentials: Credentials,
  activityId: string,
  sport: SportType,
): Promise<ActivityStreams> {
  const streamType =
    sport === "SWIM"
      ? "time,pace,swolf,strokeRate,heartrate"
      : sport === "RIDE"
      ? "time,watts,cadence,heartrate"
      : "time,pace,cadence,heartrate";

  const url = `https://intervals.icu/api/v1/athlete/${credentials.athleteId}/activities/${activityId}/streams?types=${streamType}`;
  const response = await fetchWithAuthFallback(url, credentials);

  if (!response.ok) {
    throw new Error(buildIntervalsError("Intervals.icu stream error", response.status));
  }

  return (await response.json()) as ActivityStreams;
}
