import { prisma } from '@/lib/prisma';
import { Connection } from '@prisma/client';
import { PrismaConnectionService } from './prisma-connection-service';

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

// Service para gerenciar Facebook usando Prisma
export class PrismaFacebookService {
  
  static async createFacebookConnection(
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

    // Criar/atualizar conexão usando PrismaConnectionService
    const connection = await PrismaConnectionService.createConnection({
      userId,
      platform: 'FACEBOOK',
      accountId: account.id,
      accountName: account.name,
      accessToken,
      refreshToken: null,
      expiresAt: null, // Facebook tokens não expiram por padrão
    });

    return connection;
  }

  static async getFacebookAccounts(userId: string): Promise<FacebookAdAccount[]> {
    const connections = await PrismaConnectionService.getConnections(userId, 'FACEBOOK');
    
    if (connections.length === 0) {
      throw new Error('No Facebook connections found');
    }

    // Usar a primeira conexão para buscar contas (pode ser expandido para múltiplos tokens)
    const firstConnection = connections[0];
    const facebookAPI = new FacebookAdsAPI(firstConnection.accessToken);
    
    return await facebookAPI.getAdAccounts();
  }

  static async getFacebookCampaigns(
    userId: string, 
    accountId: string, 
    dateStart?: string, 
    dateStop?: string
  ): Promise<FacebookCampaign[]> {
    // Buscar conexão específica para esta conta
    const connection = await PrismaConnectionService.getConnectionByAccount(
      userId, 
      'FACEBOOK', 
      accountId
    );

    if (!connection) {
      throw new Error('Facebook connection not found for this account');
    }

    const facebookAPI = new FacebookAdsAPI(connection.accessToken);
    const campaigns = await facebookAPI.getCampaigns(accountId);

    // Salvar dados no cache do Facebook (usando as tabelas do Prisma)
    await this.cacheFacebookCampaigns(userId, accountId, campaigns);

    return campaigns;
  }

  static async getFacebookInsights(
    userId: string,
    accountId: string,
    objectId: string,
    dateStart: string,
    dateStop: string,
    level: 'account' | 'campaign' | 'adset' | 'ad' = 'campaign'
  ): Promise<FacebookInsights[]> {
    const connection = await PrismaConnectionService.getConnectionByAccount(
      userId, 
      'FACEBOOK', 
      accountId
    );

    if (!connection) {
      throw new Error('Facebook connection not found for this account');
    }

    const facebookAPI = new FacebookAdsAPI(connection.accessToken);
    const insights = await facebookAPI.getInsights(objectId, dateStart, dateStop, level);

    // Salvar métricas no cache
    await this.cacheFacebookMetrics(userId, accountId, objectId, insights, level);

    return insights;
  }

  // Métodos de cache usando as tabelas Facebook do Prisma
  private static async cacheFacebookCampaigns(
    userId: string, 
    accountId: string, 
    campaigns: FacebookCampaign[]
  ): Promise<void> {
    try {
      // Buscar FacebookAccount do usuário
      const facebookAccount = await prisma.facebookAccount.findFirst({
        where: {
          userId,
          accountId
        }
      });

      if (!facebookAccount) {
        console.log('Facebook account not found in cache, skipping campaign cache');
        return;
      }

      // Limpar campanhas antigas e inserir novas
      await prisma.facebookCampaignCache.deleteMany({
        where: {
          accountId: facebookAccount.id
        }
      });

      const campaignCacheData = campaigns.map(campaign => ({
        accountId: facebookAccount.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        createdTime: new Date(campaign.created_time),
        updatedTime: campaign.start_time ? new Date(campaign.start_time) : null
      }));

      await prisma.facebookCampaignCache.createMany({
        data: campaignCacheData
      });

      console.log(`Cached ${campaigns.length} Facebook campaigns`);

    } catch (error) {
      console.error('Error caching Facebook campaigns:', error);
      // Não lançar erro para não quebrar o fluxo principal
    }
  }

