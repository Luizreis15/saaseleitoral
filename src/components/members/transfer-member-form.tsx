"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { transferMemberAction } from "@/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { OpTeam } from "@/types";

export function TransferMemberForm({
  memberId,
  memberName,
  currentTeamId,
  teams,
}: {
  memberId: string;
  memberName: string;
  currentTeamId: string;
  teams: OpTeam[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState("");
  const [pending, startTransition] = useTransition();
  const options = teams.filter((t) => t.id !== currentTeamId);

  function onTransfer() {
    if (!teamId) {
      toast.error("Selecione a equipe de destino.");
      return;
    }
    startTransition(async () => {
      const result = await transferMemberAction(memberId, teamId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${memberName} transferido(a) com sucesso.`);
      router.refresh();
    });
  }

  if (!options.length) {
    return <p className="text-sm text-muted-foreground">Não há outra equipe disponível para transferência.</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <div>
        <h3 className="font-medium">Transferir de equipe</h3>
        <p className="text-sm text-muted-foreground">
          O CPF permanece único. A atribuição de escola atual será desativada.
        </p>
      </div>
      <div className="space-y-2">
        <Label>Nova equipe</Label>
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a equipe" />
          </SelectTrigger>
          <SelectContent>
            {options.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button onClick={onTransfer} disabled={pending} variant="default">
        {pending ? "Transferindo..." : "Transferir"}
      </Button>
    </div>
  );
}
