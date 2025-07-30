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

}