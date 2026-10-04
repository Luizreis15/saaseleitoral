# Digital Hera — Gestão Operacional de Equipes (V1)

Aplicação web privada para administrar equipes operacionais:

`Master → Coordenador → Equipe → Integrantes → Escolas`

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + componentes estilo shadcn/ui
- Supabase (Auth + PostgreSQL + RLS)
- React Hook Form / Zod
- Google Maps Platform (opcional)
- Deploy: Vercel

## Locale

PT-BR · BRL · America/Sao_Paulo

## Setup local

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Deploy (Supabase + Vercel)

Siga o passo a passo completo em **[DEPLOY.md](./DEPLOY.md)**.

Resumo:

1. Enviar código para `Luizreis15/saaseleitoral`
2. Criar projeto Supabase e rodar as migrations em `supabase/migrations/` (incluindo presença)
3. Criar usuário Master no Auth + linha em `op_profiles`
4. Importar o repo na Vercel e configurar as env vars

## Security Rules

1. Never bypass Supabase RLS.
2. Never expose service_role credentials client-side.
3. Never authorize actions only through UI visibility.
4. Validate all mutations server-side.
5. Validate CPF both application-side and database-side.
6. Coordinators may access only their assigned team.
7. Only MASTER can create coordinator accounts.
8. Only MASTER can mark payments as paid.
9. Never hard-delete financial or audit records.
10. Never collect political preference or voting-intention data.
11. Every schema change requires a migration.
12. Sensitive actions must create audit logs.

## Presença (V1)

Fluxo operacional:

1. No detalhe do integrante, gere um **link de presença** (escola + validade)
2. Envie o link + código de 6 dígitos pelo WhatsApp
3. O integrante abre `/p/[token]`, confirma telefone e autoriza GPS
4. Enquanto a sessão estiver aberta, o app registra se ele está dentro do raio da escola
5. Acompanhe em **Presença** (`/presenca`)

Requer a migration `20261004120000_presence_links.sql` e `SUPABASE_SERVICE_ROLE_KEY` no servidor.

## Rotas

| Perfil | Rotas |
|--------|-------|
| Auth | `/login` |
| Público | `/p/[token]` (presença) |
| Master | `/dashboard`, `/busca`, `/coordenadores`, `/equipes`, `/integrantes`, `/locais`, `/mapa`, `/presenca`, `/pagamentos`, `/pendencias`, `/auditoria` |
| Coordenador | `/minha-equipe`, `/minha-equipe/integrantes`, `/minha-equipe/distribuicao`, `/minha-equipe/locais`, `/presenca`, `/pagamentos` |

## Conformidade

Ferramenta administrativa operacional — não substitui contabilidade nem Conta+JE / Justiça Eleitoral.
