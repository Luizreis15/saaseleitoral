"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { markPaymentPaidAction } from "@/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";

export function ConfirmPaymentDialog({
  paymentId,
  memberName,
  amount,
}: {
  paymentId: string;
  memberName: string;
  amount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await markPaymentPaidAction(paymentId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pagamento confirmado.");
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Confirmar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pagamento?</DialogTitle>
            <DialogDescription>
              {memberName}
              <br />
              {formatCurrency(amount)}
              <br />
              <span className="mt-2 block">Esta ação será registrada no histórico.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="success" onClick={confirm} disabled={pending}>
              {pending ? "Confirmando..." : "Confirmar pagamento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
