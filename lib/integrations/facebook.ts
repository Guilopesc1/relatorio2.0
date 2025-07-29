import { Connection } from '@prisma/client';

export interface FacebookAdAccount {
  id: string;
  name: string;
  currency: string;
  account_status: number;
  business_name?: string;
}

export interface FacebookCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  created_time: string;
  start_time?: string;
  stop_time?: string;
  account_id: string;
}

export interface FacebookAdSet {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  created_time: string;
  start_time?: string;
  end_time?: string;
  daily_budget?: number;
  lifetime_budget?: number;
}

export interface FacebookAd {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  created_time: string;
}

export interface FacebookInsights {
  date_start: string;
  date_stop: string;
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;
  conversions?: string;
  cost_per_conversion?: string;
  reach?: string;
  frequency?: string;
}

export class FacebookAdsAPI {
  private baseUrl = 'https://graph.facebook.com/v19.0';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}) {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Adicionar access_token aos parâmetros
    params.access_token = this.accessToken;
    
    // Adicionar parâmetros à URL
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) { 
        url.searchParams.append(key, params[key].toString());
      }
    });

    console.log(`Facebook API Request: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(`Facebook API Error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Facebook API Request Failed:', error);
      throw error;
    }
  }

async getAdAccounts(): Promise<FacebookAdAccount[]> {
  let url = '/me/adaccounts';
  const params = { fields: 'id,name,currency,account_status,business_name', limit: 500 };
  const accounts: FacebookAdAccount[] = [];

  do {
    const response = await this.makeRequest(url, params);
    accounts.push(...(response.data || []));
    url = response.paging?.next ? response.paging.next.replace(this.baseUrl, '') : '';
  } while (url);

  return accounts;
}


  async getCampaigns(accountId: string): Promise<FacebookCampaign[]> {
    try {
      const response = await this.makeRequest(`/${accountId}/campaigns`, {
        fields: 'id,name,status,objective,created_time,start_time,stop_time'
      });

      return response.data?.map((campaign: any) => ({
        ...campaign,
        account_id: accountId
      })) || [];
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      throw new Error('Failed to fetch Facebook campaigns');
    }
  }

  async getAdSets(campaignId: string): Promise<FacebookAdSet[]> {
    try {
      const response = await this.makeRequest(`/${campaignId}/adsets`, {
        fields: 'id,name,status,campaign_id,created_time,start_time,end_time,daily_budget,lifetime_budget'
      });

      return response.data || [];
    } catch (error) {
      console.error('Error fetching ad sets:', error);
      throw new Error('Failed to fetch Facebook ad sets');
    }
  }

  async getAds(adsetId: string): Promise<FacebookAd[]> {
    try {
      const response = await this.makeRequest(`/${adsetId}/ads`, {
        fields: 'id,name,status,adset_id,created_time'
      });

      return response.data || [];
    } catch (error) {
      console.error('Error fetching ads:', error);
      throw new Error('Failed to fetch Facebook ads');
    }
  }

  async getInsights(
    objectId: string, 
    dateStart: string, 
    dateStop: string,
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'campaign'
  ): Promise<FacebookInsights[]> {
    try {
      const fields = [
        'date_start',
        'date_stop',
        'spend',
        'impressions',
        'clicks',
        'ctr',
        'cpm',
        'cpc',
        'conversions',
        'cost_per_conversion',
        'reach',
        'frequency'
      ].join(',');

      const response = await this.makeRequest(`/${objectId}/insights`, {
        fields,
        time_range: JSON.stringify({
          since: dateStart,
          until: dateStop
        }),
        level,
        time_increment: 1 // Diário
      });

      return response.data || [];
    } catch (error) {
      console.error('Error fetching insights:', error);
      throw new Error('Failed to fetch Facebook insights');
    }
  }

  async validateToken(): Promise<boolean> {
    try {
      await this.makeRequest('/me', {
        fields: 'id,name'
      });
      return true;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  async getUserInfo() {
    try {
      const response = await this.makeRequest('/me', {
        fields: 'id,name,email'
      });
      return response;
    } catch (error) {
      console.error('Error fetching user info:', error);
      throw error;
    }
  }
}

export async function createFacebookConnection(
  userId: string,
  accessToken: string,
  accountId: string
): Promise<Connection> {
  const facebookAPI = new FacebookAdsAPI(accessToken);
  
  // Validar token
  const isValid = await facebookAPI.validateToken();
  if (!isValid) {
    throw new Error('Invalid Facebook access token');
  }

  // Buscar informações da conta
  const accounts = await facebookAPI.getAdAccounts();
  const account = accounts.find(acc => acc.id === accountId);
  
  if (!account) {
    throw new Error('Facebook ad account not found');
  }

  // Criar conexão no banco (isso será implementado na próxima parte)
  const connectionData = {
    userId,
    platform: 'FACEBOOK' as const,
    accountId: account.id,
    accountName: account.name,
    accessToken,
    refreshToken: null,
    expiresAt: null, // Facebook tokens não expiram por padrão
    isActive: true
  };

  return connectionData as Connection;
}
