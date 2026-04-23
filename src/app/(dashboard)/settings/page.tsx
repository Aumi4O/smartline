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

export default function SettingsPage() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [newUrl, setNewUrl] = useState("");
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [retentionDays, setRetentionDays] = useState(90);
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
