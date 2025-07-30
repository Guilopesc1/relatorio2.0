# 📊 PWA de Relatórios de Anúncios - Arquitetura Prisma

## 🎯 **Visão Geral**

Sistema PWA para geração automática de relatórios de campanhas publicitárias das principais plataformas (Facebook, Google, TikTok) com envio via WhatsApp.

**🏗️ Arquitetura:** Next.js 15 + Prisma ORM + PostgreSQL (Supabase) + Redis + Evolution API

---

## 🚀 **Início Rápido**

### **Pré-requisitos**
- Node.js 18+
- PostgreSQL (Supabase)
- Redis (local ou cloud)

### **Instalação**
```bash
# 1. Clonar e instalar dependências
git clone <repo>
cd relatorio-otimizado
npm install

# 2. Configurar banco de dados
cp .env.example .env
# Editar .env com suas credenciais

# 3. Gerar Prisma Client e aplicar schema
npm run db:generate
npm run db:push

# 4. Iniciar aplicação
npm run dev
```

### **Acesso**
- **Aplicação:** http://localhost:3000
- **Database Studio:** `npm run db:studio`

---

## 🏗️ **Arquitetura do Sistema**

### **📁 Estrutura de Pastas**
```
├── app/                    # App Router (Next.js 15)
│   ├── api/               # API Routes
│   │   ├── auth/          # Autenticação NextAuth
│   │   ├── connections/   # Gestão de conexões
│   │   ├── user/          # Gestão de usuários
│   │   ├── facebook/      # APIs Facebook Ads
│   │   └── ...
│   ├── dashboard/         # Dashboard principal
│   ├── login/            # Página de login
│   └── register/         # Página de registro
├── components/            # Componentes React
│   ├── dashboard/        # Componentes do dashboard
│   ├── connections/      # Componentes de conexões
│   └── ui/              # Componentes base
├── lib/                  # Utilitários e services
│   ├── services/        # Services Prisma
│   │   ├── prisma-connection-service.ts
│   │   ├── prisma-user-service.ts
│   │   └── prisma-facebook-service.ts
│   ├── auth/           # Configuração NextAuth
│   ├── prisma.ts       # Cliente Prisma
│   └── utils.ts        # Utilitários
├── prisma/              # Schema e migrations
│   └── schema.prisma   # Schema do banco
└── types/              # Tipos TypeScript
    └── next-auth.d.ts  # Tipos NextAuth
```

### **🗄️ Schema do Banco (Prisma)**

#### **Tabelas Principais**
- **`app_users`** - Usuários do sistema
- **`api_connections`** - Conexões com plataformas de anúncios
- **`app_reports`** - Configurações de relatórios
- **`report_executions`** - Histórico de execuções

#### **Tabelas Facebook Cache**
- **`facebook_accounts`** - Contas Facebook conectadas
- **`facebook_campaigns_cache`** - Cache de campanhas
- **`facebook_metrics_cache`** - Cache de métricas
- **`facebook_report_templates`** - Templates de relatórios

#### **Enums**
- **`UserProfile`**: FREE | BASIC | PRO | ENTERPRISE
- **`Platform`**: FACEBOOK | GOOGLE | TIKTOK
- **`ExecutionStatus`**: PENDING | RUNNING | SUCCESS | FAILED

---

## 🔧 **Services Prisma**

### **👥 PrismaUserService**
```typescript
// Gestão completa de usuários
PrismaUserService.createUser(data)
PrismaUserService.getUserById(userId)
PrismaUserService.updateUser(userId, data)
PrismaUserService.changePassword(userId, oldPass, newPass)
PrismaUserService.getUserStats(userId)
```

### **🔌 PrismaConnectionService**
```typescript
// Gestão de conexões com plataformas
PrismaConnectionService.createConnection(data)
PrismaConnectionService.getConnections(userId, platform?)
PrismaConnectionService.updateConnection(connectionId, data)
PrismaConnectionService.getConnectionLimits(userId)
```

### **📘 PrismaFacebookService**
```typescript
// Integração específica com Facebook
PrismaFacebookService.createFacebookConnection(userId, token, accountId)
PrismaFacebookService.getFacebookCampaigns(userId, accountId)
PrismaFacebookService.getFacebookInsights(userId, accountId, objectId)
PrismaFacebookService.invalidateFacebookCache(userId, accountId)
```

---

## 🔐 **Sistema de Autenticação**

### **NextAuth + Prisma**
- **Provider:** Credentials (email/senha)
- **Adapter:** PrismaAdapter
- **Session:** JWT Strategy
- **Password:** bcrypt hashing

### **Fluxo de Autenticação**
1. Usuário envia credenciais
2. Prisma busca usuário no banco
3. bcrypt valida senha
4. JWT gerado com sessão
5. Redirect para dashboard

