"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Agent {
  id: string;
  name: string;
  voice: string;
  language: string;
  isActive: boolean;
  version: number;
  createdAt: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  async function handleDelete(id: string) {
    if (!confirm("Delete this agent?")) return;
    const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
    if (res.ok) fetchAgents();
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Agents</h1>
          <p className="mt-1 text-gray-500">Create and manage your AI voice agents.</p>
        </div>
        <Link href="/agents/new">
          <Button>Create Agent</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : agents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-500">No agents yet.</p>
            <p className="mt-1 text-sm text-gray-400">Create your first agent to start receiving calls.</p>
            <Link href="/agents/new">
              <Button className="mt-4">Create Your First Agent</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div>
                  <p className="text-sm font-semibold text-black">{agent.name}</p>
                  <p className="text-xs text-gray-400">
                    Voice: {agent.voice} · Language: {agent.language} · v{agent.version}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/agents/${agent.id}`}>
                    <Button variant="secondary" size="sm">Edit</Button>
                  </Link>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)}>
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
