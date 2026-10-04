"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function GlobalSearchInput({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(defaultValue);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    startTransition(() => {
      router.push(`/busca?q=${encodeURIComponent(term)}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex w-full min-w-0 gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pessoa, CPF ou escola"
          className="h-11 min-w-0 pl-9"
          enterKeyHint="search"
        />
      </div>
      <Button type="submit" className="h-11 shrink-0 px-3" disabled={pending || !q.trim()} aria-label="Buscar">
        <Search className="h-4 w-4 md:hidden" />
        <span className="hidden md:inline">Buscar</span>
      </Button>
    </form>
  );
}