### **Tipos de Perfil**
- **FREE:** 1 conexão por plataforma, 3 relatórios
- **BASIC:** 3 conexões por plataforma, 10 relatórios
- **PRO:** 10 conexões por plataforma, 50 relatórios
- **ENTERPRISE:** Ilimitado

---

## 📊 **APIs Principais**

### **🔐 Autenticação**
```typescript
POST /api/auth/register    // Criar conta
POST /api/auth/signin      // Login
POST /api/auth/signout     // Logout
```

### **👥 Usuários**
```typescript
GET    /api/user           // Dados do usuário
PUT    /api/user           // Atualizar usuário
DELETE /api/user           // Deletar conta
GET    /api/user?action=stats   // Estatísticas
```

### **🔌 Conexões**
```typescript
GET    /api/connections              // Listar conexões
POST   /api/connections              // Criar conexão
PUT    /api/connections              // Atualizar conexão
DELETE /api/connections?id=xxx       // Remover conexão
```

### **📘 Facebook**
```typescript
GET /api/facebook/campaigns?account_id=xxx&date_range=7
// Retorna campanhas com métricas
```

---

## 🔒 **Segurança**

### **🛡️ Proteções Implementadas**
- **SQL Injection:** Prisma protege automaticamente
- **Type Safety:** 100% TypeScript
- **Token Encryption:** AES-256 para tokens de API
- **Password Hashing:** bcrypt com salt 12
- **Rate Limiting:** Implementado nas rotas críticas
- **CORS:** Configurado adequadamente

### **🔐 Criptografia de Tokens**
```typescript
// Tokens são criptografados antes de salvar
private static encryptToken(token: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', ENCRYPTION_KEY);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}
```

---

## 📈 **Sistema de Cache**

### **🗄️ Facebook Cache**
- **Campanhas:** Cache por 6 horas
- **Métricas:** Cache por 4 horas
- **Invalidação:** Manual ou automática
- **Logs:** Registro de invalidações

### **⚡ Redis Cache**
- **Sessões:** NextAuth sessions
- **API Responses:** Cache de APIs externas
- **Queue Jobs:** Fila de relatórios

---

## 🔄 **Integrações Externas**

### **📘 Facebook Ads API**
- **Version:** v19.0
- **Rate Limits:** 200 calls/hour/user
- **OAuth:** Access tokens com longa duração
- **Endpoints:** Accounts, Campaigns, AdSets, Ads, Insights

### **📞 Evolution API (WhatsApp)**
- **Função:** Envio de relatórios
- **Suporte:** Texto, imagem, PDF, documentos
- **Rate Limits:** Configurável por instância

---

## 🧪 **Desenvolvimento**

### **📦 Scripts Disponíveis**
```bash
npm run dev              # Desenvolvimento
npm run build            # Build para produção
npm run start            # Iniciar produção
npm run lint             # Linting

npm run db:generate      # Gerar Prisma Client
npm run db:push          # Aplicar schema no banco
npm run db:migrate       # Criar migration
npm run db:studio        # Abrir Prisma Studio
npm run db:reset         # Reset banco (cuidado!)
```

### **🔧 Configuração de Desenvolvimento**
```bash
# .env.local para desenvolvimento
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
ENCRYPTION_KEY="..."
FACEBOOK_APP_ID="..."
FACEBOOK_APP_SECRET="..."
```

---

## 🚀 **Deploy**

### **📋 Checklist de Deploy**
- [ ] Variáveis de ambiente configuradas
- [ ] `npm run build` sem erros
- [ ] Database migrations aplicadas
- [ ] Redis configurado
- [ ] SSL/TLS configurado

### **🌐 Ambientes Recomendados**
- **Frontend:** Vercel, Netlify
- **Database:** Supabase, Railway, PlanetScale
- **Redis:** Upstash, Redis Cloud
- **Monitoring:** Sentry, LogRocket

---

## 📚 **Documentação Adicional**

- **[Migração Prisma](./MIGRACAO_PRISMA.md)** - Detalhes da migração Supabase → Prisma
- **[Guia do Usuário](./GUIA_USUARIO.md)** - Como usar o sistema
- **[API Reference](./API_DOCS.md)** - Documentação completa das APIs

---

## 🤝 **Contribuição**

### **📋 Guidelines**
1. **TypeScript First:** Todo código deve ser tipado
2. **Prisma Services:** Use services para lógica de negócio  
3. **Error Handling:** Sempre tratar erros adequadamente
4. **Testing:** Escrever testes para funcionalidades críticas

### **🔧 Setup para Contribuição**
```bash
git clone <repo>
npm install
npm run db:generate
npm run dev
```

---

**🎯 Projeto migrado com sucesso para arquitetura Prisma - mais rápido, seguro e manutenível!**
