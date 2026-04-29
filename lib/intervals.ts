import { ActivityStreams, Credentials, IntervalsActivity, SportType } from "@/lib/types";

interface AuthVariant {
  label: string;
  headers: HeadersInit;
}

interface AttemptResult {
  auth: string;
  status: number;
  bodySnippet: string;
}

function normalizeNumericId(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D+/g, "");
  return digits || trimmed;
}

function athletePathId(): string {
  return "0";
}

function activityIdCandidates(activity: IntervalsActivity): string[] {
  const rawCandidates = [
    activity.id,
    activity.activity_id,
    activity.icu_id,
    activity.id_num,
  ];

  const normalized = rawCandidates
    .filter((value): value is string | number => value !== undefined && value !== null)
    .map((value) => String(value).trim())
    .filter(Boolean)
    .flatMap((value) => {
      const numeric = normalizeNumericId(value);
      return numeric && numeric !== value ? [value, numeric] : [value];
    });

  return [...new Set(normalized)];
}


function authVariants(credentials: Credentials): AuthVariant[] {
  const apiKey = credentials.intervalsApiKey.trim();
  const athleteId = normalizeNumericId(credentials.athleteId);

  return [
    {
      label: "basic(API_KEY:apiKey)",
      headers: {
        Authorization: `Basic ${btoa(`API_KEY:${apiKey}`)}`,
        "Content-Type": "application/json",
      },
    },
    {
      label: "basic(apiKey:API_KEY)",
      headers: {
        Authorization: `Basic ${btoa(`${apiKey}:API_KEY`)}`,
        "Content-Type": "application/json",
      },
    },
    {
      label: "basic(athleteId:apiKey)",
      headers: {
        Authorization: `Basic ${btoa(`${athleteId}:${apiKey}`)}`,
        "Content-Type": "application/json",
      },
    },
    {
      label: "bearer(apiKey)",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
    {
      label: "x-api-key",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
    },
    {
      label: "api-key",
      headers: {
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
    },
  ];
}

async function readBodySnippet(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 240) || "<empty>";
  } catch {
    return "<unreadable body>";
  }
}

async function fetchWithAuthFallback(
  url: string,
  credentials: Credentials,
): Promise<{ response: Response; attempts: AttemptResult[] }> {
  const attempts: AttemptResult[] = [];

  for (const variant of authVariants(credentials)) {
    const response = await fetch(url, { headers: variant.headers });

    if (response.ok) {
      return { response, attempts };
    }

    const bodySnippet = await readBodySnippet(response);
    attempts.push({ auth: variant.label, status: response.status, bodySnippet });

    if (response.status !== 401 && response.status !== 403) {
      return { response, attempts };
    }
  }

  // Repeat the first request once so caller still receives a response handle.
  const fallback = await fetch(url, { headers: authVariants(credentials)[0].headers });
  return { response: fallback, attempts };
}

function sanitizeUrl(url: string): string {
  return url.replace(/(apiKey=)[^&]+/gi, "$1<redacted>");
}

function formatDebugMessage(prefix: string, url: string, attempts: AttemptResult[], status: number) {
  const details = attempts.length
    ? attempts
        .map((a) => `- ${a.auth}: HTTP ${a.status}; body: ${a.bodySnippet}`)
        .join("\n")
    : "- no auth fallback attempts recorded";

  return [
    `${prefix}: HTTP ${status}`,
    `Request: ${sanitizeUrl(url)}`,
    "Auth attempts:",
    details,
    "Debug checklist:",
    "1) Athlete path ID is forced to `0` (API-key owner) to avoid mismatched-athlete 403 errors.",
    "2) Regenerate Intervals.icu API key and ensure there are no extra spaces.",
    "3) Confirm your Intervals account/API key has API access permissions (some plans may restrict API).",
    "4) Verify the selected activity exists for this key and includes requested stream types (pace/watts/cadence/etc).",
    "5) If list loads but streams fail, the app now retries alternate activity ID fields from the activity payload.",
  ].join("\n");
}

export async function fetchRecentActivities(credentials: Credentials): Promise<IntervalsActivity[]> {
  const oldest = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const athleteId = athletePathId();
  const url = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${encodeURIComponent(oldest)}&limit=20`;
  const { response, attempts } = await fetchWithAuthFallback(url, credentials);

  if (!response.ok) {
    throw new Error(formatDebugMessage("Intervals.icu error", url, attempts, response.status));
  }

  return (await response.json()) as IntervalsActivity[];
}


async function fetchFirstWorkingStreamUrl(
  urls: string[],
  credentials: Credentials,
): Promise<{ response: Response; attempts: AttemptResult[]; requestUrl: string }> {
  const combined: AttemptResult[] = [];

  for (const url of urls) {
    const { response, attempts } = await fetchWithAuthFallback(url, credentials);
    combined.push(...attempts.map((a) => ({ ...a, auth: `${a.auth} @ ${url}` })));

    if (response.ok) {
      return { response, attempts: combined, requestUrl: url };
    }

    if (response.status !== 404) {
      return { response, attempts: combined, requestUrl: url };
    }
  }

  const lastUrl = urls[urls.length - 1];
  const { response, attempts } = await fetchWithAuthFallback(lastUrl, credentials);
  combined.push(...attempts.map((a) => ({ ...a, auth: `${a.auth} @ ${lastUrl}` })));
  return { response, attempts: combined, requestUrl: lastUrl };
}

export async function fetchActivityStreams(
  credentials: Credentials,
  activity: IntervalsActivity,
  sport: SportType,
): Promise<ActivityStreams> {
  const streamType =
    sport === "SWIM"
      ? "time,pace,swolf,strokeRate,heartrate"
      : sport === "RIDE"
      ? "time,watts,cadence,heartrate"
      : "time,pace,cadence,heartrate";

  const athleteId = athletePathId();
  const candidateIds = activityIdCandidates(activity);
  const streamUrls = candidateIds.flatMap((candidateId) => [
    `https://intervals.icu/api/v1/activity/${candidateId}/streams.json?types=${streamType}`,
    `https://intervals.icu/api/v1/athlete/${athleteId}/activities/${candidateId}/streams?types=${streamType}`,
    `https://intervals.icu/api/v1/athlete/${athleteId}/activity/${candidateId}/streams?types=${streamType}`,
  ]);

  const { response, attempts, requestUrl } = await fetchFirstWorkingStreamUrl(streamUrls, credentials);

  if (!response.ok) {
    throw new Error(formatDebugMessage("Intervals.icu stream error", requestUrl, attempts, response.status));
  }

  return (await response.json()) as ActivityStreams;
}
