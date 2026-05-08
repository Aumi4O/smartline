"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  initialConnected: boolean;
  schedulingUrl?: string | null;
}

export function CalendlyConnect({ initialConnected, schedulingUrl }: Props) {
  const router = useRouter();
  const [pat, setPat] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function connect() {
    if (!pat.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/calendly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalAccessToken: pat.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not connect Calendly");
      } else {
        setPat("");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect Calendly? Existing bookings will stay, but new ones won't sync.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/calendly", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not disconnect Calendly");
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
          Connected. Bookings are flowing into your Appointments page.
        </div>
        {schedulingUrl ? (
          <p className="text-sm text-gray-700">
            Scheduling URL:{" "}
            <a
              href={schedulingUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {schedulingUrl}
            </a>
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
      <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
        <li>
          In Calendly, go to{" "}
          <strong>Account &rarr; Integrations &amp; apps &rarr; API &amp; webhooks</strong>.
        </li>
        <li>
          Create a <strong>Personal Access Token</strong> and paste it below.
        </li>
      </ol>
      <Input
        type="password"
        autoComplete="off"
        placeholder="Calendly Personal Access Token"
        value={pat}
        onChange={(e) => setPat(e.target.value)}
      />
      <Button onClick={connect} disabled={busy || !pat.trim()}>
        {busy ? "Connecting…" : "Connect Calendly"}
      </Button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
