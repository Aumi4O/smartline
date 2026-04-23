"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Document {
  id: string;
  agentId: string;
  filename: string;
  fileSizeBytes: number;
  status: string;
  chunkCount: number;
}

interface Agent {
  id: string;
  name: string;
}

interface Profile {
  businessName: string;
  industry: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  hoursOfOperation: string;
  services: string;
  pricing: string;
  faq: string;
  policies: string;
  specialInstructions: string;
}

const emptyProfile: Profile = {
  businessName: "", industry: "", description: "", address: "",
  phone: "", email: "", website: "", hoursOfOperation: "",
  services: "", pricing: "", faq: "", policies: "", specialInstructions: "",
};

export default function KnowledgePage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    const [profileRes, docsRes, agentsRes] = await Promise.all([
      fetch("/api/business-profile"),
      fetch("/api/knowledge"),
      fetch("/api/agents"),
    ]);
    if (profileRes.ok) {
      const data = await profileRes.json();
      if (data.profile) setProfile({ ...emptyProfile, ...data.profile });
    }
    if (docsRes.ok) {
      const data = await docsRes.json();
      setDocuments((data.documents || []).filter((d: Document) => d.filename !== "_business_profile.txt"));
    }
    if (agentsRes.ok) {
      const data = await agentsRes.json();
      setAgents(data.agents || []);
      if (data.agents?.length && !selectedAgent) setSelectedAgent(data.agents[0].id);
    }
  }, [selectedAgent]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function updateProfile(field: keyof Profile, value: string) {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/business-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setSaved(true);
        fetchData();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file || !selectedAgent) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("agentId", selectedAgent);
      const res = await fetch("/api/knowledge/upload", { method: "POST", body: formData });
      if (res.ok) {
        fetchData();
        if (fileRef.current) fileRef.current.value = "";
      } else {
        const data = await res.json();
        setError(data.error || "Upload failed");
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    fetchData();
  }

  const textarea = "flex min-h-[100px] w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-black placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-black">Knowledge Base</h1>
        <p className="mt-1 text-gray-500">
          Tell us about your business. Your agent will use this to answer calls intelligently.
        </p>
      </div>

      <form onSubmit={handleSaveProfile} className="max-w-[768px] space-y-6">
        {error && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black">{error}</p>
        )}
        {saved && (
          <p className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-black">
            Saved. Your agent is now trained on this information.
          </p>
        )}

        {/* Business Basics */}
        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
            <CardDescription>Basic details about your business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Business Name</label>
                <Input placeholder="Acme Dental Clinic" value={profile.businessName} onChange={(e) => updateProfile("businessName", e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Industry</label>
                <Input placeholder="Dental, Restaurant, Law, Real Estate..." value={profile.industry} onChange={(e) => updateProfile("industry", e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Business Description</label>
              <textarea className={textarea} placeholder="We are a family dental clinic serving the Austin area since 2005. We specialize in cosmetic dentistry, implants, and general dental care..." value={profile.description} onChange={(e) => updateProfile("description", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>So your agent can direct callers properly</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Address</label>
                <Input placeholder="123 Main St, Austin, TX 78701" value={profile.address} onChange={(e) => updateProfile("address", e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Phone</label>
                <Input placeholder="+1 (512) 555-0100" value={profile.phone} onChange={(e) => updateProfile("phone", e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Email</label>
                <Input placeholder="info@acmedental.com" value={profile.email} onChange={(e) => updateProfile("email", e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-black">Website</label>
                <Input placeholder="https://acmedental.com" value={profile.website} onChange={(e) => updateProfile("website", e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Hours + Services */}
        <Card>
          <CardHeader>
            <CardTitle>Hours & Services</CardTitle>
            <CardDescription>What you offer and when you&apos;re open</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Hours of Operation</label>
              <textarea className={textarea} placeholder={"Monday-Friday: 8:00 AM - 6:00 PM\nSaturday: 9:00 AM - 2:00 PM\nSunday: Closed"} value={profile.hoursOfOperation} onChange={(e) => updateProfile("hoursOfOperation", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Services Offered</label>
              <textarea className={textarea} placeholder={"- General dental checkups and cleanings\n- Teeth whitening ($299)\n- Dental implants ($2,500-$4,500)\n- Emergency dental care (same-day appointments)\n- Invisalign ($3,500-$5,000)"} value={profile.services} onChange={(e) => updateProfile("services", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Pricing</label>
              <textarea className={textarea} placeholder={"New patient exam: $150\nCleaning: $120\nFilling: $200-$350\nCrown: $900-$1,200\nWe accept most insurance plans including Delta Dental, Cigna, and Aetna."} value={profile.pricing} onChange={(e) => updateProfile("pricing", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {/* FAQ + Policies */}
        <Card>
          <CardHeader>
            <CardTitle>FAQ & Policies</CardTitle>
            <CardDescription>Common questions and important policies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Frequently Asked Questions</label>
              <textarea className={textarea + " min-h-[140px]"} placeholder={"Q: Do you accept new patients?\nA: Yes, we welcome new patients and offer a free initial consultation.\n\nQ: Do you offer payment plans?\nA: Yes, we offer CareCredit financing with 0% interest for 12 months.\n\nQ: What insurance do you accept?\nA: We accept Delta Dental, Cigna, Aetna, MetLife, and most PPO plans."} value={profile.faq} onChange={(e) => updateProfile("faq", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Policies</label>
              <textarea className={textarea} placeholder={"- 24-hour cancellation policy\n- $50 no-show fee\n- Payment due at time of service\n- We require a valid credit card on file"} value={profile.policies} onChange={(e) => updateProfile("policies", e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-black">Special Instructions for the Agent</label>
              <textarea className={textarea} placeholder={"- Always offer to book an appointment before ending the call\n- If caller is in pain, mark as urgent and transfer to the office\n- We're currently running a 20% off whitening promotion"} value={profile.specialInstructions} onChange={(e) => updateProfile("specialInstructions", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Business Info"}
          </Button>
        </div>
      </form>

      {/* Extra Documents (optional file upload below the form) */}
      <div className="mt-12 max-w-[768px] space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Additional Documents</CardTitle>
            <CardDescription>
              Optional: Upload menus, price lists, or other documents your agent should know about.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {agents.length === 0 ? (
              <p className="text-sm text-gray-400">Create an agent first.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <select value={selectedAgent} onChange={(e) => setSelectedAgent(e.target.value)}
                    className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-black">
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <input ref={fileRef} type="file" accept=".txt,.csv,.json,.md"
                    className="flex-1 text-sm text-black file:mr-3 file:rounded-lg file:border file:border-gray-200 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-black hover:file:bg-gray-50" />
                  <Button onClick={handleUpload} disabled={uploading} variant="secondary">
                    {uploading ? "Uploading..." : "Upload"}
                  </Button>
                </div>
              </div>
            )}

            {documents.length > 0 && (
              <div className="mt-4 space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-black">{doc.filename}</p>
                      <p className="text-xs text-gray-400">{doc.chunkCount} chunks · {doc.status}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(doc.id)}>Delete</Button>
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
