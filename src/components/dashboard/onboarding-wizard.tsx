"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  check: () => Promise<boolean>;
}

interface Props {
  activated: boolean;
  hasAgent: boolean;
  hasPhone: boolean;
  hasProfile: boolean;
}

export function OnboardingWizard({ activated, hasAgent, hasPhone, hasProfile }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const steps = [
    {
      id: "activate",
      title: "Activate Account",
      description: "Pay a $5 deposit to unlock all features (converts to credits).",
      href: "/billing",
      cta: "Activate",
      done: activated,
    },
    {
      id: "profile",
      title: "Add Business Info",
      description: "Tell us about your business so the agent knows how to respond.",
      href: "/knowledge",
      cta: "Add Info",
      done: hasProfile,
    },
    {
      id: "agent",
      title: "Create Your Agent",
      description: "Configure a voice agent with a name, personality, and knowledge.",
      href: "/agents/new",
      cta: "Create Agent",
      done: hasAgent,
    },
    {
      id: "phone",
      title: "Get a Phone Number",
      description: "Buy a local number so callers can reach your agent.",
      href: "/phone-numbers",
      cta: "Get Number",
      done: hasPhone,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  const allDone = completedCount === steps.length;

  if (allDone) return null;

  return (
    <Card className="mb-6 border-black">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Get Started</CardTitle>
          <p className="mt-1 text-sm text-gray-500">
            {completedCount} of {steps.length} steps completed
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>
          Dismiss
        </Button>
      </CardHeader>
      <CardContent>
        {/* Progress bar */}
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-black transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>

        <div className="space-y-3">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                step.done ? "border-gray-200 bg-gray-50" : "border-gray-200"
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    step.done
                      ? "bg-black text-white"
                      : "border border-gray-300 text-gray-400"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </div>
                <div>
                  <p className={`text-sm font-medium ${step.done ? "text-gray-400 line-through" : "text-black"}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-400">{step.description}</p>
                </div>
              </div>
              {!step.done && (
                <Link href={step.href}>
                  <Button size="sm">{step.cta}</Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
