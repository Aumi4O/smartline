"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface Call {
  id: string;
  agentName: string;
  channel: string;
  callerPhone: string | null;
  status: string;
  summary: string | null;
  durationSec: number | null;
  costCents: number | null;
  startedAt: string;
  endedAt: string | null;
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/calls");
      if (res.ok) {
        const data = await res.json();
        setCalls(data.calls || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  function formatDuration(sec: number | null) {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Calls</h1>
        <p className="mt-1 text-gray-500">View call history, transcripts, and costs.</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : calls.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-500">No calls yet.</p>
            <p className="mt-1 text-sm text-gray-400">Calls will appear here once your agent is live and receives its first call.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Call History ({calls.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-6 gap-4 border-b border-gray-200 pb-2 text-xs font-medium text-gray-400">
                <span>Caller</span>
                <span>Agent</span>
                <span>Duration</span>
                <span>Cost</span>
                <span>Status</span>
                <span>Date</span>
              </div>
              {calls.map((call) => (
                <Link key={call.id} href={`/calls/${call.id}`}>
                  <div className="grid grid-cols-6 gap-4 border-b border-gray-200 py-3 text-sm hover:bg-gray-50 last:border-0">
                    <span className="font-medium text-black">{call.callerPhone || "Unknown"}</span>
                    <span className="text-gray-500">{call.agentName}</span>
                    <span className="text-black">{formatDuration(call.durationSec)}</span>
                    <span className="text-black">{call.costCents ? `$${(call.costCents / 100).toFixed(2)}` : "—"}</span>
                    <span className={`capitalize ${call.status === "completed" ? "text-black" : "text-gray-400"}`}>
                      {call.status}
                    </span>
                    <span className="text-gray-400">{new Date(call.startedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
