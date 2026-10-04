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
    <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar pessoa, CPF, coordenador ou escola..."
          className="pl-9"
        />
      </div>
      <Button type="submit" disabled={pending || !q.trim()}>
        Buscar
      </Button>
    </form>
  );
}