  private static async cacheFacebookMetrics(
    userId: string,
    accountId: string,
    objectId: string,
    insights: FacebookInsights[],
    level: string
  ): Promise<void> {
    try {
      const facebookAccount = await prisma.facebookAccount.findFirst({
        where: {
          userId,
          accountId
        }
      });

      if (!facebookAccount) {
        console.log('Facebook account not found in cache, skipping metrics cache');
        return;
      }

      // Mapear level para enum
      const objectType = level.toUpperCase() as any;

      const metricsData = insights.map(insight => ({
        accountId: facebookAccount.id,
        objectType,
        objectId,
        dateStart: new Date(insight.date_start),
        dateStop: new Date(insight.date_stop),
        impressions: BigInt(insight.impressions || '0'),
        clicks: BigInt(insight.clicks || '0'),
        spend: parseFloat(insight.spend || '0'),
        reach: insight.reach ? BigInt(insight.reach) : null,
        frequency: insight.frequency ? parseFloat(insight.frequency) : null,
        cpm: parseFloat(insight.cpm || '0'),
        cpc: parseFloat(insight.cpc || '0'),
        ctr: parseFloat(insight.ctr || '0'),
        cacheKey: `${objectId}_${insight.date_start}_${insight.date_stop}`
      }));

      // Usar upsert para evitar duplicatas
      for (const metricData of metricsData) {
        await prisma.facebookMetricCache.upsert({
          where: {
            accountId_cacheKey: {
              accountId: facebookAccount.id,
              cacheKey: metricData.cacheKey
            }
          },
          update: metricData,
          create: metricData
        });
      }

      console.log(`Cached ${insights.length} Facebook metrics for ${objectId}`);

    } catch (error) {
      console.error('Error caching Facebook metrics:', error);
    }
  }

  static async createFacebookAccount(
    userId: string,
    accountId: string,
    accountName: string,
    accessToken: string,
    permissions: string[]
  ) {
    return await prisma.facebookAccount.create({
      data: {
        userId,
        accountId,
        accountName,
        accessToken, // Deveria ser criptografado em produção
        permissions,
        status: 'ACTIVE',
        lastSync: new Date()
      }
    });
  }

  static async getFacebookAccountCache(userId: string, accountId: string) {
    return await prisma.facebookAccount.findFirst({
      where: {
        userId,
        accountId
      },
      include: {
        campaignsCache: {
          where: {
            isStale: false
          },
          orderBy: {
            campaignName: 'asc'
          }
        },
        metricsCache: {
          where: {
            isStale: false,
            cacheExpiresAt: {
              gt: new Date()
            }
          },
          orderBy: {
            dateStart: 'desc'
          },
          take: 100
        }
      }
    });
  }

  static async refreshFacebookConnection(userId: string, accountId: string): Promise<boolean> {
    try {
      const connection = await PrismaConnectionService.getConnectionByAccount(
        userId,
        'FACEBOOK',
        accountId
      );

      if (!connection) {
        return false;
      }

      const facebookAPI = new FacebookAdsAPI(connection.accessToken);
      const isValid = await facebookAPI.validateToken();

      if (!isValid) {
        // Desativar conexão se token inválido
        await PrismaConnectionService.updateConnection(connection.id, {
          isActive: false
        });
        return false;
      }

      // Atualizar timestamp da conexão
      await PrismaConnectionService.updateConnection(connection.id, {
        isActive: true
      });

      return true;

    } catch (error) {
      console.error('Error refreshing Facebook connection:', error);
      return false;
    }
  }

  static async invalidateFacebookCache(userId: string, accountId: string): Promise<void> {
    const facebookAccount = await prisma.facebookAccount.findFirst({
      where: {
        userId,
        accountId
      }
    });

    if (!facebookAccount) {
      return;
    }

    // Marcar cache como stale
    await Promise.all([
      prisma.facebookCampaignCache.updateMany({
        where: { accountId: facebookAccount.id },
        data: { isStale: true }
      }),
      prisma.facebookMetricCache.updateMany({
        where: { accountId: facebookAccount.id },
        data: { isStale: true }
      }),
      prisma.facebookCacheInvalidationLog.create({
        data: {
          accountId: facebookAccount.id,
          invalidationType: 'manual',
          invalidationScope: 'account',
          objectIds: [],
          reason: 'Manual cache invalidation'
        }
      })
    ]);

    console.log(`Invalidated Facebook cache for account ${accountId}`);
  }
}
