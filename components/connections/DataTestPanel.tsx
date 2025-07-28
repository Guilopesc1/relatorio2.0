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
      if (selectedConnections.length === 1) {
        // Teste individual
        const response = await fetch('/api/integrations/facebook/data', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connectionId: selectedConnections[0],
            dateStart,
            dateStop
          }),
        });

        const data = await response.json();
        setResults(data);
      } else {
        // Teste múltiplas contas
        const connectionIdsParam = selectedConnections.join(',');
        const response = await fetch(
          `/api/integrations/facebook/data?connectionIds=${connectionIdsParam}&dateStart=${dateStart}&dateStop=${dateStop}`
        );

        const data = await response.json();
        setResults(data);
      }
    } catch (error) {
      console.error('Error testing data collection:', error);
      alert('Erro ao testar coleta de dados');
    } finally {
      setLoading(false);
    }
  };

  const downloadResults = () => {
    if (!results) return;
    
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `facebook_data_${dateStart}_to_${dateStop}.json`;
    
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

      {facebookConnections.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            Nenhuma conexão Facebook disponível para teste
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Seleção de Conexões */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecionar Conexões Facebook
            </label>
            <div className="space-y-2">
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
                  {results.data.campaigns && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-lg font-semibold text-blue-900">
                          {results.data.campaigns.length}
                        </div>
                        <div className="text-sm text-blue-700">Campanhas</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg">
                        <div className="text-lg font-semibold text-green-900">
                          {results.data.campaigns.reduce((acc: number, camp: any) => acc + (camp.adSets?.length || 0), 0)}
                        </div>
                        <div className="text-sm text-green-700">Conjuntos de Anúncios</div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg">
                        <div className="text-lg font-semibold text-purple-900">
                          {results.data.campaigns.reduce((acc: number, camp: any) => 
                            acc + (camp.adSets?.reduce((acc2: number, adSet: any) => acc2 + (adSet.ads?.length || 0), 0) || 0), 0
                          )}
                        </div>
                        <div className="text-sm text-purple-700">Anúncios</div>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-lg">
                        <div className="text-lg font-semibold text-orange-900">
                          {new Date(results.data.collectedAt).toLocaleTimeString('pt-BR')}
                        </div>
                        <div className="text-sm text-orange-700">Coletado às</div>
                      </div>
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
