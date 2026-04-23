"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const voices = [
  { id: "alloy", name: "Alloy", style: "Neutral" },
  { id: "ash", name: "Ash", style: "Warm" },
  { id: "ballad", name: "Ballad", style: "Smooth" },
  { id: "coral", name: "Coral", style: "Clear" },
  { id: "echo", name: "Echo", style: "Deep" },
  { id: "fable", name: "Fable", style: "Storytelling" },
  { id: "nova", name: "Nova", style: "Energetic" },
  { id: "onyx", name: "Onyx", style: "Rich" },
  { id: "shimmer", name: "Shimmer", style: "Bright" },
  { id: "sage", name: "Sage", style: "Calm" },
];

const languages = [
  { id: "en", name: "English" }, { id: "es", name: "Spanish" },
  { id: "fr", name: "French" }, { id: "de", name: "German" },
  { id: "pt", name: "Portuguese" }, { id: "it", name: "Italian" },
  { id: "he", name: "Hebrew" }, { id: "ar", name: "Arabic" },
  { id: "ja", name: "Japanese" }, { id: "zh", name: "Chinese" },
  { id: "ru", name: "Russian" },
];

interface AgentVersion {
  id: string;
  version: number;
  systemPrompt: string | null;
  greeting: string | null;
  voice: string | null;
  changeNote: string | null;
  createdAt: string;
}

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [versions, setVersions] = useState<AgentVersion[]>([]);

  const [form, setForm] = useState({
    name: "", systemPrompt: "", greeting: "", voice: "shimmer",
    language: "en", transferPhone: "",
  });

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/${id}`);
      if (res.ok) {
        const data = await res.json();
        setForm({
          name: data.agent.name || "",
          systemPrompt: data.agent.systemPrompt || "",
          greeting: data.agent.greeting || "",
          voice: data.agent.voice || "shimmer",
          language: data.agent.language || "en",
          transferPhone: data.agent.transferPhone || "",
        });
        setVersions(data.versions || []);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAgent(); }, [fetchAgent]);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setSaved(true);
        fetchAgent();
      } else {
        setError(data.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleRollback(version: number) {
    if (!confirm(`Rollback to v${version}?`)) return;
    const res = await fetch(`/api/agents/${id}/rollback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    });
    if (res.ok) fetchAgent();
  }

  if (loading) return <p className="text-sm text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Edit Agent</h1>
        <p className="mt-1 text-gray-500">Update configuration. Changes create new versions automatically.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <form onSubmit={handleSave} className="space-y-6">
          {error && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black">{error}</p>
          )}
          {saved && (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black">Saved successfully.</p>
          )}

          <Card>
            <CardHeader><CardTitle>Basics</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Agent Name</label>
                <Input value={form.name} onChange={(e) => update("name", e.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">System Prompt</label>
                <textarea
                  className="flex min-h-[160px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                  value={form.systemPrompt}
                  onChange={(e) => update("systemPrompt", e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Greeting</label>
                <Input value={form.greeting} onChange={(e) => update("greeting", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Voice & Language</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {voices.map((v) => (
                  <button
                    key={v.id} type="button" onClick={() => update("voice", v.id)}
                    className={`rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
                      form.voice === v.id ? "border-black bg-black text-white" : "border-gray-200 bg-white text-black hover:border-gray-400"
                    }`}
                  >
                    <span className="block font-medium">{v.name}</span>
                    <span className="block text-xs opacity-60">{v.style}</span>
                  </button>
                ))}
              </div>
              <select value={form.language} onChange={(e) => update("language", e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black">
                {languages.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Call Transfer</CardTitle>
              <CardDescription>Optional: transfer to a human when needed</CardDescription>
            </CardHeader>
            <CardContent>
              <Input value={form.transferPhone} onChange={(e) => update("transferPhone", e.target.value)} placeholder="+1 (555) 123-4567" />
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
            <Button type="button" variant="secondary" onClick={() => router.push("/agents")}>Back</Button>
          </div>
        </form>

        {/* Version History */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Version History</CardTitle>
          </CardHeader>
          <CardContent>
            {versions.length === 0 ? (
              <p className="text-sm text-gray-400">No versions yet.</p>
            ) : (
              <div className="space-y-3">
                {versions.map((v, i) => (
                  <div key={v.id} className="border-b border-gray-200 pb-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-black">v{v.version}</span>
                      {i > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => handleRollback(v.version)}>
                          Rollback
                        </Button>
                      )}
                      {i === 0 && <span className="text-xs text-gray-400">Current</span>}
                    </div>
                    <p className="text-xs text-gray-400">
                      {v.changeNote} · {new Date(v.createdAt).toLocaleDateString()}
                    </p>
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
