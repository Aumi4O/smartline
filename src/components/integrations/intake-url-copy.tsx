"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function IntakeUrlCopy({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — fall back silently. User can select the text.
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-black focus:border-black focus:outline-none"
      />
      <Button type="button" onClick={copy} variant="secondary">
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
