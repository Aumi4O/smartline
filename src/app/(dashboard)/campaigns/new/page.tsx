"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Agent { id: string; name: string }
interface PhoneNumber { id: string; phoneNumber: string }

export default function NewCampaignPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [numberId, setNumberId] = useState("");
  const [outboundPrompt, setOutboundPrompt] = useState("You are making an outbound call. Be professional and friendly. Introduce yourself, explain why you're calling, and ask if they have a moment to chat.");
  const [maxCallsPerHour, setMaxCallsPerHour] = useState(30);
  const [voicemailAction, setVoicemailAction] = useState("leave_message");
  const [voicemailMessage, setVoicemailMessage] = useState("Hi, this is a call from our team. We'll try you again later, or you can call us back at your convenience. Thank you!");

  const fetchOptions = useCallback(async () => {
    const [agentRes, numRes] = await Promise.all([
      fetch("/api/agents"),
      fetch("/api/phone-numbers"),
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
  }, [agentId, numberId]);

  useEffect(() => { fetchOptions(); }, [fetchOptions]);

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
        <p className="mt-1 text-gray-500">Set up an outbound calling campaign for your leads.</p>
      </div>

      <div className="max-w-[640px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Campaign Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2 Follow-up Calls" />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Agent</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                <option value="">Select agent...</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Caller ID (phone number)</label>
              <select
                value={numberId}
                onChange={(e) => setNumberId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
              >
                <option value="">Select number...</option>
                {numbers.map((n) => <option key={n.id} value={n.id}>{n.phoneNumber}</option>)}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Outbound Prompt</label>
              <textarea
                value={outboundPrompt}
                onChange={(e) => setOutboundPrompt(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-black placeholder:text-gray-400"
                placeholder="Additional instructions for outbound calls..."
              />
              <p className="mt-1 text-xs text-gray-400">This is appended to the agent's system prompt when making outbound calls.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Max Calls/Hour</label>
                <Input type="number" value={maxCallsPerHour} onChange={(e) => setMaxCallsPerHour(parseInt(e.target.value) || 30)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Voicemail Action</label>
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
                <label className="mb-1.5 block text-sm font-medium text-black">Voicemail Message</label>
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
          <Button onClick={handleCreate} disabled={saving || !name || !agentId}>
            {saving ? "Creating..." : "Create Campaign"}
          </Button>
          <Button variant="secondary" onClick={() => router.push("/campaigns")}>Cancel</Button>
        </div>

        <p className="text-xs text-gray-400">
          After creating, add leads via CSV upload on the campaign detail page, then start the campaign.
        </p>
      </div>
    </div>
  );
}
