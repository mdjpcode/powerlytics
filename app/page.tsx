"use client";

import { useMemo, useState, useEffect } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
} from "recharts";
import { analyzeIntervals, calculateCompliance, calculateTimeInZones, metricForSport } from "@/lib/analysis";
import { generateGeminiInsight } from "@/lib/gemini";
import { fetchActivityStreams, fetchRecentActivities } from "@/lib/intervals";
import { parseWorkoutText } from "@/lib/planner";
import { loadSavedCredentials, persistCredentials } from "@/lib/storage";
import { ActivityStreams, Credentials, IntervalsActivity, SportType } from "@/lib/types";

const defaultCredentials: Credentials = {
  athleteId: "",
  intervalsApiKey: "",
  geminiApiKey: "",
  saveForNextTime: true,
};

function getSport(activity: IntervalsActivity): SportType {
  const raw = (activity.type ?? activity.sport ?? "").toUpperCase();
  if (raw.includes("SWIM")) return "SWIM";
  if (raw.includes("RUN")) return "RUN";
  return "RIDE";
}

export default function Home() {
  const [credentials, setCredentials] = useState<Credentials>(defaultCredentials);
  const [authenticated, setAuthenticated] = useState(false);
  const [activities, setActivities] = useState<IntervalsActivity[]>([]);
  const [selected, setSelected] = useState<IntervalsActivity | null>(null);
  const [streams, setStreams] = useState<ActivityStreams | null>(null);
  const [planText, setPlanText] = useState("");
  const [insight, setInsight] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const sport = selected ? getSport(selected) : "RIDE";
  const metric = metricForSport(sport);

  useEffect(() => {
    const saved = loadSavedCredentials();
    if (saved) {
      setCredentials(saved);
    }
  }, []);

  const analysis = useMemo(() => {
    if (!streams || !planText.trim() || !selected) return null;
    const parsed = parseWorkoutText(planText, sport);
    const intervalResults = analyzeIntervals(parsed, streams, sport);
    const compliance = calculateCompliance(intervalResults);
    const metricSeries = ((streams[metric] as number[]) ?? []).slice(0, 1200);
    const zones = calculateTimeInZones(metricSeries, sport);
    const plot = metricSeries.map((actual, i) => {
      const planned = intervalResults.find((r) => {
        const start = intervalResults
          .slice(0, r.interval.index - 1)
          .reduce((acc, curr) => acc + curr.interval.durationSec, 0);
        return i >= start && i < start + r.interval.durationSec;
      })?.interval.target;

      return { second: i, actual, planned: planned ?? null };
    });

    return { parsed, intervalResults, compliance, zones, plot };
  }, [metric, planText, selected, sport, streams]);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const recent = await fetchRecentActivities(credentials);
      setActivities(recent);
      setAuthenticated(true);
      persistCredentials(credentials);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    } finally {
      setLoading(false);
    }
  }

  async function openActivity(activity: IntervalsActivity) {
    setSelected(activity);
    setInsight("");
    setError("");
    setLoading(true);
    try {
      const sportType = getSport(activity);
      const data = await fetchActivityStreams(credentials, activity.id, sportType);
      setStreams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch streams");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateInsight() {
    if (!analysis || !selected) return;
    setLoading(true);
    setError("");
    try {
      const text = await generateGeminiInsight(credentials.geminiApiKey, {
        planText,
        compliance: analysis.compliance,
        results: analysis.intervalResults,
        sport,
      });
      setInsight(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate insight");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl p-6 lg:p-10">
      <h1 className="text-3xl font-bold">Powerlytics Training Dashboard</h1>
      <p className="mt-2 text-slate-300">Compare planned workouts against your executed Intervals.icu activity and get AI coaching insights.</p>

      {!authenticated && (
        <form onSubmit={handleConnect} className="mt-8 grid gap-4 rounded-xl border border-slate-700 bg-slate-900 p-6 lg:grid-cols-2">
          <label className="grid gap-1">
            <span>Athlete ID</span>
            <input
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
              value={credentials.athleteId}
              onChange={(e) => setCredentials((c) => ({ ...c, athleteId: e.target.value }))}
              required
            />
          </label>
          <label className="grid gap-1">
            <span>Intervals.icu API Key</span>
            <input
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
              value={credentials.intervalsApiKey}
              onChange={(e) => setCredentials((c) => ({ ...c, intervalsApiKey: e.target.value }))}
              required
              type="password"
            />
          </label>
          <label className="grid gap-1 lg:col-span-2">
            <span>Gemini API Key</span>
            <input
              className="rounded border border-slate-600 bg-slate-950 px-3 py-2"
              value={credentials.geminiApiKey}
              onChange={(e) => setCredentials((c) => ({ ...c, geminiApiKey: e.target.value }))}
              required
              type="password"
            />
          </label>
          <label className="flex items-center gap-2 lg:col-span-2">
            <input
              type="checkbox"
              checked={credentials.saveForNextTime}
              onChange={(e) => setCredentials((c) => ({ ...c, saveForNextTime: e.target.checked }))}
            />
            Save for next time (browser localStorage)
          </label>
          <button className="rounded bg-cyan-600 px-4 py-2 font-semibold hover:bg-cyan-500 lg:col-span-2" type="submit" disabled={loading}>
            {loading ? "Connecting..." : "Connect and Load Activities"}
          </button>
        </form>
      )}

      {authenticated && (
        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <aside className="rounded-xl border border-slate-700 bg-slate-900 p-4 lg:col-span-1">
            <h2 className="mb-3 text-xl font-semibold">Recent Activities</h2>
            <div className="grid gap-2">
              {activities.map((activity) => (
                <button
                  key={activity.id}
                  onClick={() => openActivity(activity)}
                  className="rounded border border-slate-700 bg-slate-800 p-3 text-left hover:border-cyan-500"
                >
                  <p className="font-semibold">{activity.name ?? "Untitled Activity"}</p>
                  <p className="text-sm text-slate-300">{new Date(activity.start_date_local ?? "").toLocaleString()}</p>
                  <p className="text-xs uppercase tracking-wide text-cyan-300">{getSport(activity)}</p>
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
              <h2 className="text-xl font-semibold">Workout Plan Input</h2>
              <textarea
                value={planText}
                onChange={(e) => setPlanText(e.target.value)}
                placeholder="Example: 5x5 min @ 300W"
                className="mt-3 min-h-28 w-full rounded border border-slate-600 bg-slate-950 p-3"
              />
              <button
                onClick={handleGenerateInsight}
                disabled={!analysis || loading}
                className="mt-3 rounded bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                Generate Gemini Coaching Insight
              </button>
            </section>

            {insight && <section className="whitespace-pre-wrap rounded-xl border border-emerald-600 bg-slate-900 p-5 leading-relaxed">{insight}</section>}

            {analysis && (
              <>
                <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <h3 className="text-lg font-semibold">Workout Compliance: {analysis.compliance.toFixed(1)}%</h3>
                  <div className="mt-4 h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analysis.plot}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="second" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="actual" stroke="#22d3ee" dot={false} name="Actual" />
                        <Line type="monotone" dataKey="planned" stroke="#f97316" dot={false} name="Planned" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <h3 className="mb-3 text-lg font-semibold">Planned vs Actual by Interval</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700 text-left">
                          <th className="py-2">Interval</th>
                          <th className="py-2">Target</th>
                          <th className="py-2">Actual Avg</th>
                          <th className="py-2">Compliance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analysis.intervalResults.map((row) => (
                          <tr key={row.interval.index} className="border-b border-slate-800">
                            <td className="py-2">#{row.interval.index} ({row.interval.rawLabel})</td>
                            <td>{row.interval.target.toFixed(1)}</td>
                            <td>{row.actualAverage.toFixed(1)}</td>
                            <td>{row.deltaPercent.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="rounded-xl border border-slate-700 bg-slate-900 p-5">
                  <h3 className="mb-3 text-lg font-semibold">Time in Zones</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analysis.zones}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="zone" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip />
                        <Bar dataKey="seconds" fill="#38bdf8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </>
            )}
          </div>
        </section>
      )}

      {error && <p className="mt-4 rounded border border-rose-500 bg-rose-950/40 p-3 text-rose-200">{error}</p>}
    </main>
  );
}
