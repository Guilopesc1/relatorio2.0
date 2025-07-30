// Teste de conectividade do banco de dados
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Testando conexão com banco de dados...');
    
    // Teste básico de conectividade
    await prisma.$connect();
    console.log('✅ Conexão estabelecida!');
    
    // Teste de query simples
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Query simples executada:', result);
    
    // Verificar se as tabelas existem
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'app_%'
      ORDER BY table_name;
    `;
    
    console.log('📋 Tabelas encontradas:', tables);
    
    return NextResponse.json({
      success: true,
      message: 'Conexão com banco funcionando!',
      data: {
        connectionTest: result,
        tablesFound: tables
      }
    });
    
  } catch (error) {
    console.error('❌ Erro de conexão:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Falha na conexão com banco',  
      details: error instanceof Error ? error.message : 'Erro desconhecido',
      troubleshooting: {
        possibleCauses: [
          'URL do banco incorreta',
          'Credenciais expiradas', 
          'Schema não aplicado',
          'Servidor do banco indisponível'
        ],
        nextSteps: [
          'Verificar .env DATABASE_URL',
          'Executar: npm run db:push',
          'Verificar status do Supabase'
        ]
      }
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
