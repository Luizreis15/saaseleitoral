"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { revokePresenceLinkAction } from "@/actions";
import { Button } from "@/components/ui/button";

export function RevokePresenceButton({ linkId }: { linkId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await revokePresenceLinkAction(linkId);
          if (!res.ok) {
            toast.error(res.error);
            return;
          }
          toast.success("Link revogado");
        });
      }}
    >
      {pending ? "..." : "Revogar"}
    </Button>
  );
}
