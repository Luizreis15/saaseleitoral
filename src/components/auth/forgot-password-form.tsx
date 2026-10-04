"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) {
        toast.error("Não foi possível enviar o e-mail de redefinição.");
        return;
      }
      setSent(true);
      toast.success("Se o e-mail existir, enviamos as instruções de redefinição.");
    });
  }

  if (sent) {
    return (
      <p className="rounded-lg bg-success/10 p-3 text-sm text-success">
        Verifique sua caixa de entrada para redefinir a senha.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm font-medium">Esqueci minha senha</p>
      <div className="space-y-2">
        <Label htmlFor="reset-email">E-mail</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" variant="outline" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar link de redefinição"}
      </Button>
    </form>
  );
}
