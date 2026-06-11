"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorText, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Login failed");
      }
      const next = new URLSearchParams(window.location.search).get("next") || "/companies";
      router.replace(next.startsWith("/") ? next : "/companies");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-navy">Luna Desk</h1>
          <p className="mt-1 text-[13px] text-fg-subtle">Travelgenix B2B CRM</p>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-[0_20px_50px_-20px_rgba(8,15,30,0.25)]"
        >
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-fg-muted" htmlFor="password">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the team password"
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <Button type="submit" disabled={loading || !password} className="w-full">
            {loading ? "Unlocking..." : "Unlock"}
          </Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-subtle">
          Internal tool. Authorised access only.
        </p>
      </div>
    </div>
  );
}
