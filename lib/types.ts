export type SportType = "SWIM" | "RIDE" | "RUN";

export interface Credentials {
  athleteId: string;
  intervalsApiKey: string;
  geminiApiKey: string;
  saveForNextTime: boolean;
}

export interface IntervalsActivity {
  id: string;
  name?: string;
  start_date_local?: string;
  type?: string;
  sport?: string;
  distance?: number;
  moving_time?: number;
}

export interface ActivityStreams {
  time: number[];
  watts?: number[];
  heartrate?: number[];
  cadence?: number[];
  pace?: number[];
  swolf?: number[];
  strokeRate?: number[];
}

export interface PlannedInterval {
  index: number;
  durationSec: number;
  target: number;
  metric: "watts" | "pace" | "heartrate";
  rawLabel: string;
}

export interface AnalyzedInterval {
  interval: PlannedInterval;
  actualAverage: number;
  deltaPercent: number;
}

export interface ZoneResult {
  zone: string;
  seconds: number;
}
