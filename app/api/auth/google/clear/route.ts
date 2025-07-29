import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../[...nextauth]/route';
import { SupabaseConnectionService } from '@/lib/services/supabase-connection-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🧹 LIMPEZA COMPLETA DO GOOGLE OAUTH');
    console.log('User ID:', session.user.id);
    console.log('User Email:', session.user.email);
    
    // 1. Remover todas as conexões Google do usuário
    const connections = await SupabaseConnectionService.getConnections(session.user.id, 'GOOGLE');
    
    console.log(`🗑️ Removendo ${connections.length} conexão(ões) Google existentes...`);
    
    for (const connection of connections) {
      await SupabaseConnectionService.deleteConnection(session.user.id, connection.id);
      console.log(`✅ Conexão removida: ${connection.accountId} - ${connection.accountName}`);
    }
    
    console.log('🎯 Limpeza concluída! Usuário deve fazer nova autenticação.');
    
    return NextResponse.json({
      success: true,
      message: 'Limpeza completa realizada com sucesso',
      details: {
        removed_connections: connections.length,
        user_id: session.user.id,
        user_email: session.user.email
      },
      next_steps: [
        '1. Fazer logout da aplicação',
        '2. Fazer login novamente',
        '3. Reconectar Google Ads com nova autenticação',
        '4. Verificar se as contas mostradas são corretas'
      ]
    });

  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    
    return NextResponse.json({
      error: 'Falha na limpeza',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
