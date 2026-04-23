"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface AuditEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  userId: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch("/api/audit-logs?limit=100");
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Audit Log</h1>
        <p className="mt-1 text-gray-500">Track all actions for compliance and security.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Last 100 events</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No audit events recorded yet.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-4 border-b border-gray-200 pb-2 text-xs font-medium text-gray-400">
                <span>Action</span>
                <span>Resource</span>
                <span>Resource ID</span>
                <span>IP</span>
                <span>Date</span>
              </div>
              {logs.map((log) => (
                <div key={log.id} className="grid grid-cols-5 gap-4 border-b border-gray-200 py-2.5 text-sm last:border-0">
                  <span className="font-medium text-black">{log.action}</span>
                  <span className="text-gray-500">{log.resourceType}</span>
                  <span className="truncate text-gray-400 font-mono text-xs">{log.resourceId || "—"}</span>
                  <span className="text-gray-400 font-mono text-xs">{log.ipAddress || "—"}</span>
                  <span className="text-gray-400">{new Date(log.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
