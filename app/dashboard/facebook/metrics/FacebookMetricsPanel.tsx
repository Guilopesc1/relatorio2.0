'use client';

import React, { useState, useEffect } from 'react';
import { Check, Settings, Save, RotateCcw, Search, Info, Star, Clock, TrendingUp, DollarSign, Users, MousePointer, Eye } from 'lucide-react';

interface Metric {
  name: string;
  description: string;
  type: string;
  category: string;
  required: boolean;
}

interface MetricCategory {
  name: string;
  description: string;
  metrics: Record<string, Metric>;
}

interface Template {
  name: string;
  description: string;
  metrics: string[];
  breakdowns: string[];
  recommended: boolean;
}

interface FacebookMetricsData {
  metrics: Record<string, MetricCategory>;
  templates: Record<string, Template>;
  metadata: {
    totalMetrics: number;
    totalTemplates: number;
    lastUpdated: string;
  };
}

interface UserPreferences {
  enabledMetrics: string[];
  metricAliases: Record<string, string>;
  cacheDurationHours: number;
  autoRefresh: boolean;
  enabledBreakdowns: string[];
  defaultDateRange: number;
  defaultObjectLevel: string;
}

const FacebookMetricsPanel: React.FC = () => {
  const [metricsData, setMetricsData] = useState<FacebookMetricsData | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Ícones por categoria
  const categoryIcons: Record<string, any> = {
    reach: Users,
    engagement: MousePointer,
    cost: DollarSign,
    traffic: TrendingUp,
    conversion: Star,
    video: Eye
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar métricas disponíveis
      const metricsResponse = await fetch('/api/facebook/metrics/available');
      const metricsResult = await metricsResponse.json();
      
      // Carregar preferências do usuário
      const preferencesResponse = await fetch('/api/facebook/preferences');
      const preferencesResult = await preferencesResponse.json();
      
      if (metricsResult.success) {
        setMetricsData(metricsResult.data);
      }
      
      if (preferencesResult.success) {
        setUserPreferences(preferencesResult.data);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!userPreferences) return;
    
    try {
      setSaving(true);
      const response = await fetch('/api/facebook/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userPreferences),
      });
      
      const result = await response.json();
      if (result.success) {
        // Mostrar feedback de sucesso
        console.log('Preferências salvas com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = (templateKey: string) => {
    if (!metricsData || !userPreferences) return;
    
    const template = metricsData.templates[templateKey];
    if (template) {
      setUserPreferences({
        ...userPreferences,
        enabledMetrics: [...template.metrics]
      });
      setSelectedTemplate(templateKey);
    }
  };

  const toggleMetric = (metricKey: string) => {
    if (!userPreferences) return;
    
    const isEnabled = userPreferences.enabledMetrics.includes(metricKey);
    const newEnabledMetrics = isEnabled
      ? userPreferences.enabledMetrics.filter(m => m !== metricKey)
      : [...userPreferences.enabledMetrics, metricKey];
    
    setUserPreferences({
      ...userPreferences,
      enabledMetrics: newEnabledMetrics
    });
  };

  const resetToDefaults = async () => {
    try {
      const response = await fetch('/api/facebook/preferences', {
        method: 'DELETE'
      });
      
      if (response.ok) {
        // Recarregar preferências padrão
        loadData();
      }
    } catch (error) {
      console.error('Erro ao resetar preferências:', error);
    }
  };

  // Filtrar métricas baseado na busca e categoria
  const getFilteredMetrics = () => {
    if (!metricsData) return [];
    
    const allMetrics: Array<{key: string, metric: Metric, categoryKey: string}> = [];
    
    Object.entries(metricsData.metrics).forEach(([categoryKey, category]) => {
      Object.entries(category.metrics).forEach(([metricKey, metric]) => {
        if (selectedCategory === 'all' || metric.category === selectedCategory) {
          if (searchTerm === '' || 
              metric.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              metric.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
              metricKey.toLowerCase().includes(searchTerm.toLowerCase())) {
            allMetrics.push({ key: metricKey, metric, categoryKey });
          }
        }
      });
    });
    
    return allMetrics;
  };

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category] || Settings;
    return <IconComponent className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metricsData || !userPreferences) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Erro ao carregar dados</h2>
          <p className="text-gray-600">Não foi possível carregar as métricas disponíveis.</p>
        </div>
      </div>
    );
  }

  const filteredMetrics = getFilteredMetrics();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Métricas do Facebook Ads</h1>
              <p className="text-gray-600 mt-1">
                Selecione as métricas que deseja incluir nos seus relatórios
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={resetToDefaults}
                className="flex items-center px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Resetar
              </button>
              <button
                onClick={savePreferences}
                disabled={saving}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
          
          {/* Status */}
          <div className="flex items-center space-x-6 text-sm text-gray-600">
            <span className="flex items-center">
              <Check className="w-4 h-4 mr-1 text-green-600" />
              {userPreferences.enabledMetrics.length} métricas selecionadas
            </span>
            <span className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              Cache: {userPreferences.cacheDurationHours}h
            </span>
            <span className="flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              {metricsData.metadata.totalMetrics} métricas disponíveis
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Templates e Filtros */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
              {/* Templates Prontos */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Templates Prontos</h3>
                <div className="space-y-2">
                  {Object.entries(metricsData.templates).map(([key, template]) => (
                    <button
                      key={key}
                      onClick={() => applyTemplate(key)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedTemplate === key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{template.name}</div>
                          <div className="text-sm text-gray-600 mt-1">{template.description}</div>
                        </div>
                        {template.recommended && (
                          <Star className="w-4 h-4 text-yellow-500" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Busca */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Buscar Métricas
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Nome ou descrição..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Filtro por Categoria */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">Todas as categorias</option>
                  <option value="reach">Alcance</option>
                  <option value="engagement">Engajamento</option>
                  <option value="cost">Custo</option>
                  <option value="traffic">Tráfego</option>
                  <option value="conversion">Conversão</option>
                  <option value="video">Vídeo</option>
                </select>
              </div>

              {/* Configurações Avançadas */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="flex items-center text-sm font-medium text-gray-700 mb-2"
                >
                  <Settings className="w-4 h-4 mr-1" />
                  Configurações Avançadas
                </button>
                
                {showAdvanced && (
                  <div className="space-y-4 pt-2 border-t">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Duração do Cache (horas)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={userPreferences.cacheDurationHours}
                        onChange={(e) => setUserPreferences({
                          ...userPreferences,
                          cacheDurationHours: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Período Padrão (dias)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={userPreferences.defaultDateRange}
                        onChange={(e) => setUserPreferences({
                          ...userPreferences,
                          defaultDateRange: parseInt(e.target.value)
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                    </div>
                    
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={userPreferences.autoRefresh}
                          onChange={(e) => setUserPreferences({
                            ...userPreferences,
                            autoRefresh: e.target.checked
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-600">Atualização automática</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Main Content - Lista de Métricas */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900">
                  Métricas Disponíveis ({filteredMetrics.length})
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                  Clique nas métricas para adicioná-las ou removê-las da sua seleção
                </p>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredMetrics.map(({ key, metric, categoryKey }) => {
                    const isSelected = userPreferences.enabledMetrics.includes(key);
                    
                    return (
                      <div
                        key={key}
                        onClick={() => toggleMetric(key)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              {getCategoryIcon(metric.category)}
                              <h4 className="font-medium text-gray-900">{metric.name}</h4>
                              {isSelected && (
                                <Check className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {metric.description}
                            </p>
                            <div className="flex items-center space-x-3 text-xs">
                              <span className={`px-2 py-1 rounded-full ${
                                metric.category === 'cost' ? 'bg-red-100 text-red-800' :
                                metric.category === 'conversion' ? 'bg-green-100 text-green-800' :
                                metric.category === 'engagement' ? 'bg-blue-100 text-blue-800' :
                                metric.category === 'reach' ? 'bg-purple-100 text-purple-800' :
                                metric.category === 'traffic' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {metric.category}
                              </span>
                              <span className="text-gray-500">
                                {metric.type}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {filteredMetrics.length === 0 && (
                  <div className="text-center py-12">
                    <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      Nenhuma métrica encontrada
                    </h3>
                    <p className="text-gray-600">
                      Tente ajustar os filtros ou termo de busca
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FacebookMetricsPanel;
