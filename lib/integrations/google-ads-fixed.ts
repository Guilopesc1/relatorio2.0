import { Connection } from '@prisma/client';

export interface GoogleAdAccount {
  id: string;
  name: string;
  currency_code: string;
  status: string;
  time_zone: string;
  descriptive_name?: string;
}

export interface GoogleCampaign {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date?: string;
  advertising_channel_type: string;
  customer_id: string;
}

export interface GoogleAdGroup {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  type: string;
  cpc_bid_micros?: number;
}

export interface GoogleAd {
  id: string;
  name?: string;
  status: string;
  ad_group_id: string;
  type: string;
  final_urls?: string[];
}

export interface GoogleMetrics {
  date: string;
  cost_micros: string;
  impressions: string;
  clicks: string;
  ctr: string;
  average_cpm: string;
  average_cpc: string;
  conversions: string;
  cost_per_conversion: string;
  conversion_rate: string;
}

export interface GoogleOAuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export class GoogleAdsAPIFixed {
  private baseUrl = 'https://googleads.googleapis.com/v20';
  private accessToken: string;
  private developerToken: string;
  private managerCustomerId?: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || undefined;
    
    console.log('🔧 GoogleAdsAPIFixed initialized:', {
      accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : 'NOT SET',
      developerToken: this.developerToken ? 'SET' : 'NOT SET',
      managerCustomerId: this.managerCustomerId || 'NOT SET'
    });
  }

  private async makeRequest(
    endpoint: string,
    body?: any,
    method: 'GET' | 'POST' = 'GET',
    customerId?: string
  ) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Google Ads API Client (Custom)'
    };

    // ⚠️ IMPORTANTE: Só adicionar login-customer-id se for um Manager Account
    // Para contas individuais, isso pode causar erro
    if (this.managerCustomerId && this.managerCustomerId !== customerId) {
      headers['login-customer-id'] = this.managerCustomerId;
      console.log('🔑 Using Manager Customer ID:', this.managerCustomerId);
    } else {
      console.log('📱 Direct account access (no manager)');
    }

    console.log(`🚀 API Request: ${method} ${url}`);
    console.log('📋 Headers:', {
      ...headers,
      'Authorization': `Bearer ${this.accessToken.substring(0, 20)}...`,
      'developer-token': this.developerToken ? 'SET' : 'NOT SET'
    });

    try {
      const options: RequestInit = {
        method,
        headers,
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
        console.log('📦 Request Body:', JSON.stringify(body, null, 2));
      }

      const response = await fetch(url, options);
      
      console.log('📡 Response Status:', response.status, response.statusText);
      console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // 🔍 DIAGNÓSTICO DETALHADO DO ERRO
        const contentType = response.headers.get('content-type');
        console.log('⚠️ Content-Type:', contentType);
        
        let errorData;
        
        if (contentType?.includes('application/json')) {
          errorData = await response.json();
        } else {
          // Se não é JSON, pode ser HTML de erro
          const textResponse = await response.text();
          console.log('❌ Non-JSON Response (first 500 chars):', textResponse.substring(0, 500));
          
          if (textResponse.includes('<!DOCTYPE') || textResponse.includes('<html>')) {
            throw new Error(`Google Ads API returned HTML instead of JSON. This usually indicates an authentication or configuration error. Status: ${response.status}`);
          }
          
          errorData = { 
            error: { 
              message: `HTTP ${response.status}: ${response.statusText}`,
              details: textResponse 
            } 
          };
        }
        
        console.error('❌ Google Ads API Error Response:', errorData);
        
        // Tratar erros específicos
        if (response.status === 401) {
          throw new Error('Authentication failed. Please check your access token and try again.');
        }
        
        if (response.status === 403) {
          throw new Error('Permission denied. Check if your Google Ads account has API access enabled.');
        }
        
        if (response.status === 400) {
          const message = errorData.error?.message || 'Bad request';
          if (message.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
            throw new Error('Developer token not approved. For production use, you need a standard developer token.');
          }
        }
        
        throw new Error(
          `Google Ads API Error: ${response.status} - ${
            errorData.error?.message || errorData.message || 'Unknown error'
          }`
        );
      }

      const data = await response.json();
      console.log('✅ Success Response Keys:', Object.keys(data));
      return data;
      
    } catch (error) {
      console.error('🔥 Request Failed:', error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to Google Ads API. Check your internet connection.');
      }
      
      throw error;
    }
  }

  async getAccessibleCustomers(): Promise<{ resource_names: string[] }> {
    try {
      console.log('🔍 Fetching accessible customers...');
      
      const response = await this.makeRequest('/customers:listAccessibleCustomers', {}, 'POST');
      console.log('📋 Accessible customers response:', response);
      
      return {
        resource_names: response.resourceNames || []
      };
    } catch (error) {
      console.error('❌ Error fetching accessible customers:', error);
      throw error;
    }
  }

  async getCustomerDetails(customerId: string): Promise<GoogleAdAccount> {
    try {
      console.log(`🔍 Fetching customer details for: ${customerId}`);
      
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.status
        FROM customer
        WHERE customer.id = ${cleanCustomerId}
      `;

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`, 
        { query },
        'POST',
        cleanCustomerId
      );

      if (response.results && response.results.length > 0) {
        const customer = response.results[0].customer;
        return {
          id: customer.id,
          name: customer.descriptive_name || `Customer ${customer.id}`,
          currency_code: customer.currency_code,
          status: customer.status,
          time_zone: customer.time_zone,
          descriptive_name: customer.descriptive_name
        };
      } else {
        throw new Error('Customer not found in response');
      }
    } catch (error) {
      console.error('❌ Error fetching customer details:', error);
      throw new Error(`Failed to fetch Google Ads customer details: ${error}`);
    }
  }

  async getCampaigns(customerId: string): Promise<GoogleCampaign[]> {
    try {
      console.log(`🔍 Fetching campaigns for customer: ${customerId}`);
      
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.start_date,
          campaign.end_date,
          campaign.advertising_channel_type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
        LIMIT 50
      `;

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`,
        { query },
        'POST',
        cleanCustomerId
      );

      console.log(`📊 Found ${response.results?.length || 0} campaigns`);

      return (response.results || []).map((result: any) => ({
        id: result.campaign.id,
        name: result.campaign.name,
        status: result.campaign.status,
        start_date: result.campaign.start_date,
        end_date: result.campaign.end_date,
        advertising_channel_type: result.campaign.advertising_channel_type,
        customer_id: customerId
      }));
    } catch (error) {
      console.error('❌ Error fetching campaigns:', error);
      throw new Error(`Failed to fetch Google Ads campaigns: ${error}`);
    }
  }

  async getMetrics(
    customerId: string,
    dateStart: string,
    dateStop: string,
    level: 'customer' | 'campaign' | 'ad_group' | 'ad' = 'customer',
    resourceId?: string
  ): Promise<GoogleMetrics[]> {
    try {
      console.log(`📊 Fetching metrics for ${level} level, period: ${dateStart} to ${dateStop}`);
      
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      let query = '';
      
      // 🎯 CORREÇÃO: Para métricas a nível de customer, usar campaign aggregated
      // 📊 IMPORTANTE: Métricas como CTR, CPC médio, etc. são calculadas pelo cliente
      if (level === 'customer') {
        // Para métricas de conta, agregamos as campanhas
        query = `
          SELECT
            segments.date,
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions
          FROM campaign
          WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateStop}'
            AND campaign.status != 'REMOVED'
          ORDER BY segments.date
          LIMIT 1000
        `;
      } else {
        // Para outros níveis, usar a tabela específica
        let fromClause = '';
        
        switch (level) {
          case 'campaign':
            fromClause = 'campaign';
            break;
          case 'ad_group':
            fromClause = 'ad_group';
            break;
          case 'ad':
            fromClause = 'ad_group_ad';
            break;
        }

        query = `
          SELECT
            segments.date,
            metrics.cost_micros,
            metrics.impressions,
            metrics.clicks,
            metrics.conversions
          FROM ${fromClause}
          WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateStop}'
        `;

        // Adicionar filtros específicos
        if (level === 'campaign') {
          query += ` AND campaign.status != 'REMOVED'`;
        } else if (level === 'ad_group') {
          query += ` AND ad_group.status != 'REMOVED'`;
        } else if (level === 'ad') {
          query += ` AND ad_group_ad.status != 'REMOVED'`;
        }

        if (resourceId) {
          switch (level) {
            case 'campaign':
              query += ` AND campaign.id = ${resourceId}`;
              break;
            case 'ad_group':
              query += ` AND ad_group.id = ${resourceId}`;
              break;
            case 'ad':
              query += ` AND ad_group_ad.ad.id = ${resourceId}`;
              break;
          }
        }

        query += ` ORDER BY segments.date LIMIT 1000`;
      }

      console.log('📋 GAQL Query:', query);

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`,
        { query },
        'POST',
        cleanCustomerId
      );

      console.log(`📈 Found ${response.results?.length || 0} metric records`);

      // 🎯 Para customer level, agregar os dados por data
      if (level === 'customer' && response.results && response.results.length > 0) {
        const aggregatedMetrics = new Map<string, any>();
        
        response.results.forEach((result: any) => {
          const date = result.segments.date;
          
          if (!aggregatedMetrics.has(date)) {
            aggregatedMetrics.set(date, {
              date,
              cost_micros: 0,
              impressions: 0,
              clicks: 0,
              conversions: 0
            });
          }
          
          const dayMetrics = aggregatedMetrics.get(date);
          dayMetrics.cost_micros += parseInt(result.metrics.cost_micros || '0');
          dayMetrics.impressions += parseInt(result.metrics.impressions || '0');
          dayMetrics.clicks += parseInt(result.metrics.clicks || '0');
          dayMetrics.conversions += parseFloat(result.metrics.conversions || '0');
        });
        
        // Calcular métricas derivadas
        const finalMetrics = Array.from(aggregatedMetrics.values()).map(metrics => {
          // Calcular métricas derivadas no lado do cliente
          const ctr = metrics.impressions > 0 ? (metrics.clicks / metrics.impressions) : 0;
          const avgCpc = metrics.clicks > 0 ? (metrics.cost_micros / 1000000) / metrics.clicks : 0;
          const avgCpm = metrics.impressions > 0 ? (metrics.cost_micros / 1000000) / (metrics.impressions / 1000) : 0;
          const costPerConversion = metrics.conversions > 0 ? (metrics.cost_micros / 1000000) / metrics.conversions : 0;
          const conversionRate = metrics.clicks > 0 ? (metrics.conversions / metrics.clicks) : 0;
          
          return {
            date: metrics.date,
            cost_micros: metrics.cost_micros.toString(),
            impressions: metrics.impressions.toString(),
            clicks: metrics.clicks.toString(),
            ctr: ctr.toString(),
            average_cpm: (avgCpm * 1000000).toString(), // Convert back to micros
            average_cpc: (avgCpc * 1000000).toString(), // Convert back to micros
            conversions: metrics.conversions.toString(),
            cost_per_conversion: (costPerConversion * 1000000).toString(), // Convert back to micros
            conversion_rate: conversionRate.toString()
          };
        });
        
        return finalMetrics.sort((a, b) => a.date.localeCompare(b.date));
      }

      // Para níveis diferentes de customer, também calcular métricas derivadas
      return (response.results || []).map((result: any) => {
        const costMicros = parseInt(result.metrics.cost_micros || '0');
        const impressions = parseInt(result.metrics.impressions || '0');
        const clicks = parseInt(result.metrics.clicks || '0');
        const conversions = parseFloat(result.metrics.conversions || '0');
        
        // Calcular métricas derivadas
        const ctr = impressions > 0 ? (clicks / impressions) : 0;
        const avgCpc = clicks > 0 ? (costMicros / 1000000) / clicks : 0;
        const avgCpm = impressions > 0 ? (costMicros / 1000000) / (impressions / 1000) : 0;
        const costPerConversion = conversions > 0 ? (costMicros / 1000000) / conversions : 0;
        const conversionRate = clicks > 0 ? (conversions / clicks) : 0;
        
        return {
          date: result.segments.date,
          cost_micros: costMicros.toString(),
          impressions: impressions.toString(),
          clicks: clicks.toString(),
          ctr: ctr.toString(),
          average_cpm: (avgCpm * 1000000).toString(), // Convert back to micros
          average_cpc: (avgCpc * 1000000).toString(), // Convert back to micros
          conversions: conversions.toString(),
          cost_per_conversion: (costPerConversion * 1000000).toString(), // Convert back to micros
          conversion_rate: conversionRate.toString()
        };
      });
    } catch (error) {
      console.error('❌ Error fetching metrics:', error);
      throw new Error(`Failed to fetch Google Ads metrics: ${error}`);
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      console.log('🔐 Validating Google Ads token...');
      const result = await this.getAccessibleCustomers();
      console.log('✅ Token validation successful');
      return true;
    } catch (error) {
      console.error('❌ Token validation failed:', error);
      return false;
    }
  }

  // 🛠️ MÉTODO DE DIAGNÓSTICO
  async diagnoseConnection(): Promise<{
    tokenValid: boolean;
    accessibleCustomers: string[];
    errors: string[];
  }> {
    const result = {
      tokenValid: false,
      accessibleCustomers: [] as string[],
      errors: [] as string[]
    };

    try {
      // Testar validação básica do token
      result.tokenValid = await this.validateToken();
      
      if (result.tokenValid) {
        // Tentar buscar clientes acessíveis
        const customers = await this.getAccessibleCustomers();
        result.accessibleCustomers = customers.resource_names;
      }
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  static async exchangeCodeForTokens(code: string): Promise<GoogleOAuthToken> {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    console.log('🔄 Token exchange config check:', {
      clientId: clientId ? 'SET' : 'NOT SET',
      clientSecret: clientSecret ? 'SET' : 'NOT SET',
      redirectUri: redirectUri ? 'SET' : 'NOT SET'
    });
    
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Missing Google OAuth configuration: CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI');
    }
    
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    try {
      console.log('🔄 Exchanging authorization code for tokens...');
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Token exchange failed:', response.status, errorData);
        throw new Error(`Token exchange failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const tokens = await response.json();
      console.log('✅ Token exchange successful');
      
      return tokens;
    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error);
      throw error;
    }
  }

  static async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthToken> {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      throw new Error('Missing Google OAuth configuration for refresh: CLIENT_ID or CLIENT_SECRET');
    }
    
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    });

    try {
      console.log('🔄 Refreshing access token...');
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Token refresh failed:', response.status, errorData);
        throw new Error(`Token refresh failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const tokens = await response.json();
      console.log('✅ Token refresh successful');
      
      return tokens;
    } catch (error) {
      console.error('❌ Error refreshing access token:', error);
      throw error;
    }
  }

  static getAuthUrl(state?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    if (!clientId || !redirectUri) {
      throw new Error('Missing Google OAuth configuration: CLIENT_ID or REDIRECT_URI');
    }
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/adwords');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('include_granted_scopes', 'true');
    
    if (state) {
      authUrl.searchParams.append('state', state);
    }

    return authUrl.toString();
  }
}

export async function createGoogleConnectionFixed(
  userId: string,
  accessToken: string,
  refreshToken: string,
  customerId: string
): Promise<Connection> {
  const googleAPI = new GoogleAdsAPIFixed(accessToken);
  
  // Primeiro, tentar validar o token
  const isValid = await googleAPI.validateToken();
  if (!isValid) {
    throw new Error('Invalid Google Ads access token');
  }

  // Buscar informações da conta
  const customerDetails = await googleAPI.getCustomerDetails(customerId);

  // Criar dados da conexão
  const connectionData = {
    userId,
    platform: 'GOOGLE' as const,
    accountId: customerId,
    accountName: customerDetails.name,
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora
    isActive: true
  };

  return connectionData as Connection;
}
