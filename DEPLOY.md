# Deploy — Digital Hera Gestão Operacional

Guia para subir o app no **GitHub `saaseleitoral`**, conectar **Supabase** e publicar na **Vercel**.

---

## 1) Colocar o código no `saaseleitoral` (pelo Mac, sem Cursor Cloud)

### A. Baixe o ZIP (navegador)

Abra este link no Safari/Chrome:

https://github.com/Luizreis15/comerciariosabc/archive/refs/heads/cursor/gestao-operacional-equipes-bf2b.zip

### B. No Terminal do Mac

```bash
# pasta de trabalho
cd ~/Desktop
unzip ~/Downloads/comerciariosabc-cursor-gestao-operacional-equipes-bf2b.zip
cd comerciariosabc-cursor-gestao-operacional-equipes-bf2b

# clone o repo destino
git clone https://github.com/Luizreis15/saaseleitoral.git
cd saaseleitoral
git checkout -b cursor/gestao-operacional-v1-bf2b

# copie o app para a RAIZ do saaseleitoral
rsync -a --exclude node_modules --exclude .next --exclude .env.local \
  ../gestao-operacional/ ./

mkdir -p supabase/migrations
cp ../supabase/migrations/20261002140*.sql supabase/migrations/

# commit + push (vai pedir login GitHub se necessário)
git add -A
git status   # NÃO deve aparecer .env.local
git commit -m "feat: V1 gestão operacional Digital Era"
git push -u origin cursor/gestao-operacional-v1-bf2b
```

Se `git push` pedir autenticação:
- use **GitHub CLI**: `brew install gh && gh auth login`
- ou Personal Access Token com escopo `repo`

Depois, no GitHub: abra PR `cursor/gestao-operacional-v1-bf2b` → `main` e faça merge.

---

## 2) Criar projeto Supabase

1. Acesse https://supabase.com/dashboard  
2. **New project**
   - Name: `saaseleitoral` (ou Digital Hera)
   - Region: **South America (São Paulo)** se disponível, senão a mais próxima
   - Defina uma senha forte do banco (guarde)
3. Espere o projeto ficar **Ready**

### Variáveis (Settings → API)

Copie:

| Variável | Onde fica |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` (**secreta**, só servidor) |

### Rodar as migrations

No Supabase: **SQL Editor → New query**

Cole **nessa ordem** o conteúdo de cada arquivo e rode (Run):

1. `supabase/migrations/20261002140000_gestao_operacional_schema.sql`
2. `supabase/migrations/20261002140100_gestao_operacional_functions.sql`
3. `supabase/migrations/20261002140200_gestao_operacional_rls.sql`
4. `supabase/migrations/20261002140300_gestao_operacional_seed_cities.sql`
5. `supabase/migrations/20261004030000_provision_coordinator.sql`
6. `supabase/migrations/20261004120000_presence_links.sql`
7. `supabase/migrations/20261004140000_presence_phase2.sql`

### Auth (Settings → Authentication)

1. Em **URL Configuration**:
   - Site URL: `https://SEU-DOMINIO.vercel.app`
   - Redirect URLs: `https://SEU-DOMINIO.vercel.app/**` e `http://localhost:3000/**`
2. Em **Providers**, mantenha **Email** habilitado

### Criar o primeiro Master

1. **Authentication → Users → Add user**
   - e-mail + senha
   - marque “Auto Confirm User”
2. Copie o **User UID**
3. No SQL Editor:

```sql
INSERT INTO public.op_profiles (auth_user_id, full_name, email, role, active)
VALUES (
  '<COLE-O-UID-AQUI>',
  'Master Digital Hera',
  'seu-email@exemplo.com',
  'master',
  true
);
```

---

## 3) Publicar na Vercel

1. Acesse https://vercel.com → **Add New Project**
2. Importe **`Luizreis15/saaseleitoral`** (branch `main` após o merge)
3. Framework: **Next.js** (detecta sozinho)
4. Root Directory: **`.`** (raiz)
5. Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://SEU-DOMINIO.vercel.app
NEXT_PUBLIC_MAPS_API_KEY=   # opcional

# WhatsApp opcional (Evolution OU Meta)
WHATSAPP_EVOLUTION_URL=
WHATSAPP_EVOLUTION_API_KEY=
WHATSAPP_EVOLUTION_INSTANCE=
WHATSAPP_META_TOKEN=
WHATSAPP_META_PHONE_NUMBER_ID=
```

### WhatsApp — como funciona

1. Sem API configurada: o botão **Abrir WhatsApp** usa `wa.me` com a mensagem pronta
2. Com **Evolution API**: envio server-side automático ao gerar o link
3. Com **Meta Cloud API**: envio server-side (texto livre; templates oficiais podem ser exigidos pela Meta em produção)

6. **Deploy**
7. Volte no Supabase e atualize Site URL / Redirect URLs com a URL da Vercel

### Redeploy depois de mudar env

Vercel → Project → Deployments → ⋮ → Redeploy

---

## 4) Teste rápido pós-deploy

1. Abra `https://seu-app.vercel.app/login`
2. Entre com o Master
3. Vá em **Coordenadores → Novo**
4. Cadastre um coordenador e teste login dele em `/minha-equipe`

---

## Problemas comuns

| Erro | Solução |
|------|---------|
| `Permission denied to cursor[bot]` | O Cloud Agent não tem escrita no `saaseleitoral`. Use o Mac/Terminal com sua conta. |
| Login ok mas tela vazia / redirect loop | Falta `op_profiles` com `role=master` e `active=true`. |
| Falha ao criar coordenador | `SUPABASE_SERVICE_ROLE_KEY` não está na Vercel (só server). |
| CPF inválido | Informe CPF com dígitos verificadores corretos. |
| Maps não busca escola | `NEXT_PUBLIC_MAPS_API_KEY` opcional; dá para cadastrar lat/lng manual. |

---

## Checklist

- [ ] Código no `saaseleitoral` (main)
- [ ] Migrations aplicadas (inclui presença)
- [ ] Master criado (Auth + `op_profiles`)
- [ ] Env vars na Vercel
- [ ] Site URL do Supabase apontando para Vercel
- [ ] Login Master funcionando
- [ ] Coordenador criado e logando
