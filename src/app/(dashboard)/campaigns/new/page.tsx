"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Agent {
  id: string;
  name: string;
}
interface PhoneNumber {
  id: string;
  phoneNumber: string;
}
interface Segment {
  name: string;
  count: number;
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [numberId, setNumberId] = useState("");
  const [outboundPrompt, setOutboundPrompt] = useState(
    "You are making an outbound call. Be professional and friendly. Introduce yourself, explain why you're calling, and ask if they have a moment to chat."
  );
  const [maxCallsPerHour, setMaxCallsPerHour] = useState(30);
  const [voicemailAction, setVoicemailAction] = useState("leave_message");
  const [voicemailMessage, setVoicemailMessage] = useState(
    "Hi, this is a call from our team. We'll try you again later, or you can call us back at your convenience. Thank you!"
  );

  const [leadSegmentFilter, setLeadSegmentFilter] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [startHour, setStartHour] = useState(9);
  const [endHour, setEndHour] = useState(20);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  const fetchOptions = useCallback(async () => {
    const [agentRes, numRes, leadsRes] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/phone-numbers"),
      fetch("/api/leads?limit=1"),
    ]);
    if (agentRes.ok) {
      const data = await agentRes.json();
      const list = data.agents || [];
      setAgents(list);
      if (list.length > 0 && !agentId) setAgentId(list[0].id);
    }
    if (numRes.ok) {
      const data = await numRes.json();
      const list = data.numbers || [];
      setNumbers(list);
      if (list.length > 0 && !numberId) setNumberId(list[0].id);
    }
    if (leadsRes.ok) {
      const data = await leadsRes.json();
      setSegments(data.segments || []);
    }
  }, [agentId, numberId]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  function toggleDay(d: number) {
    setDaysOfWeek((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()
    );
  }

  async function handleCreate() {
    if (!name || !agentId) return;
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          agentId,
          callFromNumberId: numberId || undefined,
          outboundPrompt,
          maxCallsPerHour,
          voicemailAction,
          voicemailMessage,
          schedule: {
            callWindow: {
              fallbackTimezone: timezone,
              daysOfWeek,
              startHour,
              endHour,
            },
            leadSegmentFilter: leadSegmentFilter || null,
          },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/campaigns/${data.campaign.id}`);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">New Campaign</h1>
        <p className="mt-1 text-gray-500">
          Set up an outbound calling campaign for your leads.
        </p>
      </div>

      <div className="max-w-[640px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Campaign Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Q2 Follow-up Calls"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Agent
              </label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                <option value="">Select agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Caller ID (phone number)
              </label>
              <select
                value={numberId}
                onChange={(e) => setNumberId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                <option value="">Select number...</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.phoneNumber}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Outbound Prompt
              </label>
              <textarea
                value={outboundPrompt}
                onChange={(e) => setOutboundPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-black placeholder:text-gray-400"
                placeholder="Additional instructions for outbound calls..."
              />
              <p className="mt-1 text-xs text-gray-400">
                This is appended to the agent&apos;s system prompt when making
                outbound calls.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Who to call</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Lead segment (optional)
              </label>
              <select
                value={leadSegmentFilter}
                onChange={(e) => setLeadSegmentFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                <option value="">All leads in this campaign</option>
                {segments.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.count})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Add a <span className="font-mono">segment</span>,{" "}
                <span className="font-mono">tag</span>, or{" "}
                <span className="font-mono">list</span> column to your CSV to
                split a list into sub-groups (e.g. <em>vip</em>,{" "}
                <em>cold</em>, <em>follow-up</em>).
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call window (quiet hours)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">
                Default timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                Used when a lead has no timezone saved. Each lead is also
                checked against its own local time.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">
                  Earliest call (local)
                </label>
                <select
                  value={startHour}
                  onChange={(e) => setStartHour(parseInt(e.target.value))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {formatHour(h)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">
                  Latest call (local)
                </label>
                <select
                  value={endHour}
                  onChange={(e) => setEndHour(parseInt(e.target.value))}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h + 1} value={h + 1}>
                      {formatHour(h + 1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-black">
                Days of week
              </label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const active = daysOfWeek.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => toggleDay(d.value)}
                      className={`h-9 w-14 rounded-lg border text-sm font-medium transition ${
                        active
                          ? "border-black bg-black text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-400"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                TCPA recommends 8am–9pm local time Mon–Sat. Defaults here are a
                safe 9am–8pm Mon–Fri.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pacing &amp; voicemail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">
                  Max Calls/Hour
                </label>
                <Input
                  type="number"
                  value={maxCallsPerHour}
                  onChange={(e) =>
                    setMaxCallsPerHour(parseInt(e.target.value) || 30)
                  }
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">
                  Voicemail Action
                </label>
                <select
                  value={voicemailAction}
                  onChange={(e) => setVoicemailAction(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
                >
                  <option value="leave_message">Leave Message</option>
                  <option value="hang_up">Hang Up</option>
                </select>
              </div>
            </div>

            {voicemailAction === "leave_message" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">
                  Voicemail Message
                </label>
                <textarea
                  value={voicemailMessage}
                  onChange={(e) => setVoicemailMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-black placeholder:text-gray-400"
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            onClick={handleCreate}
            disabled={saving || !name || !agentId || daysOfWeek.length === 0 || endHour <= startHour}
          >
            {saving ? "Creating..." : "Create Campaign"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/campaigns")}>
            Cancel
          </Button>
        </div>

        <p className="text-xs text-gray-400">
          After creating, add leads via CSV upload on the campaign detail page,
          then start the campaign.
        </p>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  if (h > 12) return `${h - 12}:00 PM`;
  return `${h}:00 AM`;
}
