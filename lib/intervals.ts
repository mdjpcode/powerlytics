import { ActivityStreams, Credentials, IntervalsActivity, SportType } from "@/lib/types";

function buildHeaders(apiKey: string) {
  return {
    Authorization: `Basic ${btoa(`API_KEY:${apiKey}`)}`,
    "Content-Type": "application/json",
  };
}

export async function fetchRecentActivities(credentials: Credentials): Promise<IntervalsActivity[]> {
  const oldest = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
  const url = `https://intervals.icu/api/v1/athlete/${credentials.athleteId}/activities?oldest=${encodeURIComponent(oldest)}&limit=20`;
  const response = await fetch(url, { headers: buildHeaders(credentials.intervalsApiKey) });
  if (!response.ok) {
    throw new Error(`Intervals.icu error: ${response.status}`);
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
  const response = await fetch(url, { headers: buildHeaders(credentials.intervalsApiKey) });
  if (!response.ok) {
    throw new Error(`Intervals.icu stream error: ${response.status}`);
  }

  return (await response.json()) as ActivityStreams;
}
