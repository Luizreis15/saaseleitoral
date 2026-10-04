import type { OpUserRole } from "@/types";

export const MASTER_NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/busca", label: "Busca" },
  { href: "/coordenadores", label: "Coordenadores" },
  { href: "/equipes", label: "Equipes" },
  { href: "/integrantes", label: "Integrantes" },
  { href: "/locais", label: "Locais" },
  { href: "/mapa", label: "Mapa" },
  { href: "/pagamentos", label: "Pagamentos" },
  { href: "/pendencias", label: "Pendências" },
  { href: "/auditoria", label: "Auditoria" },
  { href: "/configuracoes", label: "Configurações" },
] as const;

export const COORDINATOR_NAV = [
  { href: "/minha-equipe", label: "Visão geral" },
  { href: "/minha-equipe/integrantes", label: "Minha equipe" },
  { href: "/minha-equipe/distribuicao", label: "Distribuição" },
  { href: "/minha-equipe/locais", label: "Locais" },
  { href: "/pagamentos", label: "Pagamentos" },
  { href: "/configuracoes", label: "Minha conta" },
] as const;

export function navForRole(role: OpUserRole) {
  return role === "master" ? MASTER_NAV : COORDINATOR_NAV;
}

export function canConfirmPayment(role: OpUserRole) {
  return role === "master";
}

export function canManageCoordinators(role: OpUserRole) {
  return role === "master";
}

export function canTransferMember(role: OpUserRole) {
  return role === "master";
}

export function canViewAudit(role: OpUserRole) {
  return role === "master";
}
