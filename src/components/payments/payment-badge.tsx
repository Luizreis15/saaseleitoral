import { Badge } from "@/components/ui/badge";
import type { OpPaymentStatus } from "@/types";

export function PaymentBadge({ status }: { status: OpPaymentStatus }) {
  if (status === "paid") {
    return <Badge variant="success">Pago</Badge>;
  }
  return <Badge variant="warning">Pendente</Badge>;
}

export function StatusBadge({ active }: { active: boolean }) {
  return active ? <Badge variant="success">Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>;
}
