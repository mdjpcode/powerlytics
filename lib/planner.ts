import { PlannedInterval, SportType } from "@/lib/types";

function parseTimeToken(input: string): number {
  const token = input.trim().toLowerCase();
  const minMatch = token.match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)$/);
  if (minMatch) return Math.round(Number(minMatch[1]) * 60);

  const secMatch = token.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds)$/);
  if (secMatch) return Math.round(Number(secMatch[1]));

  const plainNum = token.match(/^(\d+(?:\.\d+)?)$/);
  return plainNum ? Math.round(Number(plainNum[1]) * 60) : 0;
}

function parsePaceToken(token: string): number {
  const mmss = token.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!mmss) return 0;
  return Number(mmss[1]) * 60 + Number(mmss[2]);
}

export function parseWorkoutText(input: string, sport: SportType): PlannedInterval[] {
  const normalized = input.toLowerCase();
  const regex = /(\d+)\s*x\s*(\d+(?:\.\d+)?\s*(?:m|min|mins|s|sec|secs|minutes|seconds)?)\s*(?:@|at)\s*([\d:.]+)\s*([a-z/%]*)/gi;
  const matches = [...normalized.matchAll(regex)];

  const intervals: PlannedInterval[] = [];
  let idx = 1;

  for (const m of matches) {
    const reps = Number(m[1]);
    const durationSec = parseTimeToken(m[2]);
    const targetRaw = m[3];
    const unit = m[4] ?? "";

    for (let r = 0; r < reps; r += 1) {
      let metric: PlannedInterval["metric"] = "watts";
      let target = Number(targetRaw);

      if (sport === "RUN" || sport === "SWIM" || unit.includes("pace") || targetRaw.includes(":")) {
        metric = "pace";
        target = parsePaceToken(targetRaw);
      } else if (unit.includes("hr") || unit.includes("bpm")) {
        metric = "heartrate";
      }

      intervals.push({
        index: idx,
        durationSec,
        target,
        metric,
        rawLabel: `${m[2]} @ ${targetRaw}${unit ? ` ${unit}` : ""}`,
      });
      idx += 1;
    }
  }

  return intervals;
}
