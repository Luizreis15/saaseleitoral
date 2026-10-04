import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCpf(cpf: string): string {
  const d = onlyDigits(cpf).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCpf(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = onlyDigits(cpf);
  if (d.length !== 11) return "***";
  return `***.***.*${d.slice(7, 9)}-${d.slice(9)}`;
}

export function formatPhone(phone: string): string {
  const d = onlyDigits(phone).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  }
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}

export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatPostalCode(cep: string): string {
  const d = onlyDigits(cep).slice(0, 8);
  return d.replace(/(\d{5})(\d{0,3})/, "$1-$2").replace(/-$/, "");
}

export function isValidCpf(cpfInput: string): boolean {
  const cpf = onlyDigits(cpfInput);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) sum1 += Number(cpf[i]) * (10 - i);
  let d1 = 11 - (sum1 % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== Number(cpf[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) sum2 += Number(cpf[i]) * (11 - i);
  let d2 = 11 - (sum2 % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === Number(cpf[10]);
}

export function friendlyError(error: unknown): string {
  if (!error) return "Ocorreu um erro inesperado.";
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Ocorreu um erro inesperado.";

  const lower = message.toLowerCase();
  if (lower.includes("cpf já cadastrado") || lower.includes("duplicate key") && lower.includes("cpf")) {
    return "CPF já cadastrado. Não é possível cadastrar este integrante porque o CPF já consta na operação. Procure o administrador caso seja necessário alterar a equipe.";
  }
  if (lower.includes("cpf inválido")) return "CPF inválido. Verifique os dígitos informados.";
  if (lower.includes("permissão") || lower.includes("permission") || lower.includes("row-level security")) {
    return "Você não possui permissão para esta operação.";
  }
  if (lower.includes("já está confirmado")) return "Este pagamento já foi confirmado.";
  if (
    lower.includes("already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already exists")
  ) {
    return "Este e-mail já está cadastrado. Envie o formulário outra vez para concluir o cadastro, se ele tiver ficado incompleto.";
  }
  if (message.length > 180 || lower.includes("postgres") || lower.includes("stack")) {
    return "Não foi possível concluir a operação. Tente novamente ou fale com o administrador.";
  }
  return message;
}
