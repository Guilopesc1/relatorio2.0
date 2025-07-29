import { GoogleAdsAPIStandard } from '@/lib/integrations/google-ads-standard';
import { SupabaseConnectionService } from './supabase-connection-service';

export class GoogleDataCollector {
  static async collectAccountData(
    userId: string,
    connectionId: string,
    dateStart: string,
    dateStop: string
  ) {
    // Buscar conexão
    const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
    
    if (!connection || connection.platform !== 'GOOGLE') {
      throw new Error('Google connection not found');
    }

    // Verificar se token ainda é válido e renovar se necessário
    let accessToken = connection.accessToken;
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      try {
        const newTokens = await GoogleAdsAPIStandard.refreshAccessToken(connection.refreshToken!);
        accessToken = newTokens.access_token;
        
        // Atualizar conexão com novo token
        await SupabaseConnectionService.updateConnection(connectionId, {
          accessToken: newTokens.access_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
        });
      } catch (refreshError) {
        throw new Error('Token expired and refresh failed. Please reconnect your Google account.');
      }
    }

    const googleAPI = new GoogleAdsAPIStandard(accessToken, connection.accountId);

    try {
      // Buscar dados básicos da conta
      const [campaigns, metrics] = await Promise.all([
        googleAPI.getCampaigns(connection.accountId),
        googleAPI.getMetrics(connection.accountId, dateStart, dateStop, 'customer')
      ]);

      // Calcular métricas totais
      const totalMetrics = metrics.reduce((acc, metric) => ({
        totalSpend: acc.totalSpend + (parseFloat(metric.cost_micros) / 1000000),
        totalImpressions: acc.totalImpressions + parseInt(metric.impressions),
        totalClicks: acc.totalClicks + parseInt(metric.clicks),
        totalConversions: acc.totalConversions + parseFloat(metric.conversions)
      }), {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0
      });

      // Calcular métricas derivadas
      const avgCtr = totalMetrics.totalImpressions > 0 
        ? (totalMetrics.totalClicks / totalMetrics.totalImpressions) * 100 
        : 0;
      
      const avgCpc = totalMetrics.totalClicks > 0 
        ? totalMetrics.totalSpend / totalMetrics.totalClicks 
        : 0;
      
      const costPerConversion = totalMetrics.totalConversions > 0 
        ? totalMetrics.totalSpend / totalMetrics.totalConversions 
        : 0;

      return {
        account: {
          id: connection.accountId,
          name: connection.accountName,
          platform: 'GOOGLE'
        },
        campaigns: campaigns.slice(0, 10), // Primeiras 10 campanhas
        totalCampaigns: campaigns.length,
        metrics: {
          ...totalMetrics,
          avgCtr,
          avgCpc,
          costPerConversion
        },
        dateRange: {
          start: dateStart,
          end: dateStop
        },
        collectedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error collecting Google Ads data:', error);
      throw new Error(`Failed to collect Google Ads data: ${error}`);
    }
  }

  static async collectMultipleAccounts(
    userId: string,
    connectionIds: string[],
    dateStart: string,
    dateStop: string
  ) {
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const connectionId of connectionIds) {
      try {
        const data = await this.collectAccountData(userId, connectionId, dateStart, dateStop);
        results.push({
          connectionId,
          success: true,
          data
        });
        successful++;
      } catch (error) {
        results.push({
          connectionId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        failed++;
      }
    }

    return {
      summary: {
        total: connectionIds.length,
        successful,
        failed
      },
      results,
      collectedAt: new Date().toISOString()
    };
  }

  static async getCampaignDetails(
    userId: string,
    connectionId: string,
    campaignId: string,
    dateStart: string,
    dateStop: string
  ) {
    const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
    
    if (!connection || connection.platform !== 'GOOGLE') {
      throw new Error('Google connection not found');
    }

    // Verificar e renovar token se necessário
    let accessToken = connection.accessToken;
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      try {
        const newTokens = await GoogleAdsAPIStandard.refreshAccessToken(connection.refreshToken!);
        accessToken = newTokens.access_token;
        
        await SupabaseConnectionService.updateConnection(connectionId, {
          accessToken: newTokens.access_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
        });
      } catch (refreshError) {
        throw new Error('Token expired and refresh failed');
      }
    }

    const googleAPI = new GoogleAdsAPIStandard(accessToken, connection.accountId);

    try {
      const [adGroups, campaignMetrics] = await Promise.all([
        googleAPI.getAdGroups(connection.accountId, campaignId),
        googleAPI.getMetrics(connection.accountId, dateStart, dateStop, 'campaign', campaignId)
      ]);

      return {
        campaignId,
        adGroups,
        metrics: campaignMetrics,
        dateRange: { start: dateStart, end: dateStop },
        collectedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to collect campaign details: ${error}`);
    }
  }

  static async getAdGroupDetails(
    userId: string,
    connectionId: string,
    adGroupId: string,
    dateStart: string,
    dateStop: string
  ) {
    const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
    
    if (!connection || connection.platform !== 'GOOGLE') {
      throw new Error('Google connection not found');
    }

    // Verificar e renovar token se necessário
    let accessToken = connection.accessToken;
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      try {
        const newTokens = await GoogleAdsAPIStandard.refreshAccessToken(connection.refreshToken!);
        accessToken = newTokens.access_token;
        
        await SupabaseConnectionService.updateConnection(connectionId, {
          accessToken: newTokens.access_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
        });
      } catch (refreshError) {
        throw new Error('Token expired and refresh failed');
      }
    }

    const googleAPI = new GoogleAdsAPIStandard(accessToken, connection.accountId);

    try {
      const [ads, adGroupMetrics] = await Promise.all([
        googleAPI.getAds(connection.accountId, adGroupId),
        googleAPI.getMetrics(connection.accountId, dateStart, dateStop, 'ad_group', adGroupId)
      ]);

      return {
        adGroupId,
        ads,
        metrics: adGroupMetrics,
        dateRange: { start: dateStart, end: dateStop },
        collectedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to collect ad group details: ${error}`);
    }
  }
}
