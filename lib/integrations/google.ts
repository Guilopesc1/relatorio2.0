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

export class GoogleAdsAPI {
  private baseUrl = 'https://googleads.googleapis.com/v20';
  private accessToken: string;
  private developerToken: string;
  private customerId?: string;

  constructor(accessToken: string, customerId?: string) {
    this.accessToken = accessToken;
    this.developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
    this.customerId = customerId;
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
    };

    // Adicionar customer ID se fornecido
    // TEMPORARIAMENTE REMOVIDO PARA DEBUG
    // if (customerId || this.customerId) {
    //   headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
    // }

    console.log(`Google Ads API Request: ${method} ${url}`);
    console.log('Headers:', JSON.stringify(headers, null, 2));

    try {
      const options: RequestInit = {
        method,
        headers,
      };

      if (body && method === 'POST') {
        options.body = JSON.stringify(body);
        console.log('Request Body:', JSON.stringify(body, null, 2));
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
      console.log('Google Ads API Response:', JSON.stringify(data, null, 2));
      return data;
    } catch (error) {
      console.error('Google Ads API Request Failed:', error);
      throw error;
    }
  }

  async getAccessibleCustomers(): Promise<{ customer_ids: string[] }> {
    try {
      console.log('Fetching accessible customers...');
      console.log('Developer token:', this.developerToken ? 'SET' : 'NOT SET');
      console.log('Access token (first 20 chars):', this.accessToken.substring(0, 20) + '...');
      
      const response = await this.makeRequest('/customers:listAccessibleCustomers', {}, 'POST');
      console.log('Accessible customers response:', response);
      return response;
    } catch (error) {
      console.error('Error fetching accessible customers:', error);
      throw new Error('Failed to fetch accessible Google Ads customers');
    }
  }

  async getCustomerDetails(customerId: string): Promise<GoogleAdAccount> {
    try {
      // Remover hífens do customer ID para as requisições
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

  async getCampaigns(customerId: string): Promise<GoogleCampaign[]> {
    try {
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

  async getAds(customerId: string, adGroupId?: string): Promise<GoogleAd[]> {
    try {
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      let query = `
        SELECT
          ad_group_ad.ad.id,
          ad_group_ad.ad.name,
          ad_group_ad.status,
          ad_group_ad.ad_group,
          ad_group_ad.ad.type,
          ad_group_ad.ad.final_urls
        FROM ad_group_ad
        WHERE ad_group_ad.status != 'REMOVED'
      `;

      if (adGroupId) {
        query += ` AND ad_group_ad.ad_group = 'customers/${cleanCustomerId}/adGroups/${adGroupId}'`;
      }

      query += ` ORDER BY ad_group_ad.ad.name`;

      const response = await this.makeRequest(
        `/customers/${cleanCustomerId}/googleAds:search`,
        { query },
        'POST',
        cleanCustomerId
      );

      return (response.results || []).map((result: any) => ({
        id: result.ad_group_ad.ad.id,
        name: result.ad_group_ad.ad.name,
        status: result.ad_group_ad.status,
        ad_group_id: result.ad_group_ad.ad_group.split('/').pop(),
        type: result.ad_group_ad.ad.type,
        final_urls: result.ad_group_ad.ad.final_urls || []
      }));
    } catch (error) {
      console.error('Error fetching ads:', error);
      throw new Error('Failed to fetch Google Ads ads');
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
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      let fromClause = '';
      let whereClause = 'WHERE segments.date >= $1 AND segments.date <= $2';
      
      switch (level) {
        case 'customer':
          fromClause = 'customer';
          break;
        case 'campaign':
          fromClause = 'campaign';
          if (resourceId) {
            whereClause += ` AND campaign.id = ${resourceId}`;
          }
          break;
        case 'ad_group':
          fromClause = 'ad_group';
          if (resourceId) {
            whereClause += ` AND ad_group.id = ${resourceId}`;
          }
          break;
        case 'ad':
          fromClause = 'ad_group_ad';
          if (resourceId) {
            whereClause += ` AND ad_group_ad.ad.id = ${resourceId}`;
          }
          break;
      }

      const query = `
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
        ${resourceId && level !== 'customer' ? `AND ${level === 'campaign' ? 'campaign' : level === 'ad_group' ? 'ad_group' : 'ad_group_ad.ad'}.id = ${resourceId}` : ''}
        ORDER BY segments.date
      `;

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
    
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    console.log('Auth URL config check:', {
      clientId: clientId ? 'SET' : 'NOT SET',
      redirectUri: redirectUri ? 'SET' : 'NOT SET'
    });
    
    if (!clientId || !redirectUri) {
      throw new Error('Missing Google OAuth configuration: CLIENT_ID or REDIRECT_URI');
    }
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    
    // CONFIGURAÇÃO CORRETA PARA GOOGLE ADS API
    authUrl.searchParams.append('client_id', clientId);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    
    // SCOPE CORRETO: Especificar explicitamente o scope do Google Ads
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/adwords');
    
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('access_type', 'offline'); // Para receber refresh token
    authUrl.searchParams.append('prompt', 'consent'); // Força consentimento para refresh token
    authUrl.searchParams.append('include_granted_scopes', 'true'); // Incluir scopes já concedidos
    
    if (state) {
      authUrl.searchParams.append('state', state);
    }

    console.log('Generated Google Ads auth URL:', authUrl.toString());
    return authUrl.toString();
  }
}

export async function createGoogleConnection(
  userId: string,
  accessToken: string,
  refreshToken: string,
  customerId: string
): Promise<Connection> {
  const googleAPI = new GoogleAdsAPI(accessToken, customerId);
  
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
