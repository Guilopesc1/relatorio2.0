// Teste de configuração do Prisma
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('🔍 Testando configuração do Prisma...');
    
    // Verificar variáveis de ambiente
    const databaseUrl = process.env.DATABASE_URL;
    console.log('DATABASE_URL:', databaseUrl);
    
    if (!databaseUrl) {
      return NextResponse.json({
        success: false,
        error: 'DATABASE_URL não encontrada',
        env: {
          NODE_ENV: process.env.NODE_ENV,
          hasEnvFile: 'Verificar se .env existe'
        }
      });
    }

    if (!databaseUrl.startsWith('file:')) {
      return NextResponse.json({
        success: false,
        error: 'DATABASE_URL deve começar com "file:"',
        current: databaseUrl,
        expected: 'file:./dev.db'
      });
    }

    // Testar import do Prisma
    const { prisma } = await import('@/lib/prisma');
    console.log('✅ Prisma importado com sucesso');

    // Teste básico de conexão
    await prisma.$connect();
    console.log('✅ Conexão SQLite estabelecida');

    await prisma.$disconnect();
    
    return NextResponse.json({
      success: true,
      message: 'Configuração Prisma SQLite OK!',
      config: {
        databaseUrl,
        provider: 'sqlite',
        location: './dev.db'
      }
    });
    
  } catch (error) {
    console.error('❌ Erro na configuração:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro na configuração do Prisma',
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      troubleshooting: [
        'Execute: npm run db:generate',
        'Execute: npm run db:push',
        'Verifique se DATABASE_URL="file:./dev.db"'
      ]
    }, { status: 500 });
  }
}
