"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  initialConnected: boolean;
  email?: string | null;
  watchExpiresAt?: string | null;
}

export function GoogleCalendarConnect({
  initialConnected,
  email,
  watchExpiresAt,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queryStatus, setQueryStatus] = useState<string | null>(null);
  const [queryReason, setQueryReason] = useState<string | null>(null);

  // Reading the URL on mount avoids a client-side Suspense boundary that
  // useSearchParams would otherwise require in the App Router.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setQueryStatus(sp.get("google"));
    setQueryReason(sp.get("reason"));
  }, []);

  function connect() {
    window.location.href = "/api/integrations/google/start";
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not disconnect");
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  if (initialConnected) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Connected{email ? ` as ${email}` : ""}. Calendar events are syncing.
        </div>
        {watchExpiresAt ? (
          <p className="text-xs text-gray-500">
            Push channel renews automatically before {new Date(watchExpiresAt).toLocaleDateString()}.
          </p>
        ) : null}
        <Button onClick={disconnect} disabled={busy} variant="secondary">
          {busy ? "Disconnecting…" : "Disconnect"}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700">
        Connect your Google Calendar so SmartLine can show booked appointments
        alongside Calendly bookings.
      </p>
      <Button onClick={connect}>Connect Google Calendar</Button>
      {queryStatus === "error" ? (
        <p className="text-sm text-red-600">
          {queryReason === "missing_refresh_token"
            ? "Google didn't return a refresh token. Revoke SmartLine at myaccount.google.com/permissions, then try again."
            : `Could not connect: ${queryReason || "unknown error"}`}
        </p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
