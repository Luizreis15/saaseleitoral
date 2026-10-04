import { z } from "zod";
import { isValidCpf, onlyDigits } from "@/lib/utils";

export const cpfSchema = z
  .string()
  .min(11, "CPF obrigatório")
  .transform((v) => onlyDigits(v))
  .refine((v) => v.length === 11, "CPF deve ter 11 dígitos")
  .refine((v) => isValidCpf(v), "CPF inválido");

export const pixTypeSchema = z.enum(["cpf", "cnpj", "email", "telefone", "aleatoria"]);

export const memberSchema = z.object({
  full_name: z.string().min(3, "Nome completo obrigatório"),
  cpf: cpfSchema,
  phone: z.string().min(10, "Telefone obrigatório"),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  city_id: z.string().uuid("Cidade obrigatória"),
  neighborhood: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  address_number: z.string().optional().or(z.literal("")),
  complement: z.string().optional().or(z.literal("")),
  postal_code: z.string().optional().or(z.literal("")),
  pix_type: pixTypeSchema,
  pix_key: z.string().min(3, "Chave Pix obrigatória"),
  team_id: z.string().uuid("Equipe obrigatória"),
  location_id: z.string().uuid().optional().or(z.literal("")),
  active: z.boolean().default(true),
});

export const coordinatorSchema = z.object({
  full_name: z.string().min(3, "Nome completo obrigatório"),
  cpf: cpfSchema,
  phone: z.string().min(10, "Telefone obrigatório"),
  whatsapp: z.string().optional().or(z.literal("")),
  email: z.string().email("E-mail inválido"),
  temporary_password: z.string().min(8, "Senha temporária com no mínimo 8 caracteres"),
  team_name: z.string().min(2, "Nome da equipe obrigatório"),
  default_payment_amount: z.coerce.number().min(0, "Valor inválido"),
  active: z.boolean().default(true),
});

export const teamSchema = z.object({
  name: z.string().min(2, "Nome da equipe obrigatório"),
  default_payment_amount: z.coerce.number().min(0),
  active: z.boolean().default(true),
});

export const locationSchema = z.object({
  name: z.string().min(2, "Nome do local obrigatório"),
  city_id: z.string().uuid("Cidade obrigatória"),
  address: z.string().optional().or(z.literal("")),
  address_number: z.string().optional().or(z.literal("")),
  neighborhood: z.string().optional().or(z.literal("")),
  postal_code: z.string().optional().or(z.literal("")),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  operational_radius: z.coerce.number().int().min(0).default(300),
  place_provider: z.string().optional().or(z.literal("")),
  place_external_id: z.string().optional().or(z.literal("")),
  team_id: z.string().uuid().optional().or(z.literal("")),
});

export const assignmentSchema = z.object({
  member_id: z.string().uuid(),
  location_id: z.string().uuid("Selecione um local"),
  team_id: z.string().uuid(),
});

export const paymentSchema = z.object({
  member_id: z.string().uuid(),
  amount: z.coerce.number().min(0),
  status: z.enum(["pending", "paid"]),
});

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "Senha obrigatória"),
});

export const createPresenceLinkSchema = z.object({
  member_id: z.string().uuid("Integrante inválido"),
  location_id: z.string().uuid("Local inválido"),
  duration_hours: z.coerce.number().min(1, "Mínimo 1 hora").max(24, "Máximo 24 horas").default(4),
  ping_interval_sec: z.coerce.number().int().min(15).max(300).default(45),
});

export const presenceVerifySchema = z.object({
  token: z.string().min(16, "Link inválido"),
  phone: z.string().min(10, "Informe o telefone cadastrado"),
  otp: z.string().regex(/^\d{6}$/, "Código deve ter 6 dígitos"),
  consent: z.literal(true, {
    errorMap: () => ({ message: "É necessário autorizar o uso da localização" }),
  }),
});

export const presencePingSchema = z.object({
  session_token: z.string().min(16, "Sessão inválida"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy_m: z.number().min(0).max(50000).nullable().optional(),
  client_ts: z.string().datetime().optional(),
});

export const presenceEndSchema = z.object({
  session_token: z.string().min(16, "Sessão inválida"),
});

export type MemberInput = z.infer<typeof memberSchema>;
export type CoordinatorInput = z.infer<typeof coordinatorSchema>;
export type LocationInput = z.infer<typeof locationSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePresenceLinkInput = z.infer<typeof createPresenceLinkSchema>;
