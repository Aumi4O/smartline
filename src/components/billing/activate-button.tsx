"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ActivateButton() {
  const [loading, setLoading] = useState(false);

  async function handleActivate() {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/activate", { method: "POST" });
      const { url, error } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        alert(error || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button onClick={handleActivate} disabled={loading} className="w-full" size="lg">
      {loading
        ? "Redirecting to payment..."
        : "Start — $5 today, 3-day Pro trial, then $199/mo"}
    </Button>
  );
}
