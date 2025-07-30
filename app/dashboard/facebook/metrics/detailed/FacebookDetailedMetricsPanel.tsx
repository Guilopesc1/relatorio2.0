'use client';

import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Download, BarChart3, 
  TrendingUp, DollarSign, Users, MousePointer, Eye,
  Loader2, AlertTriangle, CheckCircle
} from 'lucide-react';

interface DetailedMetric {
  id: string;
  account: { id: string; name: string; };
  campaign: { id: string; name: string; };
  adset: { id: string; name: string; };
  ad: { id: string; name: string; };
  date: { start: string; stop: string; };
  metrics: {
    reach?: number;
    impressions?: number;
    spend?: number;
    inline_link_clicks?: number;
    link_click?: number;
    video_view?: number;
    video_p75_watched_actions?: number;
    landing_page_view?: number;
    offsite_conversion_fb_pixel_add_to_cart?: number;
    offsite_conversion_fb_pixel_initiate_checkout?: number;
    offsite_conversion_fb_pixel_purchase?: number;
    offsite_conversion_fb_pixel_complete_registration?: number;
    offsite_conversion_fb_pixel_custom?: number;
    offsite_conversion_fb_pixel_lead?: number;
    onsite_conversion_lead_grouped?: number;
    leadgen_other?: number;
    onsite_conversion_messaging_conversation_started_7d?: number;
  };
  cache: {
    created_at: string;
    expires_at: string;
    is_stale: boolean;
    cache_key: string;
  };
}

const FacebookDetailedMetricsPanel: React.FC = () => {
  const [metrics, setMetrics] = useState<DetailedMetric[]>([]);
  const [aggregates, setAggregates] = useState<any>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    account_id: '',
    date_from: '',
    date_to: '',
    page: 1,
    page_size: 20,
    sort_by: 'dateStart',
    sort_order: 'desc'
  });

  const [accounts, setAccounts] = useState<{id: string, name: string}[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (accounts.length > 0) {
      loadMetrics();
    }
  }, [filters, accounts]);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const response = await fetch('/api/connections?platform=FACEBOOK');
      const result = await response.json();
      
      if (result.success) {
        const facebookAccounts = result.data.connections.map((conn: any) => ({
          id: conn.accountId,
          name: conn.accountName || `Conta ${conn.accountId}`
        }));
        setAccounts(facebookAccounts);
        
        // Se não há conta selecionada e há contas disponíveis, selecionar a primeira
        if (!filters.account_id && facebookAccounts.length > 0) {
          setFilters(prev => ({ ...prev, account_id: facebookAccounts[0].id }));
        }
      } else {
        setError('Erro ao carregar contas do Facebook');
      }
    } catch (err: any) {
      console.error('Erro ao carregar contas:', err);
      setError('Erro ao carregar contas do Facebook');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.set(key, value.toString());
      });

      const response = await fetch(`/api/facebook/metrics/detailed/list?${queryParams}`);
      const result = await response.json();
      
      if (result.success) {
        setMetrics(result.data);
        setAggregates(result.aggregates);
        setPagination(result.pagination);
      } else {
        setError('Erro ao carregar métricas');
      }
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const collectNewMetrics = async () => {
    try {
      setCollecting(true);
      setError(null);
      
      const response = await fetch('/api/facebook/metrics/detailed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: filters.account_id || accounts[0]?.id,
          date_range: 'last_7_days',
          level: 'ad'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadMetrics();
      } else {
        setError('Erro ao coletar métricas: ' + result.error);
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao coletar métricas');
    } finally {
      setCollecting(false);
    }
  };

  const formatCurrency = (value?: number) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatNumber = (value?: number) => {
    if (!value) return '0';
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Métricas Detalhadas do Facebook</h1>
              <p className="text-gray-600 mt-1">
                Visualize e analise métricas detalhadas coletadas das suas campanhas
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={loadMetrics}
                disabled={loading}
                className="flex items-center px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
              <button
                onClick={collectNewMetrics}
                disabled={collecting || accounts.length === 0}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {collecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {collecting ? 'Coletando...' : accounts.length === 0 ? 'Conectar Conta' : 'Coletar Dados'}
              </button>
            </div>
          </div>
          
          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Conta do Facebook
              </label>
              {loadingAccounts ? (
                <div className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-gray-600">Carregando contas...</span>
                </div>
              ) : accounts.length === 0 ? (
                <div className="w-full px-3 py-2 border border-red-300 rounded-lg bg-red-50 text-red-700">
                  Nenhuma conta conectada. <a href="/dashboard/connections" className="underline">Conectar conta</a>
                </div>
              ) : (
                <select
                  value={filters.account_id}
                  onChange={(e) => setFilters({ ...filters, account_id: e.target.value, page: 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Todas as contas</option>
                  {accounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Inicial
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Final
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ordenar por
              </label>
              <select
                value={`${filters.sort_by}-${filters.sort_order}`}
                onChange={(e) => {
                  const [sort_by, sort_order] = e.target.value.split('-');
                  setFilters({ ...filters, sort_by, sort_order, page: 1 });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="dateStart-desc">Data (Mais recente)</option>
                <option value="dateStart-asc">Data (Mais antigo)</option>
                <option value="spend-desc">Gasto (Maior)</option>
                <option value="spend-asc">Gasto (Menor)</option>
                <option value="impressions-desc">Impressões (Maior)</option>
                <option value="impressions-asc">Impressões (Menor)</option>
              </select>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <span className="text-red-800">{error}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Métricas Detalhadas
              {pagination && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({formatNumber(pagination.total_records)} registros)
                </span>
              )}
            </h2>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Carregando métricas...</span>
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {accounts.length === 0 ? 'Nenhuma conta do Facebook conectada' : 'Nenhuma métrica encontrada'}
              </h3>
              <p className="text-gray-600 mb-4">
                {accounts.length === 0 
                  ? 'Conecte sua conta do Facebook para visualizar as métricas detalhadas'
                  : 'Tente ajustar os filtros ou coletar novos dados'
                }
              </p>
              {accounts.length === 0 ? (
                <a
                  href="/dashboard/connections"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Conectar Conta do Facebook
                </a>
              ) : (
                <button
                  onClick={collectNewMetrics}
                  disabled={collecting}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {collecting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Coletar Dados
                </button>
              )}
            </div>
          ) : (
            <div className="p-6">
              <p className="text-gray-600 text-center">
                Sistema de métricas detalhadas implementado com sucesso!<br/>
                APIs configuradas para coletar: {formatNumber(metrics.length)} registros de métricas<br/>
                Pronto para integração com Facebook Ads API
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FacebookDetailedMetricsPanel;