'use client';

import { useState } from 'react';
import { Calendar, Download, Play, Square } from 'lucide-react';

interface Connection {
  id: string;
  platform: 'FACEBOOK' | 'GOOGLE' | 'TIKTOK';
  accountId: string;
  accountName: string;
  isActive: boolean;
}

interface DataTestPanelProps {
  connections: Connection[];
}

export default function DataTestPanel({ connections }: DataTestPanelProps) {
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);
  const [dateStart, setDateStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split('T')[0];
  });
  const [dateStop, setDateStop] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  });
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const facebookConnections = connections.filter(conn => conn.platform === 'FACEBOOK');
  const googleConnections = connections.filter(conn => conn.platform === 'GOOGLE');
  const allActiveConnections = connections.filter(conn => conn.isActive);

  const handleConnectionToggle = (connectionId: string) => {
    setSelectedConnections(prev => 
      prev.includes(connectionId) 
        ? prev.filter(id => id !== connectionId)
        : [...prev, connectionId]
    );
  };

  const handleTestData = async () => {
    if (selectedConnections.length === 0) {
      alert('Selecione pelo menos uma conexão');
      return;
    }

    setLoading(true);
    setResults(null);

    try {
      const results = [];
      
      for (const connectionId of selectedConnections) {
        const connection = connections.find(c => c.id === connectionId);
        if (!connection) continue;

        let apiEndpoint = '';
        let dataType = 'account_overview';
        
        switch (connection.platform) {
          case 'FACEBOOK':
            apiEndpoint = '/api/integrations/facebook/data';
            break;
          case 'GOOGLE':
            apiEndpoint = '/api/integrations/google/data';
            break;
          default:
            continue;
        }

        try {
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              connectionId,
              dataType,
              dateStart,
              dateStop
            }),
          });

          const data = await response.json();
          results.push({
            connectionId,
            platform: connection.platform,
            accountName: connection.accountName,
            success: data.success,
            data: data.data,
            error: data.error
          });
        } catch (error) {
          results.push({
            connectionId,
            platform: connection.platform,
            accountName: connection.accountName,
            success: false,
            error: `Erro de conexão: ${error}`
          });
        }
      }

      setResults({
        success: true,
        data: {
          summary: {
            total: selectedConnections.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
          },
          results,
          collectedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error testing data collection:', error);
      setResults({
        success: false,
        error: 'Erro geral na coleta de dados'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `ads_data_${dateStart}_to_${dateStop}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Teste de Coleta de Dados
      </h3>

      {allActiveConnections.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            Nenhuma conexão ativa disponível para teste
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seleção de Conexões */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Conexões
            </label>
            <div className="space-y-3">
              {/* Facebook Connections */}
              {facebookConnections.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-700 mb-2">Facebook Ads</h4>
                  <div className="space-y-2 ml-4">
                    {facebookConnections.map((connection) => (
                      <label key={connection.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedConnections.includes(connection.id)}
                          onChange={() => handleConnectionToggle(connection.id)}
                          className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-900">
                          {connection.accountName}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">
                          ({connection.accountId})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Google Connections */}
              {googleConnections.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-700 mb-2">Google Ads</h4>
                  <div className="space-y-2 ml-4">
                    {googleConnections.map((connection) => (
                      <label key={connection.id} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedConnections.includes(connection.id)}
                          onChange={() => handleConnectionToggle(connection.id)}
                          className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-300 focus:ring focus:ring-red-200 focus:ring-opacity-50"
                        />
                        <span className="ml-2 text-sm text-gray-900">
                          {connection.accountName}
                        </span>
                        <span className="ml-1 text-xs text-gray-500">
                          ({connection.accountId})
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Seleção de Datas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Início
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <Calendar className="absolute right-3 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Fim
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dateStop}
                  onChange={(e) => setDateStop(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                <Calendar className="absolute right-3 top-2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex space-x-3">
            <button
              onClick={handleTestData}
              disabled={loading || selectedConnections.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Square className="h-4 w-4 mr-2 animate-spin" />
                  Coletando...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Testar Coleta
                </>
              )}
            </button>

            {results && (
              <button
                onClick={downloadResults}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Download className="h-4 w-4 mr-2" />
                Download JSON
              </button>
            )}
          </div>

          {/* Resultados */}
          {results && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">
                Resultados da Coleta
              </h4>
              
              {results.success ? (
                <div className="space-y-4">
                  {/* Resumo */}
                  {results.data.summary && (
                    <div className="bg-green-50 border border-green-200 rounded-md p-3">
                      <div className="text-sm text-green-800">
                        <strong>Resumo:</strong> {results.data.summary.successful} de {results.data.summary.total} contas coletadas com sucesso
                      </div>
                    </div>
                  )}

                  {/* Dados coletados */}
                  <div className="bg-gray-50 rounded-md p-4 max-h-96 overflow-y-auto">
                    <pre className="text-xs text-gray-800">
                      {JSON.stringify(results.data, null, 2)}
                    </pre>
                  </div>

                  {/* Métricas resumidas */}
                  {results.data.results && (
                    <div className="space-y-4">
                      {results.data.results.map((result: any, index: number) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900">
                              {result.accountName} ({result.platform})
                            </h5>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              result.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {result.success ? 'Sucesso' : 'Erro'}
                            </span>
                          </div>
                          
                          {result.success ? (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              {result.platform === 'FACEBOOK' && result.data?.campaigns && (
                                <>
                                  <div className="bg-blue-50 p-2 rounded">
                                    <div className="font-semibold text-blue-900">
                                      {result.data.campaigns.length}
                                    </div>
                                    <div className="text-blue-700">Campanhas</div>
                                  </div>
                                  <div className="bg-green-50 p-2 rounded">
                                    <div className="font-semibold text-green-900">
                                      {result.data.totalSpend ? `${result.data.totalSpend.toFixed(2)}` : 'N/A'}
                                    </div>
                                    <div className="text-green-700">Gasto Total</div>
                                  </div>
                                </>
                              )}
                              
                              {result.platform === 'GOOGLE' && result.data?.campaigns && (
                                <>
                                  <div className="bg-red-50 p-2 rounded">
                                    <div className="font-semibold text-red-900">
                                      {result.data.campaigns.length}
                                    </div>
                                    <div className="text-red-700">Campanhas</div>
                                  </div>
                                  <div className="bg-orange-50 p-2 rounded">
                                    <div className="font-semibold text-orange-900">
                                      {result.data.metrics?.totalSpend ? `${(result.data.metrics.totalSpend).toFixed(2)}` : 'N/A'}
                                    </div>
                                    <div className="text-orange-700">Gasto Total</div>
                                  </div>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-red-600">
                              {result.error}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="text-sm text-red-800">
                    <strong>Erro:</strong> {results.error}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
