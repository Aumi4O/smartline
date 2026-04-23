"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface Analytics {
  summary: {
    totalCalls: number;
    completedCalls: number;
    totalDurationMin: number;
    totalCostCents: number;
    activeAgents: number;
    activeNumbers: number;
  };
  dailyCalls: { date: string; calls: number; cost: number; duration: number }[];
  agentBreakdown: { agentName: string; calls: number; cost: number; duration: number }[];
  channelBreakdown: { channel: string; calls: number; cost: number }[];
  usageByType: { type: string; total: number }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/analytics");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <p className="text-sm text-gray-400">Loading analytics...</p>;
  if (!data) return <p className="text-sm text-gray-500">Unable to load analytics.</p>;

  const { summary, dailyCalls, agentBreakdown, channelBreakdown, usageByType } = data;

  const maxDailyCalls = Math.max(...dailyCalls.map((d) => d.calls), 1);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Analytics</h1>
        <p className="mt-1 text-gray-500">Last 30 days performance overview.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Calls" value={String(summary.totalCalls)} sub={`${summary.completedCalls} completed`} />
        <StatCard title="Talk Time" value={`${summary.totalDurationMin} min`} sub="Total duration" />
        <StatCard title="Total Cost" value={`$${(summary.totalCostCents / 100).toFixed(2)}`} sub="Credits used" />
        <StatCard title="Active Agents" value={String(summary.activeAgents)} sub={`${summary.activeNumbers} phone numbers`} />
      </div>

      {/* Daily Call Volume Chart */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Daily Call Volume</CardTitle>
          <CardDescription>Calls per day over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyCalls.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No call data yet.</p>
          ) : (
            <div className="flex items-end gap-1" style={{ height: 160 }}>
              {dailyCalls.map((day) => (
                <div key={day.date} className="group relative flex flex-1 flex-col items-center">
                  <div
                    className="w-full min-w-[4px] rounded-t bg-black transition-colors group-hover:bg-gray-600"
                    style={{ height: `${Math.max((day.calls / maxDailyCalls) * 140, 2)}px` }}
                  />
                  <div className="absolute -top-8 hidden rounded bg-black px-2 py-1 text-xs text-white group-hover:block">
                    {day.calls} calls
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Agent Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>By Agent</CardTitle>
          </CardHeader>
          <CardContent>
            {agentBreakdown.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {agentBreakdown.map((a) => (
                  <div key={a.agentName} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-black">{a.agentName || "Unknown"}</p>
                      <p className="text-xs text-gray-400">{a.calls} calls · {Math.round(a.duration / 60)} min</p>
                    </div>
                    <span className="text-sm font-medium text-black">${(a.cost / 100).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channel Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>By Channel</CardTitle>
          </CardHeader>
          <CardContent>
            {channelBreakdown.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {channelBreakdown.map((c) => (
                  <div key={c.channel} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                    <span className="text-sm capitalize text-black">{c.channel || "unknown"}</span>
                    <div className="text-right">
                      <p className="text-sm font-medium text-black">{c.calls} calls</p>
                      <p className="text-xs text-gray-400">${(c.cost / 100).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage by Type */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Credit Usage by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {usageByType.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No usage yet.</p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {usageByType.map((u) => (
                  <div key={u.type} className="rounded-lg border border-gray-200 p-4">
                    <p className="text-xs text-gray-400 capitalize">{u.type.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-xl font-semibold text-black">${(u.total / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-gray-400">{sub}</p>
      </CardContent>
    </Card>
  );
}
