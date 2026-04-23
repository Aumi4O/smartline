"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Campaign {
  id: string;
  name: string;
  status: string;
  agentName: string;
  phoneNumber: string;
  totalLeads: number;
  completedLeads: number;
  createdAt: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch("/api/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.campaigns || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-black">Campaigns</h1>
          <p className="mt-1 text-gray-500">Create outbound calling campaigns to reach your leads.</p>
        </div>
        <Link href="/campaigns/new">
          <Button>New Campaign</Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : campaigns.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-500">No campaigns yet.</p>
            <p className="mt-1 text-sm text-gray-400">
              Create a campaign to have your AI agent call leads automatically.
            </p>
            <Link href="/campaigns/new" className="mt-4 inline-block">
              <Button>Create Your First Campaign</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => {
            const progress = c.totalLeads > 0 ? Math.round((c.completedLeads / c.totalLeads) * 100) : 0;
            return (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className="hover:border-black transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-black">{c.name}</p>
                        <p className="text-xs text-gray-400">
                          Agent: {c.agentName} · From: {c.phoneNumber}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${
                          c.status === "active" ? "bg-black text-white"
                            : c.status === "completed" ? "bg-gray-100 text-gray-600"
                            : c.status === "paused" ? "bg-gray-200 text-black"
                            : "bg-gray-50 text-gray-400"
                        }`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{c.completedLeads} of {c.totalLeads} leads</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                        <div className="h-full rounded-full bg-black transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
