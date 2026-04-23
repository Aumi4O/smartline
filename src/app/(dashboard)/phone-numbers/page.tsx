"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  agentId: string | null;
  status: string;
  monthlyCostCents: number;
  createdAt: string;
}

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
  capabilities: { voice: boolean; sms: boolean };
}

export default function PhoneNumbersPage() {
  const [myNumbers, setMyNumbers] = useState<PhoneNumber[]>([]);
  const [available, setAvailable] = useState<AvailableNumber[]>([]);
  const [areaCode, setAreaCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchMyNumbers = useCallback(async () => {
    const res = await fetch("/api/phone-numbers");
    if (res.ok) {
      const data = await res.json();
      setMyNumbers(data.numbers);
    }
  }, []);

  useEffect(() => { fetchMyNumbers(); }, [fetchMyNumbers]);

  async function handleSearch() {
    setSearching(true);
    setError("");
    setAvailable([]);
    try {
      const params = areaCode ? `?areaCode=${areaCode}` : "";
      const res = await fetch(`/api/phone-numbers/search${params}`);
      const data = await res.json();
      if (res.ok) {
        setAvailable(data.numbers || []);
        if (!data.numbers?.length) setError("No numbers found. Try a different area code.");
      } else {
        setError(data.error || "Search failed");
      }
    } finally {
      setSearching(false);
    }
  }

  async function handlePurchase(number: string) {
    setPurchasing(number);
    setError("");
    try {
      const res = await fetch("/api/phone-numbers/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: number }),
      });
      const data = await res.json();
      if (res.ok) {
        setAvailable((prev) => prev.filter((n) => n.phoneNumber !== number));
        fetchMyNumbers();
      } else {
        setError(data.error || "Purchase failed");
      }
    } finally {
      setPurchasing(null);
    }
  }

  async function handleRelease(id: string) {
    const res = await fetch("/api/phone-numbers/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumberId: id }),
    });
    if (res.ok) fetchMyNumbers();
  }

  const activeNumbers = myNumbers.filter((n) => n.status === "active");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Phone Numbers</h1>
        <p className="mt-1 text-gray-500">Search, purchase, and manage your Twilio phone numbers.</p>
      </div>

      <div className="max-w-[768px] space-y-6">
        {/* My Numbers */}
        <Card>
          <CardHeader>
            <CardTitle>Your Numbers ({activeNumbers.length})</CardTitle>
            <CardDescription>Phone numbers assigned to your account</CardDescription>
          </CardHeader>
          <CardContent>
            {activeNumbers.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                No phone numbers yet. Search and purchase one below.
              </p>
            ) : (
              <div className="space-y-2">
                {activeNumbers.map((n) => (
                  <div key={n.id} className="flex items-center justify-between border-b border-gray-200 pb-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-black">{n.phoneNumber}</p>
                      <p className="text-xs text-gray-400">
                        ${(n.monthlyCostCents / 100).toFixed(2)}/mo
                        {n.agentId ? " · Assigned to agent" : " · Unassigned"}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRelease(n.id)}
                    >
                      Release
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Connect Existing Number */}
        <Card>
          <CardHeader>
            <CardTitle>Connect Your Existing Number</CardTitle>
            <CardDescription>Forward calls from your business number to SmartLine</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Keep your current business number and forward calls to your SmartLine number. 
              The AI agent will answer all forwarded calls automatically.
            </p>

            {activeNumbers.length === 0 ? (
              <p className="text-sm text-gray-400">Buy a SmartLine number first, then forward your existing number to it.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-medium text-gray-400 mb-2">FORWARD YOUR CALLS TO:</p>
                  <p className="text-lg font-semibold text-black">{activeNumbers[0].phoneNumber}</p>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-medium text-gray-400">CARRIER INSTRUCTIONS:</p>
                  {[
                    { carrier: "AT&T", code: "*21*{number}#", disable: "#21#" },
                    { carrier: "Verizon", code: "*72{number}", disable: "*73" },
                    { carrier: "T-Mobile", code: "**21*{number}#", disable: "##21#" },
                    { carrier: "Sprint/T-Mobile", code: "*72{number}", disable: "*720" },
                  ].map((c) => (
                    <div key={c.carrier} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-black">{c.carrier}</p>
                        <p className="text-xs text-gray-400">
                          Enable: <code className="text-black">{c.code.replace("{number}", activeNumbers[0].phoneNumber)}</code>
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">Disable: <code className="text-black">{c.disable}</code></p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-black">For other carriers or landlines:</span> Contact your phone provider 
                    and ask to set up unconditional call forwarding to {activeNumbers[0].phoneNumber}.
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-black">Want to transfer your number permanently?</span> Number porting 
                    transfers full ownership to SmartLine (takes 2-4 weeks). Contact support to start a port request.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Get a New Number</CardTitle>
            <CardDescription>Search by area code (e.g. 415, 212, 305) · $1.80/month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="Area code (optional)"
                value={areaCode}
                onChange={(e) => setAreaCode(e.target.value)}
                className="max-w-[160px]"
              />
              <Button onClick={handleSearch} disabled={searching}>
                {searching ? "Searching..." : "Search Numbers"}
              </Button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-gray-500">{error}</p>
            )}

            {available.length > 0 && (
              <div className="mt-4 space-y-2">
                {available.map((n) => (
                  <div key={n.phoneNumber} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-black">{n.phoneNumber}</p>
                      <p className="text-xs text-gray-400">
                        {n.locality}{n.region ? `, ${n.region}` : ""}
                        {n.capabilities.sms ? " · Voice + SMS" : " · Voice only"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handlePurchase(n.phoneNumber)}
                      disabled={purchasing === n.phoneNumber}
                    >
                      {purchasing === n.phoneNumber ? "Buying..." : "Buy — $1.80/mo"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
