import { ActivityStreams, AnalyzedInterval, PlannedInterval, SportType, ZoneResult } from "@/lib/types";

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, n) => acc + n, 0) / values.length;
}

export function metricForSport(sport: SportType): keyof ActivityStreams {
  if (sport === "RIDE") return "watts";
  return "pace";
}

export function analyzeIntervals(
  planned: PlannedInterval[],
  streams: ActivityStreams,
  sport: SportType,
): AnalyzedInterval[] {
  const metricKey = metricForSport(sport);
  const signal = (streams[metricKey] as number[]) ?? [];

  let cursor = 0;

  return planned.map((interval) => {
    const bucket = signal.slice(cursor, cursor + interval.durationSec);
    cursor += interval.durationSec;
    const actualAverage = average(bucket);
    const deltaPercent = interval.target
      ? 100 - Math.min(100, (Math.abs(actualAverage - interval.target) / interval.target) * 100)
      : 0;

    return {
      interval,
      actualAverage,
      deltaPercent,
    };
  });
}

export function calculateCompliance(results: AnalyzedInterval[]): number {
  if (!results.length) return 0;
  return results.reduce((acc, r) => acc + r.deltaPercent, 0) / results.length;
}

export function calculateTimeInZones(values: number[], sport: SportType): ZoneResult[] {
  if (!values.length) return [];
  const thresholds =
    sport === "RIDE"
      ? [120, 180, 240, 300]
      : sport === "RUN"
      ? [240, 300, 360, 420]
      : [90, 110, 130, 150];

  const zones = [0, 0, 0, 0, 0];
  values.forEach((v) => {
    if (v < thresholds[0]) zones[0] += 1;
    else if (v < thresholds[1]) zones[1] += 1;
    else if (v < thresholds[2]) zones[2] += 1;
    else if (v < thresholds[3]) zones[3] += 1;
    else zones[4] += 1;
  });

  return zones.map((seconds, idx) => ({
    zone: `Z${idx + 1}`,
    seconds,
  }));
}
