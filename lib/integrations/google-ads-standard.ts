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

export class GoogleAdsAPIStandard {
  private baseUrl = 'https://googleads.googleapis.com/v20';
  private accessToken: string;
  private developerToken: string;
  private managerCustomerId: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
  }

  private async makeRequest(
    endpoint: string,
    body?: any,
    method: 'GET' | 'POST' = 'GET',
    customerId?: string
  ) {
    // ✅ CORREÇÃO: Usar sempre o Manager Customer ID
    const targetCustomerId = customerId || this.managerCustomerId;
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };

    // ✅ ADICIONAR login-customer-id para usar o Manager Account
    if (this.managerCustomerId) {
      headers['login-customer-id'] = this.managerCustomerId;
    }

    console.log(`Google Ads API Request (Manager Mode): ${method} ${url}`);
    console.log('Target Customer ID:', targetCustomerId);
    console.log('Manager Customer ID:', this.managerCustomerId);
    console.log('Headers:', JSON.stringify(headers, null, 2));

    try {
      const options: RequestInit = {
        method,
        headers,
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ 
          error: { message: `HTTP ${response.status}: ${response.statusText}` } 
        }));
        
        console.error('Google Ads API Error Response:', errorData);
        throw new Error(
          `Google Ads API Error: ${response.status} - ${
            errorData.error?.message || errorData.message || 'Unknown error'
          }`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Google Ads API Request Failed:', error);
      throw error;
    }
  }

  async getAccessibleCustomers(): Promise<{ resource_names: string[] }> {
    try {
      console.log('🔍 Fetching accessible customers via Manager Account...');
      console.log('🔑 Using Manager Customer ID:', this.managerCustomerId);
      
      // ✅ CORREÇÃO: Usar Manager Customer ID para buscar contas gerenciadas
      const response = await this.makeRequest('/customers:listAccessibleCustomers');
      console.log('📋 Accessible customers response:', response);
      
      return {
        resource_names: response.resourceNames || []
      };
    } catch (error) {
      console.error('❌ Error fetching accessible customers:', error);
      
      // Melhor tratamento de erro específico para Developer Token
      if (error instanceof Error) {
        if (error.message.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
          throw new Error('Developer Token não aprovado. Para produção, solicite aprovação do token padrão no Google Ads.');
        }
        if (error.message.includes('UNAUTHENTICATED')) {
          throw new Error('Token de acesso inválido ou expirado. Faça login novamente.');
        }
        if (error.message.includes('PERMISSION_DENIED')) {
          throw new Error('Usuário não tem permissão ou não possui contas do Google Ads.');
        }
      }
      
      throw new Error('Falha ao buscar contas acessíveis do Google Ads');
    }
  }

  async getCustomerDetails(customerId: string): Promise<GoogleAdAccount> {
    try {
      // ✅ CORREÇÃO: Usar o customerId específico da conta do usuário
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
        throw new Error('Customer not found');
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
      throw new Error('Failed to fetch Google Ads customer details');
    }
  }

  // ✅ NOVO MÉTODO: Buscar detalhes da conta específica do usuário (sem Manager Customer ID)
  async getCustomerDetailsForUser(customerId: string): Promise<GoogleAdAccount> {
    try {
      console.log(`🔍 Fetching details for user account: ${customerId}`);
      
      // ✅ CORREÇÃO: Usar o customerId específico da conta do usuário
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
        throw new Error('Customer not found');
      }
    } catch (error) {
      console.error(`Error fetching user customer details for ${customerId}:`, error);
      throw new Error('Failed to fetch user Google Ads customer details');
    }
  }

  async getCampaigns(customerId: string): Promise<GoogleCampaign[]> {
    try {
      // ✅ CORREÇÃO: Usar o customerId específico da conta do usuário
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
      `;

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`,
        { query },
        'POST',
        cleanCustomerId
      );

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
      console.error('Error fetching campaigns:', error);
      throw new Error('Failed to fetch Google Ads campaigns');
    }
  }

  async getAdGroups(customerId: string, campaignId?: string): Promise<GoogleAdGroup[]> {
    try {
      // ✅ CORREÇÃO: Usar o customerId específico da conta do usuário
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      let query = `
        SELECT
          ad_group.id,
          ad_group.name,
          ad_group.status,
          ad_group.campaign,
          ad_group.type,
          ad_group.cpc_bid_micros
        FROM ad_group
        WHERE ad_group.status != 'REMOVED'
      `;

      if (campaignId) {
        query += ` AND ad_group.campaign = 'customers/${cleanCustomerId}/campaigns/${campaignId}'`;
      }

      query += ` ORDER BY ad_group.name`;

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`,
        { query },
        'POST',
        cleanCustomerId
      );

      return (response.results || []).map((result: any) => ({
        id: result.ad_group.id,
        name: result.ad_group.name,
        status: result.ad_group.status,
        campaign_id: result.ad_group.campaign.split('/').pop(),
        type: result.ad_group.type,
        cpc_bid_micros: result.ad_group.cpc_bid_micros
      }));
    } catch (error) {
      console.error('Error fetching ad groups:', error);
      throw new Error('Failed to fetch Google Ads ad groups');
    }
  }

  async getMetrics(
    customerId: string,
    dateStart: string,
    dateStop: string,
    level: 'customer' | 'campaign' | 'ad_group' | 'ad' = 'campaign',
    resourceId?: string
  ): Promise<GoogleMetrics[]> {
    try {
      // ✅ CORREÇÃO: Usar o customerId específico da conta do usuário
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      let fromClause = '';
      
      switch (level) {
        case 'customer':
          fromClause = 'customer';
          break;
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

      let query = `
        SELECT
          segments.date,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpm,
          metrics.average_cpc,
          metrics.conversions,
          metrics.cost_per_conversion,
          metrics.conversion_rate
        FROM ${fromClause}
        WHERE segments.date >= '${dateStart}' AND segments.date <= '${dateStop}'
      `;

      if (resourceId && level !== 'customer') {
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

      query += ` ORDER BY segments.date`;

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`,
        { query },
        'POST',
        cleanCustomerId
      );

      return (response.results || []).map((result: any) => ({
        date: result.segments.date,
        cost_micros: result.metrics.cost_micros || '0',
        impressions: result.metrics.impressions || '0',
        clicks: result.metrics.clicks || '0',
        ctr: result.metrics.ctr || '0',
        average_cpm: result.metrics.average_cpm || '0',
        average_cpc: result.metrics.average_cpc || '0',
        conversions: result.metrics.conversions || '0',
        cost_per_conversion: result.metrics.cost_per_conversion || '0',
        conversion_rate: result.metrics.conversion_rate || '0'
      }));
    } catch (error) {
      console.error('Error fetching metrics:', error);
      throw new Error('Failed to fetch Google Ads metrics');
    }
  }

  async checkDeveloperTokenStatus(): Promise<'basic' | 'standard' | 'unknown'> {
    try {
      // Tentar uma operação que falha com token básico
      const testResponse = await this.makeRequest('/customers:listAccessibleCustomers');
      
      // Se chegou aqui, token pode ser standard
      return 'standard';
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('DEVELOPER_TOKEN_NOT_APPROVED') || 
            error.message.includes('basic')) {
          return 'basic';
        }
      }
      return 'unknown';
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      console.log('Validating Google Ads token...');
      const result = await this.getAccessibleCustomers();
      console.log('Token validation successful:', result);
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  static async exchangeCodeForTokens(code: string): Promise<GoogleOAuthToken> {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    
    console.log('Token exchange config check:', {
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
      console.log('Exchanging authorization code for tokens...');
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Token exchange failed:', response.status, errorData);
        throw new Error(`Token exchange failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const tokens = await response.json();
      console.log('Token exchange successful:', {
        access_token: tokens.access_token ? 'RECEIVED' : 'MISSING',
        refresh_token: tokens.refresh_token ? 'RECEIVED' : 'MISSING',
        expires_in: tokens.expires_in
      });
      
      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  static async refreshAccessToken(refreshToken: string): Promise<GoogleOAuthToken> {
    const tokenEndpoint = 'https://oauth2.googleapis.com/token';
    
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    
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
      console.log('Refreshing access token...');
      
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Token refresh failed:', response.status, errorData);
        throw new Error(`Token refresh failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
      }

      const tokens = await response.json();
      console.log('Token refresh successful:', {
        access_token: tokens.access_token ? 'RECEIVED' : 'MISSING',
        expires_in: tokens.expires_in
      });
      
      return tokens;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      throw error;
    }
  }

  static getAuthUrl(state?: string): string {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    
    console.log('Auth URL config check:', {
      clientId: clientId ? 'SET' : 'NOT SET',
      redirectUri: redirectUri ? 'SET' : 'NOT SET'
    });
    
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

    console.log('Generated Google Ads auth URL:', authUrl.toString());
    return authUrl.toString();
  }
}

export async function createGoogleConnectionStandard(
  userId: string,
  accessToken: string,
  refreshToken: string,
  customerId: string
): Promise<Connection> {
  const googleAPI = new GoogleAdsAPIStandard(accessToken);
  
  // Validar token
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
