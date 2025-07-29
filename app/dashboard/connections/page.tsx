'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Check, 
  AlertTriangle, 
  Facebook, 
  Chrome,
  Smartphone
} from 'lucide-react';
import DataTestPanel from '@/components/connections/DataTestPanel';
import GoogleConnectionModal from '@/components/connections/GoogleConnectionModal';

interface Connection {
  id: string;
  platform: 'FACEBOOK' | 'GOOGLE' | 'TIKTOK';
  accountId: string;
  accountName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionLimits {
  current: number;
  max: number;
  profile: string;
  remaining: number;
}

const platformIcons = {
  FACEBOOK: Facebook,
  GOOGLE: Chrome,
  TIKTOK: Smartphone
};

const platformColors = {
  FACEBOOK: 'bg-blue-500',
  GOOGLE: 'bg-red-500',
  TIKTOK: 'bg-black'
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [limits, setLimits] = useState<ConnectionLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleTokens, setGoogleTokens] = useState<{access_token: string, refresh_token: string} | null>(null);

  useEffect(() => {
    fetchConnections();
    
    // Verificar se houve mensagens na URL
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const googleAuth = urlParams.get('google_auth');
    const tokenReady = urlParams.get('token_ready');
    const state = urlParams.get('state');
    
    if (success) {
      alert(success);
      // Limpar a URL
      window.history.replaceState({}, '', '/dashboard/connections');
    }
    if (error) {
      alert(`Erro: ${error}`);
      // Limpar a URL
      window.history.replaceState({}, '', '/dashboard/connections');
    }
    if (googleAuth === 'success' && tokenReady === 'true' && state) {
      // OAuth do Google foi bem-sucedido, recuperar tokens do cache
      console.log('Google OAuth success detected, retrieving tokens from cache...');
      retrieveGoogleTokens(state);
      // Limpar a URL
      window.history.replaceState({}, '', '/dashboard/connections');
    }
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/connections');
      const data = await response.json();
      
      if (data.success) {
        setConnections(data.data.connections);
        setLimits(data.data.limits);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const retrieveGoogleTokens = async (state: string) => {
    try {
      console.log('Retrieving Google tokens from cache...');
      
      const response = await fetch('/api/integrations/google/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state })
      });

      const data = await response.json();
      
      if (data.success) {
        console.log('Tokens retrieved successfully from cache');
        setGoogleTokens({ 
          access_token: data.data.access_token, 
          refresh_token: data.data.refresh_token 
        });
        setShowGoogleModal(true);
      } else {
        console.error('Failed to retrieve tokens:', data.error);
        alert(`Erro ao recuperar tokens: ${data.error}`);
      }
    } catch (error) {
      console.error('Error retrieving Google tokens:', error);
      alert('Erro ao recuperar tokens do Google');
    }
  };

  const handleFacebookOAuth = async () => {
    setOauthLoading(true);
    try {
      const response = await fetch('/api/auth/facebook');
      const data = await response.json();
      
      if (data.success) {
        // Redirecionar para autorização do Facebook
        window.location.href = data.authUrl;
      } else {
        alert(data.error || 'Erro ao iniciar autorização do Facebook');
      }
    } catch (error) {
      console.error('Error starting Facebook OAuth:', error);
      alert('Erro ao conectar com o Facebook');
    } finally {
      setOauthLoading(false);
    }
  };

  const handleGoogleOAuth = async () => {
    setOauthLoading(true);
    console.log('Starting Google OAuth flow...');
    
    // REDIRECIONAR DIRETAMENTE para o endpoint OAuth
    window.location.href = '/api/integrations/google/oauth';
  };

  const handleGoogleConnectionComplete = () => {
    setShowGoogleModal(false);
    setGoogleTokens(null);
    fetchConnections();
  };

  const deleteConnection = async (connectionId: string) => {
    if (!confirm('Tem certeza que deseja remover esta conexão?')) {
      return;
    }

    try {
      const response = await fetch(`/api/connections?id=${connectionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        fetchConnections();
      } else {
        alert(data.error || 'Erro ao remover conexão');
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      alert('Erro ao remover conexão');
    }
  };

  const canAddConnection = limits && limits.remaining > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Conexões de APIs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Gerencie suas conexões com plataformas de anúncios
        </p>
      </div>

      {/* Limites do Plano */}
      {limits && (
        <div className="mb-6 bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">
                Plano {limits.profile}
              </h3>
              <p className="text-sm text-gray-500">
                {limits.current} de {limits.max} conexões utilizadas
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(limits.current / limits.max) * 100}%` }}
                ></div>
              </div>
              <span className="text-sm text-gray-600">
                {limits.remaining} restantes
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Botões Adicionar Conexão */}
      <div className="mb-6">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleFacebookOAuth}
            disabled={!canAddConnection || oauthLoading}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              canAddConnection && !oauthLoading
                ? 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <Facebook className="h-4 w-4 mr-2" />
            {oauthLoading ? 'Conectando...' : 'Conectar Facebook Ads'}
          </button>
          
          <button
            onClick={handleGoogleOAuth}
            disabled={!canAddConnection}
            className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              canAddConnection
                ? 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500' 
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <Chrome className="h-4 w-4 mr-2" />
            Conectar Google Ads
          </button>
        </div>
        {!canAddConnection && (
          <p className="mt-2 text-sm text-red-600">
            Limite de conexões atingido para seu plano atual
          </p>
        )}
      </div>

      {/* Lista de Conexões */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
            Conexões Ativas
          </h3>
          
          {connections.length === 0 ? (
            <div className="text-center py-8">
              <div className="mx-auto h-12 w-12 text-gray-400">
                <AlertTriangle className="h-12 w-12" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Nenhuma conexão configurada
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Conecte suas contas de anúncios para começar
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => {
                const Icon = platformIcons[connection.platform];
                const colorClass = platformColors[connection.platform];
                
                return (
                  <div key={connection.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`${colorClass} p-2 rounded-lg`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {connection.accountName}
                        </h4>
                        <p className="text-sm text-gray-500">
                          {connection.platform} • ID: {connection.accountId}
                        </p>
                        <p className="text-xs text-gray-400">
                          Conectado em {new Date(connection.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {connection.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <Check className="h-3 w-3 mr-1" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Inativo
                        </span>
                      )}
                      
                      <button
                        onClick={() => deleteConnection(connection.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover conexão"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Painel de Teste de Dados */}
      {connections.length > 0 && (
        <div className="mt-8">
          <DataTestPanel connections={connections} />
        </div>
      )}
      
      {/* Modal de Conexão Google */}
      {showGoogleModal && googleTokens && (
        <GoogleConnectionModal
          isOpen={showGoogleModal}
          onClose={() => setShowGoogleModal(false)}
          accessToken={googleTokens.access_token}
          refreshToken={googleTokens.refresh_token}
          onSuccess={handleGoogleConnectionComplete}
        />
      )}
    </div>
  );
}
