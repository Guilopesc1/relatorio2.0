'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DashboardLayout from '@/components/dashboard/DashboardLayout'
import { User, Crown, Shield, Activity, Bell } from 'lucide-react'

interface UserData {
  id: string
  name: string
  email: string
  profile: string
  createdAt: string
}

export default function Settings() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    email: ''
  })

  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/login')
      return
    }

    fetchUserData()
  }, [session, status, router])

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/user/stats')
      if (response.ok) {
        const data = await response.json()
        setUserData(data.user)
        setFormData({
          name: data.user.name,
          email: data.user.email
        })
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProfileInfo = (profile: string) => {
    switch (profile) {
      case 'FREE':
        return {
          name: 'Gratuito',
          icon: <Shield className="h-5 w-5" />,
          color: 'text-gray-600 bg-gray-100',
          features: ['1 conexão por plataforma', '3 relatórios', '1 número WhatsApp']
        }
      case 'BASIC':
        return {
          name: 'Básico',
          icon: <User className="h-5 w-5" />,
          color: 'text-blue-600 bg-blue-100',
          features: ['3 conexões por plataforma', '10 relatórios', '3 números WhatsApp']
        }
      case 'PRO':
        return {
          name: 'Profissional',
          icon: <Crown className="h-5 w-5" />,
          color: 'text-purple-600 bg-purple-100',
          features: ['10 conexões por plataforma', '50 relatórios', '10 números WhatsApp', 'Recursos avançados']
        }
      case 'ENTERPRISE':
        return {
          name: 'Empresarial',
          icon: <Crown className="h-5 w-5" />,
          color: 'text-yellow-600 bg-yellow-100',
          features: ['Conexões ilimitadas', 'Relatórios ilimitados', 'WhatsApp ilimitado', 'Suporte prioritário']
        }
      default:
        return {
          name: 'Desconhecido',
          icon: <Shield className="h-5 w-5" />,
          color: 'text-gray-600 bg-gray-100',
          features: []
        }
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!session || !userData) {
    return null
  }

  const profileInfo = getProfileInfo(userData.profile)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Configurações</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gerencie sua conta e preferências
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Informações da Conta */}
          <div className="lg:col-span-2">
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Informações da Conta
              </h3>
              
              <form className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Data de Cadastro
                  </label>
                  <p className="mt-1 text-sm text-gray-600">
                    {new Date(userData.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="btn-primary"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </div>

            {/* Preferências */}
            <div className="card mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Preferências
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Bell className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Notificações por Email</p>
                      <p className="text-sm text-gray-500">Receber alertas sobre relatórios</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
                    role="switch"
                    aria-checked="false"
                  >
                    <span
                      aria-hidden="true"
                      className="translate-x-0 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    ></span>
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Activity className="h-5 w-5 text-gray-400 mr-3" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Relatórios Automáticos</p>
                      <p className="text-sm text-gray-500">Enviar relatórios nos horários configurados</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-primary-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-600 focus:ring-offset-2"
                    role="switch"
                    aria-checked="true"
                  >
                    <span
                      aria-hidden="true"
                      className="translate-x-5 pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                    ></span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Informações do Plano */}
          <div>
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Plano Atual
              </h3>
              
              <div className="text-center mb-6">
                <div className={`inline-flex items-center px-3 py-2 rounded-lg ${profileInfo.color} mb-3`}>
                  {profileInfo.icon}
                  <span className="ml-2 font-medium">{profileInfo.name}</span>
                </div>
                
                <h4 className="text-2xl font-bold text-gray-900 mb-1">
                  Plano {userData.profile}
                </h4>
                <p className="text-sm text-gray-500">
                  Conta criada em {new Date(userData.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="space-y-3 mb-6">
                <h5 className="font-medium text-gray-900">Recursos inclusos:</h5>
                {profileInfo.features.map((feature, index) => (
                  <div key={index} className="flex items-center text-sm text-gray-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                    {feature}
                  </div>
                ))}
              </div>

              {userData.profile === 'FREE' && (
                <button className="w-full btn-primary">
                  Fazer Upgrade
                </button>
              )}
              
              {userData.profile !== 'FREE' && (
                <div className="text-center">
                  <p className="text-sm text-green-600 font-medium">
                    ✓ Plano Ativo
                  </p>
                </div>
              )}
            </div>

            {/* Estatísticas de Uso */}
            <div className="card mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Uso Atual
              </h3>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Conexões</span>
                    <span className="font-medium">0 / {userData.profile === 'ENTERPRISE' ? '∞' : profileInfo.features[0]?.split(' ')[0] || '0'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Relatórios</span>
                    <span className="font-medium">0 / {userData.profile === 'ENTERPRISE' ? '∞' : profileInfo.features[1]?.split(' ')[0] || '0'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">WhatsApp</span>
                    <span className="font-medium">0 / {userData.profile === 'ENTERPRISE' ? '∞' : profileInfo.features[2]?.split(' ')[0] || '0'}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-500 h-2 rounded-full" style={{ width: '0%' }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Zona de Perigo */}
            <div className="card mt-6 border-red-200 bg-red-50">
              <h3 className="text-lg font-medium text-red-900 mb-4">
                Zona de Perigo
              </h3>
              
              <div className="space-y-3">
                <button className="w-full px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-100 transition-colors text-sm">
                  Alterar Senha
                </button>
                
                <button className="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm">
                  Excluir Conta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}