"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  email: string | null;
  company: string | null;
  status: string;
  outcome: string | null;
  callAttempts: number;
  consentGranted: boolean;
  createdAt: string;
}

interface Stats {
  total: number;
  newCount: number;
  calledCount: number;
  interestedCount: number;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, newCount: 0, calledCount: 0, interestedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data.leads || []);
        setStats(data.stats || { total: 0, newCount: 0, calledCount: 0, interestedCount: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "text/csv" },
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        setImportResult(`Imported ${data.imported} leads${data.skipped ? `, ${data.skipped} skipped (duplicates)` : ""}${data.errors?.length ? `. ${data.errors.length} errors.` : ""}`);
        fetchLeads();
      } else {
        setImportResult(`Error: ${data.error}`);
      }
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/leads?id=${id}`, { method: "DELETE" });
    fetchLeads();
  }

  const filtered = filter
    ? leads.filter((l) =>
        [l.firstName, l.lastName, l.phone, l.company, l.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
    : leads;

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Leads</h1>
          <p className="mt-1 text-gray-500">Upload and manage your contact lists for outbound campaigns.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={importing}>
            {importing ? "Importing..." : "Upload CSV"}
          </Button>
        </div>
      </div>

      {importResult && (
        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-black">
          {importResult}
        </div>
      )}

      {/* Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <StatCard label="Total Leads" value={stats.total} />
        <StatCard label="New" value={stats.newCount} />
        <StatCard label="Called" value={stats.calledCount} />
        <StatCard label="Interested" value={stats.interestedCount} />
      </div>

      {/* CSV Format Hint */}
      <Card className="mb-6">
        <CardContent className="py-3">
          <p className="text-xs text-gray-400">
            CSV format: <code className="text-black">first_name, last_name, phone, email, company, notes</code> — only phone is required. Auto-detects timezone from area code.
          </p>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Leads ({filtered.length})</CardTitle>
            <Input
              placeholder="Search leads..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-64"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No leads yet. Upload a CSV to get started.
            </p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-7 gap-3 border-b border-gray-200 pb-2 text-xs font-medium text-gray-400">
                <span>Name</span>
                <span>Phone</span>
                <span>Company</span>
                <span>Status</span>
                <span>Outcome</span>
                <span>Attempts</span>
                <span></span>
              </div>
              {filtered.map((lead) => (
                <div key={lead.id} className="grid grid-cols-7 gap-3 border-b border-gray-200 py-2.5 text-sm last:border-0">
                  <span className="font-medium text-black">{[lead.firstName, lead.lastName].filter(Boolean).join(" ") || "—"}</span>
                  <span className="text-black">{lead.phone}</span>
                  <span className="text-gray-500">{lead.company || "—"}</span>
                  <span className="capitalize text-gray-500">{lead.status}</span>
                  <span className={`capitalize ${lead.outcome === "interested" ? "font-medium text-black" : "text-gray-400"}`}>
                    {lead.outcome || "—"}
                  </span>
                  <span className="text-gray-400">{lead.callAttempts}</span>
                  <span>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(lead.id)}>
                      Delete
                    </Button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-black">{value}</p>
    </div>
  );
}
