"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Moon } from "lucide-react";
import { Button, Field, InlineAlert, Input } from "@/components/ui";

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
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklab, var(--navy) 14%, transparent), transparent 70%)",
        }}
      />
      <div className="luna-fade relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border-soft bg-accent-soft text-accent-strong shadow-raise">
            <Moon className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-navy">Luna Desk</h1>
          <p className="mt-1 text-[13px] text-fg-subtle">Travelgenix B2B CRM</p>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-float"
        >
          <Field label="Password">
            <Input
              id="password"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter the team password"
            />
          </Field>
          {error && <InlineAlert variant="danger">{error}</InlineAlert>}
          <Button
            type="submit"
            size="lg"
            disabled={loading || !password}
            className="w-full"
          >
            {loading ? "Unlocking…" : "Unlock"}
            {!loading && <ArrowRight className="h-4 w-4" strokeWidth={2} />}
          </Button>
        </form>
        <p className="mt-4 text-center text-[13px] text-fg-subtle">
          Internal tool. Authorised access only.
        </p>
      </div>
    </div>
  );
}
