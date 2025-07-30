@echo off
cd /d "C:\Users\Gui\MCP_Servers\Relatorio_Otimizado"

REM Adicionar Node.js ao PATH temporariamente
set PATH=%PATH%;C:\Program Files\nodejs

echo Verificando Node.js...
node --version
npm --version

echo Limpando cache...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

echo Instalando dependencias...
npm install

echo Gerando cliente Prisma...
npx prisma generate

echo Executando aplicacao...
npm run dev

pause
