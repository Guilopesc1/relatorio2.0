'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { 
  BarChart3, 
  Users, 
  FileText, 
  MessageSquare, 
  TrendingUp,
  Activity,
  CheckCircle,
  AlertCircle,
  Crown,
  Zap,
  Shield,
  Star
} from 'lucide-react'

interface UserStats {
  user: {
    id: string
    name: string
    email: string
    profile: string
    createdAt: string
  }
  connections: Array<{
    id: string
    platform: string
    account_name: string
    is_active: boolean
  }>
  reports: Array<{
    id: string
    name: string
    is_active: boolean
    last_run: string | null
  }>
  limits: {
    connectionsPerPlatform: number
    totalReports: number
    whatsappNumbers: number
    advancedFeatures: boolean
    priority: string
  }
  usage: {
    connections: number
    reports: number
    connectionsPercentage: number
    reportsPercentage: number
  }
  recentActivities: Array<{
    id: number
    type: string
    message: string
    time: string
    icon: string
    color: string
  }>
}

export default function DashboardHome() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (session?.user?.id) {
      fetchUserStats()
    }
  }, [session])

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProfileIcon = (profile: string) => {
    switch (profile) {
      case 'FREE': return <Users className="h-5 w-5" />
      case 'BASIC': return <Star className="h-5 w-5" />
      case 'PRO': return <Zap className="h-5 w-5" />
      case 'ENTERPRISE': return <Crown className="h-5 w-5" />
      default: return <Shield className="h-5 w-5" />
    }
  }

  const getProfileColor = (profile: string) => {
    switch (profile) {
      case 'FREE': return 'bg-gray-500'
      case 'BASIC': return 'bg-blue-500'  
      case 'PRO': return 'bg-purple-500'
      case 'ENTERPRISE': return 'bg-yellow-500'
      default: return 'bg-gray-500'
    }
  }

  const getIconComponent = (iconName: string) => {
    switch (iconName) {
      case 'CheckCircle': return CheckCircle
      case 'AlertCircle': return AlertCircle
      default: return Activity
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Erro ao carregar dados do usuário</p>
      </div>
    )
  }

  const statsCards = [
    {
      name: 'Conexões Ativas',
      value: stats.usage.connections,
      max: stats.limits.connectionsPerPlatform * 3,
      icon: Users,
      color: 'bg-blue-500',
      percentage: stats.usage.connectionsPercentage
    },
    {
      name: 'Relatórios Criados',
      value: stats.usage.reports,
      max: stats.limits.totalReports,
      icon: FileText,
      color: 'bg-green-500',
      percentage: stats.usage.reportsPercentage
    },
    {
      name: 'WhatsApp Configurado',
      value: 0,
      max: stats.limits.whatsappNumbers,
      icon: MessageSquare,
      color: 'bg-purple-500',
      percentage: 0
    },
    {
      name: 'Taxa de Sucesso',
      value: '100%',
      max: null,
      icon: TrendingUp,
      color: 'bg-yellow-500',
      percentage: 100
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Section com Perfil */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-lg shadow-lg">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="bg-white/20 p-3 rounded-xl">
                <BarChart3 className="h-8 w-8 text-white" />
              </div>
              <div className="ml-4">
                <h1 className="text-2xl font-bold text-white">
                  Olá, {stats.user.name?.split(' ')[0]}!
                </h1>
                <p className="text-primary-100 mt-1">
                  Gerencie seus relatórios de anúncios de forma automatizada
                </p>
              </div>
            </div>
            
            {/* Badge do Perfil */}
            <div className="flex items-center bg-white/20 rounded-lg px-3 py-2">
              <div className={`${getProfileColor(stats.user.profile)} p-2 rounded-lg mr-3`}>
                {getProfileIcon(stats.user.profile)}
              </div>
              <div className="text-white">
                <p className="text-sm font-medium">Plano {stats.user.profile}</p>
                <p className="text-xs text-primary-100">
                  {stats.limits.connectionsPerPlatform}x conexões por plataforma
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statsCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} p-3 rounded-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {typeof stat.value === 'number' ? `${stat.value}${stat.max ? `/${stat.max}` : ''}` : stat.value}
                      </div>
                      {stat.max && (
                        <div className="ml-2 text-sm text-gray-600">
                          ({stat.percentage}%)
                        </div>
                      )}
                    </dd>
                  </dl>
                </div>
              </div>
              
              {/* Barra de progresso */}
              {stat.max && (
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${stat.color}`}
                    style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                  ></div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Quick Actions Card */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Ações Rápidas
          </h3>
          <div className="space-y-3">
            <a href="/dashboard/connections" className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors block">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Conectar API</p>
                  <p className="text-sm text-gray-500">
                    {stats.usage.connections}/{stats.limits.connectionsPerPlatform * 3} conexões usadas
                  </p>
                </div>
              </div>
            </a>
            <a href="/dashboard/facebook" className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors block">
              <div className="flex items-center">
                <BarChart3 className="h-5 w-5 text-blue-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Facebook Dashboard</p>
                  <p className="text-sm text-gray-500">
                    Visualizar dados do Facebook Ads
                  </p>
                </div>
              </div>
            </a>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Criar Relatório</p>
                  <p className="text-sm text-gray-500">
                    {stats.usage.reports}/{stats.limits.totalReports} relatórios criados
                  </p>
                </div>
              </div>
            </button>
            <button className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center">
                <MessageSquare className="h-5 w-5 text-purple-600 mr-3" />
                <div>
                  <p className="font-medium text-gray-900">Configurar WhatsApp</p>
                  <p className="text-sm text-gray-500">0/{stats.limits.whatsappNumbers} números configurados</p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Atividade Recente
          </h3>
          <div className="space-y-4">
            {stats.recentActivities.map((activity) => {
              const Icon = getIconComponent(activity.icon)
              return (
                <div key={activity.id} className="flex items-start">
                  <div className={activity.color}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.message}
                    </p>
                    <p className="text-sm text-gray-500">
                      {activity.time}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Upgrade Section para usuários FREE */}
      {stats.user.profile === 'FREE' && (
        <div className="card bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-gray-900">
                Upgrade para PRO
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Desbloqueie mais conexões, relatórios ilimitados e recursos avançados
              </p>
            </div>
            <button className="btn-primary">
              Fazer Upgrade
            </button>
          </div>
        </div>
      )}

      {/* Getting Started Guide */}
      <div className="card">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Primeiros Passos
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="text-center">
            <div className={`${stats.usage.connections > 0 ? 'bg-green-100' : 'bg-blue-100'} rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3`}>
              <span className={`${stats.usage.connections > 0 ? 'text-green-600' : 'text-blue-600'} font-semibold`}>
                {stats.usage.connections > 0 ? '✓' : '1'}
              </span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Conecte suas APIs</h4>
            <p className="text-sm text-gray-500">
              {stats.usage.connections > 0 
                ? `${stats.usage.connections} conexão(ões) ativa(s)`
                : 'Conecte Facebook, Google e TikTok Ads'
              }
            </p>
          </div>
          <div className="text-center">
            <div className={`${stats.usage.reports > 0 ? 'bg-green-100' : 'bg-blue-100'} rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3`}>
              <span className={`${stats.usage.reports > 0 ? 'text-green-600' : 'text-blue-600'} font-semibold`}>
                {stats.usage.reports > 0 ? '✓' : '2'}
              </span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Crie um Relatório</h4>
            <p className="text-sm text-gray-500">
              {stats.usage.reports > 0 
                ? `${stats.usage.reports} relatório(s) criado(s)`
                : 'Configure métricas e layout'
              }
            </p>
          </div>
          <div className="text-center">
            <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-600 font-semibold">3</span>
            </div>
            <h4 className="font-medium text-gray-900 mb-2">Automatize Envios</h4>
            <p className="text-sm text-gray-500">
              Configure WhatsApp para receber relatórios
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}