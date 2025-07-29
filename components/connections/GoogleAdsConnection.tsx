'use client'

import { useState, useEffect } from 'react'
import { Chrome, ExternalLink, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'

interface GoogleAdsConnectionProps {
  onSuccess?: () => void
}

export default function GoogleAdsConnection({ onSuccess }: GoogleAdsConnectionProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'checking' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string>('')
  const [tokenKey, setTokenKey] = useState<string>('')

  useEffect(() => {
    // Verificar se voltou do OAuth com sucesso
    const urlParams = new URLSearchParams(window.location.search)
    const googleAuth = urlParams.get('google_auth')
    const tokenReady = urlParams.get('token_ready')
    const newTokenKey = urlParams.get('token_key')
    const authError = urlParams.get('error')
    const errorDetails = urlParams.get('details')

    if (authError) {
      console.error('OAuth error:', authError, errorDetails)
      setError(`Erro na autenticação: ${authError}${errorDetails ? ` - ${errorDetails}` : ''}`)
      setStatus('error')
      return
    }

    if (googleAuth === 'success' && tokenReady === 'true' && newTokenKey) {
      console.log('OAuth success detected, token key:', newTokenKey)
      setTokenKey(newTokenKey)
      setStatus('checking')
      
      // Limpar parâmetros da URL
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      
      // Verificar tokens e buscar contas
      handleTokensReceived(newTokenKey)
    }
  }, [])

  const handleTokensReceived = async (key: string) => {
    try {
      console.log('Retrieving tokens with key:', key)
      
      // Buscar tokens do cache do servidor
      const tokensResponse = await fetch('/api/integrations/google/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tokenKey: key })
      })

      const tokensData = await tokensResponse.json()

      if (!tokensData.success) {
        throw new Error(tokensData.error || 'Falha ao recuperar tokens')
      }

      console.log('Tokens retrieved successfully')
      
      // Agora buscar contas do Google Ads
      await fetchGoogleAdsAccounts(tokensData.data.access_token, tokensData.data.refresh_token)
      
    } catch (error) {
      console.error('Error handling tokens:', error)
      setError(error instanceof Error ? error.message : 'Erro ao processar tokens')
      setStatus('error')
    }
  }

  const fetchGoogleAdsAccounts = async (accessToken: string, refreshToken: string) => {
    try {
      console.log('Fetching Google Ads accounts...')
      
      const response = await fetch('/api/integrations/google/accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken })
      })

      const data = await response.json()

      if (data.success) {
        console.log('Google Ads accounts fetched successfully:', data.data)
        setStatus('success')
        
        // Se só tem uma conta, conectar automaticamente
        if (data.data.accounts.length === 1) {
          await connectAccount(accessToken, refreshToken, data.data.accounts[0].id)
        } else if (data.data.accounts.length > 1) {
          // TODO: Implementar modal de seleção de conta
          console.log('Multiple accounts found, need selection modal')
          setError('Múltiplas contas encontradas. Seleção de conta será implementada em breve.')
          setStatus('error')
        } else {
          setError('Nenhuma conta do Google Ads encontrada')
          setStatus('error')
        }
      } else {
        throw new Error(data.error || 'Falha ao buscar contas do Google Ads')
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setError(error instanceof Error ? error.message : 'Erro ao buscar contas')
      setStatus('error')
    }
  }

  const connectAccount = async (accessToken: string, refreshToken: string, customerId: string) => {
    try {
      console.log('Connecting Google Ads account:', customerId)
      
      const response = await fetch('/api/integrations/google/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accessToken,
          refreshToken,
          customerId
        })
      })

      const data = await response.json()

      if (data.success) {
        console.log('Google Ads account connected successfully')
        setStatus('success')
        if (onSuccess) {
          onSuccess()
        }
      } else {
        throw new Error(data.error || 'Falha ao conectar conta')
      }
    } catch (error) {
      console.error('Error connecting account:', error)
      setError(error instanceof Error ? error.message : 'Erro ao conectar conta')
      setStatus('error')
    }
  }

  const startGoogleAuth = async () => {
    try {
      setStatus('connecting')
      setError('')
      
      console.log('Starting Google OAuth flow...')
      
      // Redirecionar para iniciar OAuth
      window.location.href = '/api/auth/google'
      
    } catch (error) {
      console.error('Error starting Google auth:', error)
      setError(error instanceof Error ? error.message : 'Erro ao iniciar autenticação')
      setStatus('error')
    }
  }

  const retry = () => {
    setStatus('idle')
    setError('')
    setTokenKey('')
  }

  return (
    <div className="border border-gray-200 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-4">
        <div className="bg-red-500 p-2 rounded-lg">
          <Chrome className="h-6 w-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Google Ads</h3>
          <p className="text-sm text-gray-500">
            Conecte sua conta do Google Ads para importar dados de campanhas
          </p>
        </div>
      </div>

      {status === 'idle' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="text-blue-800 font-medium mb-1">Sobre a conexão com Google Ads:</p>
                <ul className="text-blue-700 space-y-1">
                  <li>• Você será redirecionado para autorizar o acesso</li>
                  <li>• Apenas dados de campanhas serão acessados</li>
                  <li>• Você pode revogar o acesso a qualquer momento</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={startGoogleAuth}
            className="w-full flex items-center justify-center space-x-2 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Chrome className="h-5 w-5" />
            <span>Conectar com Google Ads</span>
            <ExternalLink className="h-4 w-4" />
          </button>
        </div>
      )}

      {status === 'connecting' && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-red-500 mb-3" />
          <p className="text-gray-700 font-medium">Redirecionando para Google...</p>
          <p className="text-sm text-gray-500">Você será redirecionado para autorizar o acesso</p>
        </div>
      )}

      {status === 'checking' && (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-3" />
          <p className="text-gray-700 font-medium">Processando autenticação...</p>
          <p className="text-sm text-gray-500">Verificando tokens e buscando contas</p>
        </div>
      )}

      {status === 'success' && (
        <div className="text-center py-8">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-gray-900 font-medium">Conectado com sucesso!</p>
          <p className="text-sm text-gray-500">Sua conta do Google Ads foi conectada</p>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-red-800 font-medium">Erro na conexão</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={retry}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Tentar Novamente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
