"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Message {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface CallData {
  call: {
    id: string;
    agentName: string;
    channel: string;
    callerPhone: string | null;
    status: string;
    summary: string | null;
    sentiment: string | null;
    leadScore: number | null;
    durationSec: number | null;
    costCents: number | null;
    startedAt: string;
    endedAt: string | null;
  };
  messages: Message[];
}

export default function CallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CallData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCall = useCallback(async () => {
    try {
      const res = await fetch(`/api/calls/${id}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchCall(); }, [fetchCall]);

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;
  if (!data) return <p className="text-sm text-gray-500">Call not found.</p>;

  const { call, messages: msgs } = data;

  function formatDuration(sec: number | null) {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/calls")}>
          ← Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-black">Call Detail</h1>
          <p className="mt-1 text-gray-500">{call.callerPhone || "Unknown caller"} · {call.agentName}</p>
        </div>
      </div>

      <div className="max-w-[768px] space-y-6">
        {/* Call Info */}
        <Card>
          <CardHeader>
            <CardTitle>Call Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-400">Duration</p>
                <p className="text-sm font-medium text-black">{formatDuration(call.durationSec)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Cost</p>
                <p className="text-sm font-medium text-black">{call.costCents ? `$${(call.costCents / 100).toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-sm font-medium capitalize text-black">{call.status}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Channel</p>
                <p className="text-sm font-medium capitalize text-black">{call.channel}</p>
              </div>
            </div>

            {call.summary && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-xs text-gray-400">Summary</p>
                <p className="mt-1 text-sm text-black">{call.summary}</p>
              </div>
            )}

            <div className="mt-4 border-t border-gray-200 pt-4 text-xs text-gray-400">
              Started: {new Date(call.startedAt).toLocaleString()}
              {call.endedAt && ` · Ended: ${new Date(call.endedAt).toLocaleString()}`}
            </div>
          </CardContent>
        </Card>

        {/* Transcript */}
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription>{msgs.length} messages</CardDescription>
          </CardHeader>
          <CardContent>
            {msgs.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">No transcript available.</p>
            ) : (
              <div className="space-y-3">
                {msgs.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                      msg.role === "assistant"
                        ? "bg-gray-50 text-black"
                        : "bg-black text-white"
                    }`}>
                      <p className="text-xs font-medium opacity-60 mb-1">
                        {msg.role === "assistant" ? "Agent" : "Caller"}
                      </p>
                      <p className="text-sm">{msg.content}</p>
                    </div>
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
