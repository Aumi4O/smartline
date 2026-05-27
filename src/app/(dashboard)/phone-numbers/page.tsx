"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  agentId: string | null;
  status: string;
  monthlyCostCents: number;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
}

export default function PhoneNumbersPage() {
  const [myNumbers, setMyNumbers] = useState<PhoneNumber[]>([]);
  const [agentList, setAgentList] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [areaCode, setAreaCode] = useState("");
  const [provisioning, setProvisioning] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [agentsError, setAgentsError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creditCheckoutUrl, setCreditCheckoutUrl] = useState("");

  const fetchMyNumbers = useCallback(async () => {
    const res = await fetch("/api/phone-numbers");
    if (res.ok) {
      const data = await res.json();
      setMyNumbers(data.numbers);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    setLoadingAgents(true);
    setAgentsError("");
    try {
      const res = await fetch("/api/agents");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAgentsError(data.error || "Could not load your agents. Refresh and try again.");
        return;
      }
      const list = (data.agents || [])
        .filter((a: Partial<Agent>): a is Agent => Boolean(a.id && a.name))
        .map((a: Agent) => ({ id: a.id, name: a.name }));
      setAgentList(list);
      if ((!agentId || !list.some((a: Agent) => a.id === agentId)) && list.length) {
        setAgentId(list[0].id);
      }
    } catch {
      setAgentsError("Could not load your agents. Refresh and try again.");
    } finally {
      setLoadingAgents(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchMyNumbers();
    fetchAgents();
  }, [fetchMyNumbers, fetchAgents]);

  async function handleProvision() {
    setProvisioning(true);
    setError("");
    setNotice("");
    setCreditCheckoutUrl("");
    try {
      const res = await fetch("/api/phone-numbers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          areaCode: areaCode.trim() || undefined,
          agentId: agentId || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const picked = data.phoneNumber?.phoneNumber;
        if (data.fallbackUsed && data.requestedAreaCode) {
          setNotice(
            `Area code ${data.requestedAreaCode} had nothing available right now — you got ${picked} instead. You can release it and try another area code if you want.`
          );
        } else {
          setNotice(`${picked} is yours. Call it to test your agent.`);
        }
        setAreaCode("");
        fetchMyNumbers();
      } else {
        if (data.checkoutUrl) {
          setCreditCheckoutUrl(data.checkoutUrl);
          setError(
            data.message ||
              data.error ||
              "Load the $15 starter credit pack before SmartLine starts provider-cost actions."
          );
          return;
        }
        setError(data.error || "Could not provision a number");
      }
    } finally {
      setProvisioning(false);
    }
  }

  async function handleRelease(id: string) {
    if (!confirm("Release this number? It will stop receiving calls immediately.")) return;
    const res = await fetch("/api/phone-numbers/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumberId: id }),
    });
    if (res.ok) fetchMyNumbers();
  }

  const activeNumbers = myNumbers.filter((n) => n.status === "active");
  const agentNameById = Object.fromEntries(agentList.map((a) => [a.id, a.name]));

  const noAgents = !loadingAgents && !agentsError && agentList.length === 0;

  return (
    <div>
      {creditCheckoutUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="credit-required-title"
        >
          <div className="w-full max-w-[420px] rounded-lg bg-white p-6 text-left shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="credit-required-title" className="text-xl font-semibold text-black">
                  Load $15 credits first
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Registering a phone number starts real provider cost. The $15 becomes usage
                  credits in your account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreditCheckoutUrl("")}
                className="rounded-md px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-black"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <a href={creditCheckoutUrl} className={buttonClasses({ className: "w-full" })}>
                Load $15 credits
              </a>
              <Button variant="ghost" onClick={() => setCreditCheckoutUrl("")}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Phone Numbers</h1>
        <p className="mt-1 text-gray-500">
          Each agent needs a phone number. Pick the agent, hit the button, and SmartLine
          provisions the number from Twilio and wires it up for you.
        </p>
      </div>

      <div className="max-w-[768px] space-y-6">
        {/* Get a new number */}
        <Card>
          <CardHeader>
            <CardTitle>Get a phone number</CardTitle>
            <CardDescription>
              US local number, about $1.89/month · load $15 credits the first time provider cost starts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingAgents ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                Loading your agents...
              </div>
            ) : agentsError ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-medium text-black">Could not load your agents.</p>
                <p className="mt-1">{agentsError}</p>
                <Button size="sm" className="mt-3" onClick={fetchAgents}>
                  Retry
                </Button>
              </div>
            ) : noAgents ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                <p className="font-medium text-black">Create an agent first.</p>
                <p className="mt-1">
                  A phone number only makes sense when it&apos;s attached to an agent that can
                  answer the call.
                </p>
                <Link
                  href="/agents/new"
                  className={buttonClasses({
                    size: "sm",
                    className: "mt-3",
                  })}
                >
                  Create an agent
                </Link>
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black">
                    Assign to agent
                  </label>
                  <select
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-black"
                  >
                    {agentList.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    Calls to this number will be answered by the selected agent.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-black">
                    Area code <span className="text-gray-400">(optional)</span>
                  </label>
                  <Input
                    placeholder="e.g. 415, 212, 305 — leave blank for any"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    className="max-w-[260px]"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    If your preferred area code isn&apos;t available, we&apos;ll give you any US
                    number so you can start right away.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button onClick={handleProvision} disabled={provisioning || !agentId}>
                    {provisioning ? "Provisioning…" : "Get a phone number"}
                  </Button>
                  <p className="text-xs text-gray-500">
                    Takes about 3 seconds. Number goes live immediately.
                  </p>
                </div>

                {error && (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black">
                    {error}
                  </p>
                )}

                {notice && (
                  <p className="rounded-lg border border-black bg-black px-4 py-2 text-sm text-white">
                    {notice}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* My Numbers */}
        <Card>
          <CardHeader>
            <CardTitle>Your numbers ({activeNumbers.length})</CardTitle>
            <CardDescription>
              Live phone numbers on your SmartLine account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeNumbers.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                No phone numbers yet. Use the button above.
              </p>
            ) : (
              <div className="space-y-3">
                {activeNumbers.map((n) => {
                  const agentName = n.agentId ? agentNameById[n.agentId] : null;
                  const displayedMonthlyCostCents = Math.max(n.monthlyCostCents, 189);
                  return (
                    <div
                      key={n.id}
                      className="flex flex-col gap-3 border-b border-gray-200 pb-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-base font-semibold text-black">{n.phoneNumber}</p>
                        <p className="text-xs text-gray-500">
                          ${(displayedMonthlyCostCents / 100).toFixed(2)}/mo
                          {" · "}
                          {agentName ? (
                            <>
                              answered by{" "}
                              <Link
                                href={`/agents/${n.agentId}`}
                                className="font-medium text-black underline"
                              >
                                {agentName}
                              </Link>
                            </>
                          ) : (
                            <span className="text-gray-400">no agent yet — edit in agent page</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <a
                          href={`tel:${n.phoneNumber}`}
                          className={buttonClasses({ size: "sm" })}
                        >
                          Call now
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRelease(n.id)}
                        >
                          Release
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Forwarding */}
        {activeNumbers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Forward your existing business number (optional)</CardTitle>
              <CardDescription>
                Keep publishing your current business number — route its calls into SmartLine
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <p className="mb-2 text-xs font-medium text-gray-500">FORWARD YOUR CALLS TO:</p>
                <p className="text-lg font-semibold text-black">{activeNumbers[0].phoneNumber}</p>
              </div>

              <div className="mt-4 space-y-3">
                <p className="text-xs font-medium text-gray-500">CARRIER INSTRUCTIONS:</p>
                {[
                  { carrier: "AT&T", code: "*21*{number}#", disable: "#21#" },
                  { carrier: "Verizon", code: "*72{number}", disable: "*73" },
                  { carrier: "T-Mobile", code: "**21*{number}#", disable: "##21#" },
                  { carrier: "Sprint/T-Mobile", code: "*72{number}", disable: "*720" },
                ].map((c) => (
                  <div
                    key={c.carrier}
                    className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-black">{c.carrier}</p>
                      <p className="text-xs text-gray-500">
                        Enable:{" "}
                        <code className="text-black">
                          {c.code.replace("{number}", activeNumbers[0].phoneNumber)}
                        </code>
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Disable: <code className="text-black">{c.disable}</code>
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-black">
                    Want to transfer your number permanently?
                  </span>{" "}
                  Porting transfers full ownership of your existing number to SmartLine (2–4
                  weeks). Contact support to start a port request.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
