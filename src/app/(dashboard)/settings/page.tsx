"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Webhook {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: string;
}

type DisclosureMode = "always" | "first_call" | "never";

export default function SettingsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [retentionDays, setRetentionDays] = useState(90);
  const [disclosureMode, setDisclosureMode] = useState<DisclosureMode>("first_call");
  const [disclosureSaving, setDisclosureSaving] = useState(false);
  const [disclosureSaved, setDisclosureSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setOrgName(data.name || "");
        setOrgSlug(data.slug || "");
        setRetentionDays(data.dataRetentionDays || 90);
        if (
          data.recordingDisclosureMode === "always" ||
          data.recordingDisclosureMode === "first_call" ||
          data.recordingDisclosureMode === "never"
        ) {
          setDisclosureMode(data.recordingDisclosureMode);
        }
      }
    } catch {}
  }, []);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks");
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data.endpoints || []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchSettings(); fetchWebhooks(); }, [fetchSettings, fetchWebhooks]);

  async function handleSaveOrg() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, dataRetentionDays: retentionDays }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddWebhook() {
    if (!newUrl.startsWith("https://")) {
      alert("Webhook URL must start with https://");
      return;
    }
    setAddingWebhook(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, events: ["call.completed", "call.started"] }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewSecret(data.secret);
        setNewUrl("");
        fetchWebhooks();
      }
    } finally {
      setAddingWebhook(false);
    }
  }

  async function handleDeleteWebhook(id: string) {
    await fetch(`/api/webhooks?id=${id}`, { method: "DELETE" });
    fetchWebhooks();
  }

  async function handleChangeDisclosureMode(next: DisclosureMode) {
    if (next === disclosureMode) return;
    if (next === "never") {
      const ok = confirm(
        "Turning the recording disclosure OFF means no \"this call may be recorded\" announcement will play.\n\nThis is only legal in one-party consent states. You take full responsibility for compliance (TCPA, CPRA, GDPR, and any state two-party consent laws).\n\nContinue?"
      );
      if (!ok) return;
    }
    setDisclosureMode(next);
    setDisclosureSaving(true);
    setDisclosureSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingDisclosureMode: next }),
      });
      if (res.ok) setDisclosureSaved(true);
    } finally {
      setDisclosureSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Settings</h1>
        <p className="mt-1 text-gray-500">Manage your organization, webhooks, and compliance.</p>
      </div>

      <div className="max-w-[768px] space-y-6">
        {/* Organization */}
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your business details</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSaveOrg(); }}>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Organization Name</label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Acme Dental" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Slug</label>
                <Input value={orgSlug} disabled />
                <p className="mt-1 text-xs text-gray-400">Used in URLs and API endpoints</p>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
                {saved && <span className="text-xs text-gray-500">Saved</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Webhooks */}
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              Receive POST notifications when calls complete. Compatible with Zapier and Make.com.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {webhooks.length > 0 && (
                <div className="space-y-2">
                  {webhooks.map((wh) => (
                    <div key={wh.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
                      <div>
                        <p className="text-sm font-medium text-black">{wh.url}</p>
                        <p className="text-xs text-gray-400">
                          Events: {(wh.events as string[]).join(", ")} · {wh.isActive ? "Active" : "Inactive"}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(wh.id)}>
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {newSecret && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-black">Webhook signing secret (save it now):</p>
                  <code className="mt-1 block break-all text-xs text-gray-600">{newSecret}</code>
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setNewSecret(null)}>
                    Dismiss
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="https://your-server.com/webhook"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddWebhook} disabled={addingWebhook || !newUrl}>
                  {addingWebhook ? "Adding..." : "Add Webhook"}
                </Button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">
                  SmartLine sends a <code className="text-black">X-SmartLine-Signature</code> header (HMAC-SHA256)
                  with each delivery. Verify signatures using the secret above.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recording disclosure */}
        <Card>
          <CardHeader>
            <CardTitle>Call recording disclosure</CardTitle>
            <CardDescription>
              Controls the &ldquo;This call may be recorded&rdquo; announcement that plays
              before the agent picks up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(
                [
                  {
                    id: "first_call" as const,
                    title: "First call only (recommended)",
                    desc: "Announced the first time a caller phones this number. Returning callers skip straight to the agent.",
                  },
                  {
                    id: "always" as const,
                    title: "Every call",
                    desc: "Announce on every inbound and outbound call. Safest for two-party consent states (CA, FL, IL, MA, MD, MT, NH, NV, PA, WA).",
                  },
                  {
                    id: "never" as const,
                    title: "Never (off)",
                    desc: "Caller goes straight to the agent — no announcement. Only safe in one-party consent states. You accept full compliance responsibility.",
                  },
                ]
              ).map((opt) => {
                const selected = disclosureMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChangeDisclosureMode(opt.id)}
                    disabled={disclosureSaving}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selected
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-black hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          selected ? "border-white" : "border-gray-400"
                        }`}
                        aria-hidden
                      >
                        {selected && (
                          <span className="h-2 w-2 rounded-full bg-white" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{opt.title}</p>
                        <p
                          className={`mt-0.5 text-xs ${
                            selected ? "text-white/70" : "text-gray-500"
                          }`}
                        >
                          {opt.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {disclosureMode === "never" && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-medium">Legal warning</p>
                <p className="mt-0.5">
                  Recording without an announcement is illegal in 11+ US states
                  (two-party consent) and in most of the EU. Make sure you have
                  prior written consent from every caller before turning this
                  off.
                </p>
              </div>
            )}

            <p className="mt-3 text-xs text-gray-400">
              {disclosureSaving
                ? "Saving…"
                : disclosureSaved
                ? "Saved — new setting applies to the next call."
                : "Takes effect immediately on the next call."}
            </p>
          </CardContent>
        </Card>

        {/* Data Retention */}
        <Card>
          <CardHeader>
            <CardTitle>Data Retention</CardTitle>
            <CardDescription>How long call transcripts and recordings are kept</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value))}
                className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days (default)</option>
                <option value={365}>365 days</option>
              </select>
              <Button variant="secondary" onClick={handleSaveOrg} disabled={saving}>
                {saving ? "Saving..." : "Update"}
              </Button>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Transcripts older than this period are permanently deleted for GDPR/CCPA compliance.
            </p>
          </CardContent>
        </Card>

        {/* API Access */}
        <Card>
          <CardHeader>
            <CardTitle>API Access</CardTitle>
            <CardDescription>Programmatic access to your SmartLine account</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="py-4 text-center text-sm text-gray-400">API keys coming soon.</p>
          </CardContent>
        </Card>

        {/* Team */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
            <CardDescription>Manage who has access to this organization</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="py-4 text-center text-sm text-gray-400">Team management coming soon.</p>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-black">Delete Organization</p>
                <p className="text-xs text-gray-400">This action is irreversible and will delete all data.</p>
              </div>
              <Button variant="secondary" size="sm" disabled>
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
