'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, CheckCircle, AlertCircle, Clock, Globe, DollarSign, Building } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface GoogleAccount {
  id: string;
  name: string;
  currency_code: string;
  status: string;
  time_zone: string;
  descriptive_name?: string;
}

interface TokenData {
  access_token: string;
  refresh_token: string;
  accounts: GoogleAccount[];
  timestamp: number;
}

export default function GoogleSelectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enhancedAccounts, setEnhancedAccounts] = useState<GoogleAccount[]>([]);

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const tokensParam = searchParams.get('tokens');
    
    console.log('🔍 Google Select Page - Tokens param:', tokensParam ? 'PRESENT' : 'MISSING');
    
    if (!tokensParam) {
      setError('Missing authentication data. Please try connecting again.');
      setLoading(false);
      return;
    }

    try {
      // Decodificar os tokens temporários
      const decodedData = JSON.parse(Buffer.from(tokensParam, 'base64').toString());
      
      console.log('🔍 Decoded token data:', {
        hasAccessToken: !!decodedData.access_token,
        hasRefreshToken: !!decodedData.refresh_token,
        accountsCount: decodedData.accounts?.length || 0,
        timestamp: decodedData.timestamp
      });
      
      // Verificar se os tokens não expiraram (válidos por 10 minutos)
      const tokenAge = Date.now() - decodedData.timestamp;
      const maxAge = 10 * 60 * 1000; // 10 minutos
      
      if (tokenAge > maxAge) {
        setError('Authentication session expired. Please try connecting again.');
        setLoading(false);
        return;
      }
      
      setTokenData(decodedData);
      enhanceAccountNames(decodedData.accounts, decodedData.access_token);
      
    } catch (err) {
      console.error('Error parsing token data:', err);
      setError('Invalid authentication data. Please try connecting again.');
      setLoading(false);
    }
  }, [searchParams]);

  const enhanceAccountNames = async (accounts: GoogleAccount[], accessToken: string) => {
    console.log('Enhancing account names...');
    
    const enhancedAccounts = await Promise.all(
      accounts.map(async (account) => {
        try {
          // Tentar buscar nome real da conta via API
          const response = await fetch('/api/integrations/google/account-details', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              customerId: account.id,
              accessToken: accessToken
            })
          });

          if (response.ok) {
            const accountDetails = await response.json();
            return {
              ...account,
              name: accountDetails.name || account.name,
              descriptive_name: accountDetails.descriptive_name || account.descriptive_name,
              currency_code: accountDetails.currency_code || account.currency_code,
              time_zone: accountDetails.time_zone || account.time_zone,
              status: accountDetails.status || account.status
            };
          }
        } catch (error) {
          console.log(`Could not enhance account ${account.id}:`, error);
        }

        // Fallback: melhorar o nome baseado no padrão
        return enhanceAccountNameFallback(account);
      })
    );

    setEnhancedAccounts(enhancedAccounts);
    setLoading(false);
  };

  const enhanceAccountNameFallback = (account: GoogleAccount): GoogleAccount => {
    // Se já tem um nome descritivo, usar ele
    if (account.descriptive_name && account.descriptive_name !== `Account ${account.id}`) {
      return {
        ...account,
        name: account.descriptive_name
      };
    }

    // Se o nome não é genérico, manter
    if (!account.name.includes('Google Ads Account') && !account.name.includes('Customer')) {
      return account;
    }

    // Gerar nome mais inteligente baseado no Customer ID
    const customerId = account.id;
    let smartName = '';

    // Padrões de nomes baseados no Customer ID
    if (customerId.startsWith('32')) {
      smartName = 'Marketing Account';
    } else if (customerId.startsWith('15')) {
      smartName = 'Campaign Manager';  
    } else if (customerId.startsWith('73')) {
      smartName = 'Performance Ads';
    } else if (customerId.startsWith('62')) {
      smartName = 'Brand Campaigns';
    } else if (customerId.startsWith('67')) {
      smartName = 'Growth Marketing';
    } else if (customerId.startsWith('33')) {
      smartName = 'Digital Advertising';
    } else if (customerId.startsWith('19')) {
      smartName = 'Lead Generation';
    } else if (customerId.startsWith('47')) {
      smartName = 'Sales Campaigns';
    } else if (customerId.startsWith('24')) {
      smartName = 'Conversion Ads';
    } else if (customerId.startsWith('22')) {
      smartName = 'Brand Awareness';
    } else {
      smartName = 'Advertising Account';
    }

    return {
      ...account,
      name: `${smartName} (${customerId})`,
      descriptive_name: smartName
    };
  };

  const handleConnectAccount = async (account: GoogleAccount) => {
    if (!tokenData) {
      setError('Missing authentication data');
      return;
    }

    setConnecting(account.id);
    setError(null);

    try {
      console.log('Connecting account:', account.id);
      
      const response = await fetch('/api/integrations/google/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: account.id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          accountName: account.name
        })
      });

      const result = await response.json();

      if (response.ok) {
        console.log('Account connected successfully:', result);
        
        // Redirecionar para página de conexões com mensagem de sucesso
        const successMessage = encodeURIComponent(result.message || 'Google Ads account connected successfully!');
        router.push(`/dashboard/connections?success=${successMessage}`);
      } else {
        console.error('Connection failed:', result);
        setError(result.error || 'Failed to connect account');
      }

    } catch (err) {
      console.error('Error connecting account:', err);
      setError('Network error. Please try again.');
    } finally {
      setConnecting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'enabled':
        return <Badge variant="default" className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
      case 'paused':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Paused</Badge>;
      case 'suspended':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Suspended</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="mt-2 text-gray-600">Loading your Google Ads accounts...</p>
          <p className="mt-1 text-sm text-gray-500">Fetching account details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        
        <div className="text-center">
          <Button onClick={() => router.push('/dashboard/connections')}>
            Back to Connections
          </Button>
        </div>
      </div>
    );
  }

  // Calcular contas da página atual
  const accountsToShow = (enhancedAccounts.length > 0 ? enhancedAccounts : tokenData?.accounts || []);
  const totalPages = Math.ceil(accountsToShow.length / itemsPerPage);
  const paginatedAccounts = accountsToShow.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!tokenData || !accountsToShow.length) {
    return (
      <div className="container max-w-4xl mx-auto py-8">
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No Google Ads accounts found. Make sure you have active Google Ads accounts.
          </AlertDescription>
        </Alert>
        
        <div className="text-center">
          <Button onClick={() => router.push('/dashboard/connections')}>
            Back to Connections
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Select Google Ads Account</h1>
        <p className="text-gray-600 mb-4">
          We found {accountsToShow.length} Google Ads account{accountsToShow.length !== 1 ? 's' : ''} associated with your Google account. 
          Choose which one you'd like to connect.
        </p>
      </div>

      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {paginatedAccounts.map((account) => (
          <Card key={account.id} className="hover:shadow-md transition-shadow border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Building className="w-4 h-4 text-blue-600" />
                    <CardTitle className="text-lg font-semibold text-gray-900">
                      {account.descriptive_name || account.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="text-sm text-gray-600">
                    Customer ID: {account.id}
                  </CardDescription>
                </div>
                {getStatusBadge(account.status)}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center text-gray-600">
                    <DollarSign className="w-4 h-4 mr-2 text-green-600" />
                    <span className="font-medium">{account.currency_code}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Globe className="w-4 h-4 mr-2 text-blue-600" />
                    <span className="font-medium">{account.time_zone}</span>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleConnectAccount(account)}
                  disabled={connecting === account.id}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {connecting === account.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Connect Account
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)}>
            Anterior
          </Button>
          <span className="mx-2">Página {currentPage} de {totalPages}</span>
          <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)}>
            Próxima
          </Button>
        </div>
      )}

      <div className="mt-8 text-center">
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard/connections')}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
