import { Connection } from '@prisma/client';

// VERSAO PARA DEVELOPER TOKEN BASICO
// Esta versao funciona apenas com contas do mesmo Customer ID manager

export class GoogleAdsAPIBasic {
  private baseUrl = 'https://googleads.googleapis.com/v17';
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
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'developer-token': this.developerToken,
      'Content-Type': 'application/json',
    };

    // Para token basico, sempre usar o manager customer ID
    if (this.managerCustomerId) {
      headers['login-customer-id'] = this.managerCustomerId;
    }

    console.log(`Google Ads API Request (BASIC): ${method} ${url}`);
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

  // Para token basico, listar contas gerenciadas especificas
  async getManagerCustomers(): Promise<any[]> {
    try {
      console.log('Fetching manager customers (BASIC TOKEN)...');
      
      const query = `
        SELECT
          customer_client.id,
          customer_client.descriptive_name,
          customer_client.currency_code,
          customer_client.time_zone,
          customer_client.status
        FROM customer_client
        WHERE customer_client.status = 'ENABLED'
      `;

      const response = await this.makeRequest(
        `/customers/${this.managerCustomerId}/googleAds:search`,
        { query },
        'POST'
      );

      if (response.results) {
        return response.results.map((result: any) => ({
          id: result.customer_client.id,
          name: result.customer_client.descriptive_name || `Customer ${result.customer_client.id}`,
          currency_code: result.customer_client.currency_code,
          status: result.customer_client.status,
          time_zone: result.customer_client.time_zone,
          descriptive_name: result.customer_client.descriptive_name
        }));
      }

      return [];
    } catch (error) {
      console.error('Error fetching manager customers:', error);
      
      // Fallback: retornar apenas o manager customer
      return [{
        id: this.managerCustomerId,
        name: `Manager Account ${this.managerCustomerId}`,
        currency_code: 'USD',
        status: 'ENABLED',
        time_zone: 'UTC'
      }];
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.getManagerCustomers();
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getCampaigns(customerId: string): Promise<any[]> {
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
        'POST'
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
}

// Funcao para verificar se pode usar token basico
export function canUseBasicToken(): boolean {
  const managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  return !!managerCustomerId;
}

// Funcao para criar conexao com token basico
export async function createGoogleConnectionBasic(
  userId: string,
  accessToken: string,
  refreshToken: string
): Promise<Connection> {
  const googleAPI = new GoogleAdsAPIBasic(accessToken);
  
  // Validar token
  const isValid = await googleAPI.validateToken();
  if (!isValid) {
    throw new Error('Invalid Google Ads access token');
  }

  // Usar o manager customer ID como conta principal
  const managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
  
  const connectionData = {
    userId,
    platform: 'GOOGLE' as const,
    accountId: managerCustomerId,
    accountName: `Google Ads Manager ${managerCustomerId}`,
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora
    isActive: true
  };

  return connectionData as Connection;
}
