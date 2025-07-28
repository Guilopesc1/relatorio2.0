'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Check, 
  Facebook, 
  ArrowLeft,
  AlertTriangle,
  Loader2
} from 'lucide-react';

interface FacebookAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  business_name?: string;
}

interface ConnectionLimits {
  current: number;
  max: number;
  profile: string;
  remaining: number;
}

export default function FacebookSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [limits, setLimits] = useState<ConnectionLimits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token de acesso não encontrado');
      setLoading(false);
      return;
    }

    fetchAccountsAndLimits();
  }, [token]);

  const fetchAccountsAndLimits = async () => {
    try {
      console.log('=== Fetching Facebook Accounts START ===');
      
      // Decodificar o token (volta para base64 temporariamente)
      const tokenData = JSON.parse(Buffer.from(token!, 'base64').toString());
      const { accessToken } = tokenData;
      
      console.log('Token decoded successfully:', { hasAccessToken: !!accessToken });

      // Buscar contas do Facebook e limites do usuário em paralelo
      console.log('Making parallel requests...');
      
      const [accountsResponse, limitsResponse] = await Promise.all([
        fetch(`/api/integrations/facebook/accounts?accessToken=${encodeURIComponent(accessToken)}`),
        fetch('/api/connections')
      ]);

      console.log('Responses received:', {
        accountsStatus: accountsResponse.status,
        limitsStatus: limitsResponse.status
      });

      if (!accountsResponse.ok) {
        const errorText = await accountsResponse.text();
        console.error('Accounts API error:', errorText);
        throw new Error('Falha ao buscar contas do Facebook');
      }

      if (!limitsResponse.ok) {
        const errorText = await limitsResponse.text();
        console.error('Limits API error:', errorText);
        throw new Error('Falha ao buscar limites do usuário');
      }

      const accountsData = await accountsResponse.json();
      const limitsData = await limitsResponse.json();
      
      console.log('Data parsed:', {
        accountsSuccess: accountsData.success,
        limitsSuccess: limitsData.success,
        accountsCount: accountsData.data?.length || 0
      });

      if (!accountsData.success) {
        throw new Error(accountsData.error || 'Erro ao buscar contas');
      }

      if (!limitsData.success) {
        throw new Error(limitsData.error || 'Erro ao buscar limites');
      }

      setAccounts(accountsData.data);
      setLimits(limitsData.data.limits);

      // Filtrar contas já conectadas
      const connectedAccountIds = limitsData.data.connections
        .filter((conn: any) => conn.platform === 'FACEBOOK')
        .map((conn: any) => conn.accountId);

      const availableAccounts = accountsData.data.filter(
        (account: FacebookAccount) => !connectedAccountIds.includes(account.id)
      );

      setAccounts(availableAccounts);
      
      console.log('=== Fetching Facebook Accounts SUCCESS ===');

    } catch (error) {
      console.error('=== Fetching Facebook Accounts ERROR ===');
      console.error('Error details:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountToggle = (accountId: string) => {
    if (!limits) return;

    const isSelected = selectedAccounts.includes(accountId);
    
    if (isSelected) {
      setSelectedAccounts(prev => prev.filter(id => id !== accountId));
    } else {
      // Verificar se pode adicionar mais
      const totalSelected = selectedAccounts.length + 1;
      if (totalSelected > limits.remaining) {
        alert(`Você pode conectar no máximo ${limits.remaining} contas adicionais com seu plano ${limits.profile}`);
        return;
      }
      setSelectedAccounts(prev => [...prev, accountId]);
    }
  };

  const handleConnectAccounts = async () => {
    if (selectedAccounts.length === 0) {
      alert('Selecione pelo menos uma conta para conectar');
      return;
    }

    setConnecting(true);

    try {
      console.log('=== Connecting Accounts START ===');
      
      // Decodificar o token
      const tokenData = JSON.parse(Buffer.from(token!, 'base64').toString());
      const { accessToken } = tokenData;

      console.log('Connecting accounts:', { count: selectedAccounts.length });

      // Conectar cada conta selecionada
      const promises = selectedAccounts.map(accountId =>
        fetch('/api/integrations/facebook/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            accessToken,
            accountId
          }),
        })
      );

      const results = await Promise.all(promises);
      const responses = await Promise.all(
        results.map(result => result.json())
      );

      console.log('Connection results:', {
        total: responses.length,
        successful: responses.filter(r => r.success).length,
        failed: responses.filter(r => !r.success).length
      });

      // Verificar resultados
      const successful = responses.filter(response => response.success);
      const failed = responses.filter(response => !response.success);

      if (successful.length > 0) {
        const message = `${successful.length} conta(s) conectada(s) com sucesso!`;
        console.log('=== Connecting Accounts SUCCESS ===');
        router.push(`/dashboard/connections?success=${encodeURIComponent(message)}`);
      } else {
        console.error('All connections failed:', failed);
        setError(`Falha ao conectar contas: ${failed[0]?.error || 'Erro desconhecido'}`);
      }

    } catch (error) {
      console.error('=== Connecting Accounts ERROR ===');
      console.error('Error details:', error);
      setError('Erro ao conectar contas');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando suas contas do Facebook...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Erro</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/dashboard/connections')}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Voltar para Conexões
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard/connections')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Conexões
          </button>
          
          <div className="flex items-center mb-2">
            <Facebook className="h-6 w-6 text-blue-600 mr-3" />
            <h1 className="text-2xl font-bold text-gray-900">
              Selecionar Contas do Facebook
            </h1>
          </div>
          <p className="text-gray-600">
            Escolha quais contas de anúncios você deseja conectar
          </p>
        </div>

        {/* Limites do Plano */}
        {limits && (
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-blue-900">
                  Plano {limits.profile}
                </h3>
                <p className="text-sm text-blue-700">
                  {limits.current} de {limits.max} conexões utilizadas
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-900">
                  {limits.remaining} disponíveis
                </p>
                <p className="text-xs text-blue-600">
                  para novas conexões
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Contas */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Contas Disponíveis ({accounts.length})
            </h2>
            {selectedAccounts.length > 0 && (
              <p className="text-sm text-gray-600 mt-1">
                {selectedAccounts.length} conta(s) selecionada(s)
              </p>
            )}
          </div>

          {accounts.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Nenhuma conta disponível
              </h3>
              <p className="text-gray-600">
                Não encontramos contas de anúncios disponíveis para conectar.
                Verifique se você tem acesso às contas no Facebook Business Manager.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {accounts.map((account) => {
                const isSelected = selectedAccounts.includes(account.id);
                
                return (
                  <div
                    key={account.id}
                    className={`px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleAccountToggle(account.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">
                              {account.name}
                            </h4>
                            <div className="text-sm text-gray-500 space-y-1">
                              <p>ID: {account.id}</p>
                              {account.business_name && (
                                <p>Empresa: {account.business_name}</p>
                              )}
                              <p>Moeda: {account.currency}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="ml-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          account.account_status === 1 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {account.account_status === 1 ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Botões de Ação */}
          {accounts.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between">
                <button
                  onClick={() => router.push('/dashboard/connections')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancelar
                </button>
                
                <button
                  onClick={handleConnectAccounts}
                  disabled={selectedAccounts.length === 0 || connecting}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Conectando...
                    </>
                  ) : (
                    `Conectar ${selectedAccounts.length} conta(s)`
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
