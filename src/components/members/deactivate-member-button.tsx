"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setMemberActiveAction } from "@/actions";
import { Button } from "@/components/ui/button";

export function DeactivateMemberButton({
  memberId,
  active,
}: {
  memberId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setMemberActiveAction(memberId, !active);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(active ? "Integrante inativado." : "Integrante reativado.");
      router.refresh();
    });
  }

  return (
    <Button variant={active ? "destructive" : "success"} onClick={toggle} disabled={pending}>
      {pending ? "Atualizando..." : active ? "Inativar integrante" : "Reativar integrante"}
    </Button>
  );
}
