import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../auth/[...nextauth]/route'
import { supabase } from '@/lib/supabase'

// Definição dos limites por perfil
const PROFILE_LIMITS = {
  FREE: {
    connectionsPerPlatform: 1,
    totalReports: 3,
    whatsappNumbers: 1,
    advancedFeatures: false,
    priority: 'low'
  },
  BASIC: {
    connectionsPerPlatform: 3,
    totalReports: 10,
    whatsappNumbers: 3,
    advancedFeatures: false,
    priority: 'normal'
  },
  PRO: {
    connectionsPerPlatform: 10,
    totalReports: 50,
    whatsappNumbers: 10,
    advancedFeatures: true,
    priority: 'high'
  },
  ENTERPRISE: {
    connectionsPerPlatform: 999,
    totalReports: 999,
    whatsappNumbers: 999,
    advancedFeatures: true,
    priority: 'critical'
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Buscar dados do usuário
    const { data: user, error: userError } = await supabase
      .from('app_users')
      .select('id, name, email, profile, created_at')
      .eq('id', session.user.id)
      .single()

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar conexões (usando tabela existente como referência)
    const { data: connections, error: connectionsError } = await supabase
      .from('api_connections')
      .select('id, platform, account_name, is_active, created_at')
      .eq('user_id', user.id)

    // Buscar relatórios (usando tabela existente como referência)  
    const { data: reports, error: reportsError } = await supabase
      .from('app_reports')
      .select('id, name, is_active, last_run, created_at')
      .eq('user_id', user.id)

    // Se as tabelas não existirem ainda, usar dados mockados
    const connectionsData = connectionsError ? [] : (connections || [])
    const reportsData = reportsError ? [] : (reports || [])

    // Obter limites do perfil
    const limits = PROFILE_LIMITS[user.profile as keyof typeof PROFILE_LIMITS] || PROFILE_LIMITS.FREE

    // Calcular estatísticas de uso
    const activeConnections = connectionsData.filter(c => c.is_active).length
    const activeReports = reportsData.filter(r => r.is_active).length
    const maxConnections = limits.connectionsPerPlatform * 3 // 3 plataformas
    
    const usage = {
      connections: activeConnections,
      reports: activeReports,
      connectionsPercentage: Math.round((activeConnections / maxConnections) * 100),
      reportsPercentage: Math.round((activeReports / limits.totalReports) * 100)
    }

    // Atividades recentes (simuladas por enquanto)
    const recentActivities = [
      {
        id: 1,
        type: 'info',
        message: `Bem-vindo ao sistema, ${user.name?.split(' ')[0]}!`,
        time: 'Agora',
        icon: 'CheckCircle',
        color: 'text-blue-600'
      },
      {
        id: 2,
        type: 'warning', 
        message: 'Configure suas primeiras conexões de API',
        time: 'Pendente',
        icon: 'AlertCircle',
        color: 'text-yellow-600'
      }
    ]

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        createdAt: user.created_at
      },
      connections: connectionsData,
      reports: reportsData,
      limits,
      usage,
      recentActivities
    })

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}