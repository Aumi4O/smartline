"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CampaignSchedule {
  callWindow?: {
    fallbackTimezone?: string;
    daysOfWeek?: number[];
    startHour?: number;
    endHour?: number;
  };
  leadSegmentFilter?: string | null;
}

interface CampaignDetail {
  id: string;
  name: string;
  status: string;
  outboundPrompt: string;
  maxCallsPerHour: number;
  voicemailAction: string;
  totalLeads: number;
  completedLeads: number;
  schedule?: CampaignSchedule | null;
  agent?: { name: string };
  callFromNumber?: { phoneNumber: string };
}

interface Stats {
  total: number;
  newLeads: number;
  queued: number;
  calling: number;
  completed: number;
  voicemail: number;
  noAnswer: number;
  failed: number;
  interested: number;
  notInterested: number;
  callback: number;
}

interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  status: string;
  outcome: string | null;
  callAttempts: number;
  customFields?: { segment?: string } | null;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [campRes, leadsRes] = await Promise.all([
        fetch(`/api/campaigns/${id}`),
        fetch(`/api/leads?campaignId=${id}&limit=200`),
      ]);
      if (campRes.ok) {
        const data = await campRes.json();
        setCampaign(data.campaign);
        setStats(data.stats);
      }
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAction(action: string) {
    setActing(true);
    try {
      await fetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      fetchData();
    } finally {
      setActing(false);
    }
  }

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch(`/api/leads?campaignId=${id}`, {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(`Imported ${data.imported} leads${data.skipped ? `, ${data.skipped} skipped` : ""}`);
        fetchData();
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this campaign and all its leads?")) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.push("/campaigns");
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;
  if (!campaign) return <p className="text-sm text-gray-500">Campaign not found.</p>;

  const progress = campaign.totalLeads > 0 ? Math.round((campaign.completedLeads / campaign.totalLeads) * 100) : 0;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/campaigns")}>← Back</Button>
            <h1 className="text-2xl font-semibold text-black">{campaign.name}</h1>
            <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${
              campaign.status === "active" ? "bg-black text-white"
                : campaign.status === "completed" ? "bg-gray-100 text-gray-600"
                : "bg-gray-200 text-black"
            }`}>{campaign.status}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Agent: {campaign.agent?.name || "—"} · From: {campaign.callFromNumber?.phoneNumber || "—"}
          </p>
        </div>
        <div className="flex gap-2">
          {campaign.status === "draft" && (
            <Button onClick={() => handleAction("start")} disabled={acting || leads.length === 0}>
              Start Campaign
            </Button>
          )}
          {campaign.status === "active" && (
            <Button onClick={() => handleAction("pause")} disabled={acting} variant="secondary">
              Pause
            </Button>
          )}
          {campaign.status === "paused" && (
            <Button onClick={() => handleAction("start")} disabled={acting}>
              Resume
            </Button>
          )}
          {(campaign.status === "draft" || campaign.status === "completed") && (
            <Button variant="ghost" onClick={handleDelete}>Delete</Button>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{campaign.completedLeads} of {campaign.totalLeads} leads processed</span>
            <span className="font-medium text-black">{progress}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-full rounded-full bg-black transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      {stats && (
        <div className="mb-6 grid gap-4 sm:grid-cols-4 lg:grid-cols-6">
          <StatBox label="Total" value={stats.total} />
          <StatBox label="New" value={stats.newLeads} />
          <StatBox label="Queued" value={stats.queued} />
          <StatBox label="Completed" value={stats.completed} />
          <StatBox label="Voicemail" value={stats.voicemail} />
          <StatBox label="No Answer" value={stats.noAnswer} />
          <StatBox label="Interested" value={stats.interested} highlight />
          <StatBox label="Not Interested" value={stats.notInterested} />
          <StatBox label="Callback" value={stats.callback} />
          <StatBox label="Failed" value={stats.failed} />
        </div>
      )}

      {/* Schedule & Segment */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Schedule &amp; targeting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ScheduleSummary schedule={campaign.schedule} />
        </CardContent>
      </Card>

      {/* Add Leads */}
      {(campaign.status === "draft" || campaign.status === "paused") && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="text-sm font-medium text-black">Add leads to this campaign</p>
              <p className="text-xs text-gray-400">Upload a CSV with phone numbers to start calling.</p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
              <Button onClick={() => fileRef.current?.click()} disabled={importing} variant="secondary">
                {importing ? "Importing..." : "Upload CSV"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {importResult && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-black">{importResult}</div>
      )}

      {/* Lead List */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({leads.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {leads.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No leads in this campaign yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-6 gap-3 border-b border-gray-200 pb-2 text-xs font-medium text-gray-400">
                <span>Name</span>
                <span>Phone</span>
                <span>Segment</span>
                <span>Status</span>
                <span>Outcome</span>
                <span>Attempts</span>
              </div>
              {leads.map((lead) => (
                <div key={lead.id} className="grid grid-cols-6 gap-3 border-b border-gray-200 py-2 text-sm last:border-0">
                  <span className="font-medium text-black">{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}</span>
                  <span className="text-black">{lead.phone}</span>
                  <span className="text-gray-500">{lead.customFields?.segment || "—"}</span>
                  <span className="capitalize text-gray-500">{lead.status}</span>
                  <span className={`capitalize ${lead.outcome === "interested" ? "font-medium text-black" : "text-gray-400"}`}>
                    {lead.outcome || "—"}
                  </span>
                  <span className="text-gray-400">{lead.callAttempts}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatBox({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-black" : "border-gray-200"}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold ${highlight ? "text-black" : "text-black"}`}>{value}</p>
    </div>
  );
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12:00 AM";
  if (h === 12) return "12:00 PM";
  if (h > 12) return `${h - 12}:00 PM`;
  return `${h}:00 AM`;
}

function ScheduleSummary({
  schedule,
}: {
  schedule?: CampaignSchedule | null;
}) {
  const cw = schedule?.callWindow || {};
  const days = cw.daysOfWeek ?? [1, 2, 3, 4, 5];
  const startHour = cw.startHour ?? 9;
  const endHour = cw.endHour ?? 20;
  const tz = cw.fallbackTimezone ?? "America/New_York";
  const segment = schedule?.leadSegmentFilter;

  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Lead segment</span>
        <span className="font-medium text-black">
          {segment ? segment : "All leads"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Call window</span>
        <span className="font-medium text-black">
          {formatHour(startHour)} – {formatHour(endHour)} local
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Days</span>
        <span className="font-medium text-black">
          {days.length === 7
            ? "Every day"
            : days
                .slice()
                .sort()
                .map((d) => DAY_LABELS[d])
                .join(", ")}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Fallback timezone</span>
        <span className="font-mono text-xs text-black">{tz}</span>
      </div>
    </>
  );
}
