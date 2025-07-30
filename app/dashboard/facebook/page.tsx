'use client';

import { useState, useEffect } from 'react';
import { 
  Facebook, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Users, 
  Eye, 
  MousePointer, 
  Target,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

interface FacebookAccount {
  id: string;
  name: string;
  account_id: string;
  is_active: boolean;
}

interface FacebookMetrics {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  conversions: number;
  conversion_rate: number;
  roas: number;
  frequency: number;
  reach: number;
  cost_per_conversion: number;
}

interface CampaignData {
  id: string;
  name: string;
  status: string;
  objective: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  roas: number;
  created_time: string;
}

export default function FacebookDashboard() {
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [metrics, setMetrics] = useState<FacebookMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('last_7_days');

  useEffect(() => {
    fetchFacebookAccounts();
  }, []);

  useEffect(() => {
    if (selectedAccount) {
      fetchAccountData();
    }
  }, [selectedAccount, dateRange]);

  const fetchFacebookAccounts = async () => {
    try {
      console.log('Fetching Facebook accounts...');
      const response = await fetch('/api/connections?platform=FACEBOOK');
      const data = await response.json();
      
      console.log('Facebook accounts response:', data);
      
      if (data.success) {
        const facebookConnections = data.data.connections || [];
        console.log('Facebook connections found:', facebookConnections.length);
        
        setAccounts(facebookConnections.map(conn => ({
          id: conn.id,
          name: conn.accountName,
          account_id: conn.accountId,
          is_active: conn.isActive
        })));
        
        if (facebookConnections.length > 0) {
          setSelectedAccount(facebookConnections[0].accountId);
          console.log('Selected account:', facebookConnections[0].accountId);
        }
      } else {
        console.error('Failed to fetch accounts:', data.error);
        setError('Erro ao carregar contas do Facebook: ' + data.error);
      }
    } catch (error) {
      console.error('Error fetching Facebook accounts:', error);
      setError('Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const fetchAccountData = async () => {
    if (!selectedAccount) return;
    
    setRefreshing(true);
    setError(null);
    
    console.log('Fetching data for account:', selectedAccount, 'dateRange:', dateRange);
    
    try {
      // Buscar métricas gerais
      console.log('Fetching metrics...');
      const metricsResponse = await fetch(`/api/facebook/metrics?account_id=${selectedAccount}&date_range=${dateRange}`);
      const metricsData = await metricsResponse.json();
      
      console.log('Metrics response:', metricsData);
      
      if (metricsData.success) {
        setMetrics(metricsData.data);
      } else {
        console.error('Metrics error:', metricsData.error);
        setError('Erro ao buscar métricas: ' + metricsData.error);
      }

      // Buscar campanhas
      console.log('Fetching campaigns...');
      const campaignsResponse = await fetch(`/api/facebook/campaigns?account_id=${selectedAccount}&date_range=${dateRange}`);
      const campaignsData = await campaignsResponse.json();
      
      console.log('Campaigns response:', campaignsData);
      
      if (campaignsData.success) {
        setCampaigns(campaignsData.data);
      } else {
        console.error('Campaigns error:', campaignsData.error);
        setError('Erro ao buscar campanhas: ' + campaignsData.error);
      }
      
    } catch (error) {
      console.error('Error fetching Facebook data:', error);
      setError('Erro ao buscar dados do Facebook: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    } finally {
      setRefreshing(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12">
        <Facebook className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">
          Nenhuma conta do Facebook conectada
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Conecte sua conta do Facebook Ads para visualizar dados
        </p>
        <div className="mt-6">
          <a
            href="/dashboard/connections"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Facebook className="h-4 w-4 mr-2" />
            Conectar Facebook Ads
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="bg-blue-500 p-3 rounded-lg mr-4">
              <Facebook className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Facebook Ads Dashboard</h1>
              <p className="text-sm text-gray-500">
                Acompanhe o desempenho das suas campanhas no Facebook
              </p>
            </div>
          </div>
          
          <button
            onClick={fetchAccountData}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4">
          {/* Account Selector */}
          <div className="flex-1 min-w-64">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Conta de Anúncios
            </label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.account_id}>
                  {account.name} ({account.account_id})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Selector */}
          <div className="flex-1 min-w-48">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período
            </label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Hoje</option>
              <option value="yesterday">Ontem</option>
              <option value="last_7_days">Últimos 7 dias</option>
              <option value="last_14_days">Últimos 14 dias</option>
              <option value="last_30_days">Últimos 30 dias</option>
              <option value="this_month">Este mês</option>
              <option value="last_month">Mês passado</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Gasto Total */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Gasto Total
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(metrics.spend)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Impressões */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Eye className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Impressões
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatNumber(metrics.impressions)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Cliques */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <MousePointer className="h-6 w-6 text-purple-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Cliques
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatNumber(metrics.clicks)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* CTR */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-orange-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      CTR
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatPercentage(metrics.ctr)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* CPC */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Target className="h-6 w-6 text-red-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      CPC
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(metrics.cpc)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* CPM */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-6 w-6 text-indigo-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      CPM
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatCurrency(metrics.cpm)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Conversões */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Conversões
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {formatNumber(metrics.conversions)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* ROAS */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <BarChart3 className="h-6 w-6 text-yellow-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      ROAS
                    </dt>
                    <dd className="text-lg font-semibold text-gray-900">
                      {metrics.roas.toFixed(2)}x
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      {campaigns.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Campanhas ({campaigns.length})
              </h3>
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Campanha
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gasto
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Impressões
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cliques
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CTR
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPC
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ROAS
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {campaigns.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {campaign.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {campaign.objective}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          campaign.status === 'ACTIVE' 
                            ? 'bg-green-100 text-green-800'
                            : campaign.status === 'PAUSED'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {campaign.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(campaign.spend)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(campaign.impressions)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatNumber(campaign.clicks)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(campaign.ctr)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(campaign.cpc)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`font-medium ${
                          campaign.roas >= 3 ? 'text-green-600' : 
                          campaign.roas >= 1 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {campaign.roas.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {refreshing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center">
            <RefreshCw className="animate-spin h-5 w-5 text-blue-500 mr-3" />
            <span className="text-gray-700">Atualizando dados do Facebook...</span>
          </div>
        </div>
      )}
    </div>
  );
}
