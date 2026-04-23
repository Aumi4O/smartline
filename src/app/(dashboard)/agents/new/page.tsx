"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  { id: "en", name: "English" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "de", name: "German" },
  { id: "pt", name: "Portuguese" },
  { id: "it", name: "Italian" },
  { id: "he", name: "Hebrew" },
  { id: "ar", name: "Arabic" },
  { id: "ja", name: "Japanese" },
  { id: "zh", name: "Chinese" },
  { id: "ru", name: "Russian" },
];

export default function NewAgentPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    systemPrompt: "",
    greeting: "Hello! How can I help you today?",
    voice: "shimmer",
    language: "en",
    transferPhone: "",
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Agent name is required");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        router.push(`/agents/${data.agent.id}`);
      } else {
        setError(data.error || "Failed to create agent");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Create Agent</h1>
        <p className="mt-1 text-gray-500">Configure your AI voice agent.</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-[640px] space-y-6">
        {error && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black">
            {error}
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Agent Name</label>
              <Input
                placeholder="e.g. Front Desk, Sales, Support"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">System Prompt</label>
              <textarea
                className="flex min-h-[160px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
                placeholder="You are a helpful receptionist for Acme Dental. You can book appointments, answer questions about services and pricing, and transfer to a human if needed..."
                value={form.systemPrompt}
                onChange={(e) => update("systemPrompt", e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                Tell the agent who it is, what it knows, and how to behave.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Greeting</label>
              <Input
                placeholder="Hello! How can I help you today?"
                value={form.greeting}
                onChange={(e) => update("greeting", e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">What the agent says when a call starts.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Voice & Language</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Voice</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {voices.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => update("voice", v.id)}
                    className={`rounded-lg border px-3 py-2 text-center text-sm transition-colors ${
                      form.voice === v.id
                        ? "border-black bg-black text-white"
                        : "border-gray-200 bg-white text-black hover:border-gray-400"
                    }`}
                  >
                    <span className="block font-medium">{v.name}</span>
                    <span className="block text-xs opacity-60">{v.style}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Language</label>
              <select
                value={form.language}
                onChange={(e) => update("language", e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                {languages.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Transfer</CardTitle>
            <CardDescription>Optional: transfer to a human when needed</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="+1 (555) 123-4567"
              value={form.transferPhone}
              onChange={(e) => update("transferPhone", e.target.value)}
            />
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Agent"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push("/agents")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
