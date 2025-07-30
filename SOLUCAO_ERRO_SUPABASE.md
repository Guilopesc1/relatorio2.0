# 🔧 SOLUÇÃO PARA ERRO "Module not found: Can't resolve '@/lib/supabase'"

## 🚨 **PROBLEMA IDENTIFICADO**

O erro está acontecendo porque:
1. Ainda há referências ao `@/lib/supabase` em algum arquivo
2. O cache do Next.js não foi limpo adequadamente
3. As dependências precisam ser reinstaladas

## ✅ **SOLUÇÃO PASSO A PASSO**

### **1. Limpar Completamente o Projeto**
```bash
# Windows (PowerShell)
Remove-Item -Recurse -Force node_modules, .next, package-lock.json -ErrorAction SilentlyContinue

# Linux/Mac
rm -rf node_modules .next package-lock.json
```

### **2. Reinstalar Dependências**
```bash
npm install
```

### **3. Gerar Cliente Prisma**
```bash
npm run db:generate
```

### **4. Aplicar Schema no Banco**
```bash
npm run db:push
```

### **5. Iniciar Aplicação**
```bash
npm run dev
```

## 🔍 **VERIFICAÇÃO ADICIONAL**

Se o erro persistir, execute a busca manual:

### **Windows:**
```powershell
# Buscar qualquer referência ao supabase
Get-ChildItem -Recurse -Include "*.ts","*.tsx","*.js","*.jsx" | 
  Where-Object { $_.FullName -notmatch "node_modules|\.backup|\.next" } | 
  Select-String -Pattern "supabase|@/lib/supabase"
```

### **Linux/Mac:**
```bash
# Buscar qualquer referência ao supabase
find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" | \
  grep -v -E "node_modules|\.backup|\.next" | \
  xargs grep -n "supabase\|@/lib/supabase" 2>/dev/null
```

## 🚀 **SCRIPT AUTOMÁTICO**

Execute o arquivo `fix-dependencies.bat` criado:

```bash
# Windows
.\fix-dependencies.bat

# Ou manualmente:
rm -rf node_modules .next package-lock.json
npm install
npm run db:generate
npm run db:push
npm run dev
```

## 📋 **CHECKLIST DE VERIFICAÇÃO**

Após executar os passos acima, verifique:

- [ ] `node_modules` foi removido e recriado
- [ ] `.next` foi removido (cache limpo)
- [ ] `package-lock.json` foi regenerado
- [ ] `npm run db:generate` executou sem erros
- [ ] `npm run db:push` conectou no banco
- [ ] `npm run dev` inicia sem erros

## 🎯 **POSSÍVEIS CAUSAS ADICIONAIS**

Se ainda assim o erro persistir:

### **1. Verificar Imports Dinâmicos**
Pode haver imports dinâmicos escondidos:
```typescript
// Procurar por:
const { supabase } = await import('@/lib/supabase')
require('@/lib/supabase')
```

### **2. Verificar Arquivos de Configuração**
```typescript
// Verificar arquivos:
- next.config.js
- middleware.ts
- instrumentation.ts
```

### **3. Verificar Cache do Editor**
Se usando VS Code:
```bash
# Recarregar window
Ctrl+Shift+P -> "Developer: Reload Window"

# Ou reiniciar TypeScript server
Ctrl+Shift+P -> "TypeScript: Restart TS Server"
```

## 🔧 **SOLUÇÃO DEFINITIVA**

Se nada funcionar, execute este comando completo:

```bash
# Limpar tudo
rm -rf node_modules .next package-lock.json

# Verificar se package.json não tem @supabase/supabase-js
grep -v "@supabase/supabase-js" package.json > temp && mv temp package.json

# Reinstalar
npm install
npm run db:generate
npm run db:push

# Testar
npm run dev
```

## ✅ **CONFIRMAÇÃO DE SUCESSO**

Quando funcionar, você verá:
```
✓ Ready in 2.3s
○ Local:        http://localhost:3000
○ Network:      http://192.168.x.x:3000
```

E poderá acessar:
- `http://localhost:3000` - Aplicação principal
- `http://localhost:3000/api/test` - Teste de conexão Prisma
- `http://localhost:3000/login` - Página de login

## 🎉 **MIGRAÇÃO CONFIRMADA**

Uma vez que a aplicação iniciar sem erros, a migração do Supabase SDK para Prisma está 100% concluída!
