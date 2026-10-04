"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { loginAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function LoginPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showReset, setShowReset] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    startTransition(async () => {
      const result = await loginAction(fd);
      if (result && !result.ok) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md rounded-2xl border bg-white/95 p-8 shadow-lg animate-fade-up">
        <div className="mb-8 text-center">
          <p className="text-2xl font-semibold tracking-tight text-primary">Digital Era</p>
          <h1 className="mt-2 text-lg font-medium text-foreground">Gestão Operacional</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesse com seu e-mail e senha</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          {!showReset ? (
            <button
              type="button"
              className="w-full text-center text-xs text-muted-foreground underline-offset-2 hover:underline"
              onClick={() => setShowReset(true)}
            >
              Esqueci minha senha
            </button>
          ) : (
            <ForgotPasswordForm />
          )}
        </div>
      </div>
    </div>
  );
}
