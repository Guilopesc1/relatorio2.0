import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/config'
import { PrismaUserService } from '@/lib/services/prisma-user-service'
import { PrismaConnectionService } from '@/lib/services/prisma-connection-service'
import { prisma } from '@/lib/prisma'

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

    // Buscar dados completos do usuário usando PrismaUserService
    const userStats = await PrismaUserService.getUserStats(session.user.id)

    if (!userStats) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Buscar conexões do usuário
    const connections = await PrismaConnectionService.getConnections(session.user.id)
    
    // Buscar relatórios do usuário
    const reports = await prisma.report.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastRun: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Obter limites do perfil
    const limits = PROFILE_LIMITS[userStats.user.profile] || PROFILE_LIMITS.FREE

    // Calcular estatísticas de uso
    const activeConnections = connections.filter(c => c.isActive).length
    const activeReports = reports.filter(r => r.isActive).length
    const maxConnections = limits.connectionsPerPlatform * 3 // 3 plataformas (Facebook, Google, TikTok)
    
    const usage = {
      connections: activeConnections,
      reports: activeReports,
      connectionsPercentage: maxConnections > 0 ? Math.round((activeConnections / maxConnections) * 100) : 0,
      reportsPercentage: Math.round((activeReports / limits.totalReports) * 100)
    }

    // Atividades recentes baseadas nos dados reais
    const recentActivities = []

    // Adicionar atividade de boas-vindas
    recentActivities.push({
      id: 1,
      type: 'info',
      message: `Bem-vindo ao sistema, ${userStats.user.name?.split(' ')[0] || 'Usuário'}!`,
      time: 'Agora',
      icon: 'CheckCircle',
      color: 'text-blue-600'
    })

    // Verificar se há conexões
    if (activeConnections === 0) {
      recentActivities.push({
        id: 2,
        type: 'warning',
        message: 'Configure suas primeiras conexões de API',
        time: 'Pendente',
        icon: 'AlertCircle',
        color: 'text-yellow-600'
      })
    } else {
      recentActivities.push({
        id: 2,
        type: 'success',
        message: `${activeConnections} conexão${activeConnections > 1 ? 'ões' : ''} ativa${activeConnections > 1 ? 's' : ''}`,
        time: 'Ativo',
        icon: 'CheckCircle',
        color: 'text-green-600'
      })
    }

    // Verificar se há relatórios
    if (activeReports === 0) {
      recentActivities.push({
        id: 3,
        type: 'info',
        message: 'Crie seu primeiro relatório automatizado',
        time: 'Pendente',
        icon: 'BarChart3',
        color: 'text-blue-600'
      })
    }

    // Verificar se está próximo do limite
    if (usage.connectionsPercentage > 80) {
      recentActivities.push({
        id: 4,
        type: 'warning',
        message: `Você está usando ${usage.connectionsPercentage}% do limite de conexões`,
        time: 'Agora',
        icon: 'AlertTriangle',
        color: 'text-orange-600'
      })
    }

    return NextResponse.json({
      user: userStats.user,
      connections: connections.map(conn => ({
        id: conn.id,
        platform: conn.platform,
        accountName: conn.accountName,
        isActive: conn.isActive,
        createdAt: conn.createdAt
      })),
      reports: reports,
      limits,
      usage,
      stats: userStats.stats,
      recentActivities: recentActivities.slice(0, 5) // Limitar a 5 atividades
    })

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
