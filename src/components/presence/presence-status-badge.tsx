import { Badge } from "@/components/ui/badge";
import { geoStatusLabel } from "@/lib/presence";
import type { OpPresenceGeoStatus, OpPresenceLinkStatus } from "@/types";

export function PresenceGeoBadge({ status }: { status: OpPresenceGeoStatus | null | undefined }) {
  const value = status ?? "unknown";
  const variant =
    value === "inside"
      ? "success"
      : value === "outside"
        ? "destructive"
        : value === "uncertain"
          ? "warning"
          : "secondary";
  return <Badge variant={variant}>{geoStatusLabel(value)}</Badge>;
}

export function PresenceLinkStatusBadge({ status }: { status: OpPresenceLinkStatus }) {
  const label =
    status === "pending"
      ? "Aguardando"
      : status === "active"
        ? "Ativo"
        : status === "expired"
          ? "Expirado"
          : "Revogado";
  const variant =
    status === "active"
      ? "success"
      : status === "pending"
        ? "warning"
        : status === "revoked"
          ? "destructive"
          : "secondary";
  return <Badge variant={variant}>{label}</Badge>;
}
