import { GoogleAdsAPIFixed } from '@/lib/integrations/google-ads-fixed';
import { SupabaseConnectionService } from './supabase-connection-service';

export class GoogleDataCollectorFixed {
  static async collectAccountData(
    userId: string,
    connectionId: string,
    dateStart: string,
    dateStop: string
  ) {
    console.log(`📊 Collecting account data for user ${userId}, connection ${connectionId}`);
    
    const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
    
    if (!connection || connection.platform !== 'GOOGLE') {
      throw new Error('Google connection not found');
    }

    // Verificar e renovar token se necessário
    let accessToken = connection.accessToken;
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      try {
        console.log('🔄 Refreshing expired token...');
        const newTokens = await GoogleAdsAPIFixed.refreshAccessToken(connection.refreshToken!);
        accessToken = newTokens.access_token;
        
        await SupabaseConnectionService.updateConnection(connectionId, {
          accessToken: newTokens.access_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
        });
        console.log('✅ Token refreshed successfully');
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError);
        throw new Error('Token expired and refresh failed. Please reconnect your Google account.');
      }
    }

    const googleAPI = new GoogleAdsAPIFixed(accessToken);

    try {
      // Buscar dados básicos da conta
      console.log('🔍 Fetching campaigns and metrics...');
      const [campaigns, metrics] = await Promise.all([
        googleAPI.getCampaigns(connection.accountId),
        googleAPI.getMetrics(connection.accountId, dateStart, dateStop, 'customer')
      ]);

      console.log(`📊 Found ${campaigns.length} campaigns and ${metrics.length} metric records`);

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
      console.error('❌ Error collecting Google Ads data:', error);
      throw new Error(`Failed to collect Google Ads data: ${error}`);
    }
  }

  static async collectMultipleAccounts(
    userId: string,
    connectionIds: string[],
    dateStart: string,
    dateStop: string
  ) {
    console.log(`📊 Collecting data for multiple accounts: ${connectionIds.length} connections`);
    
    const results = [];
    
    for (const connectionId of connectionIds) {
      try {
        const accountData = await this.collectAccountData(userId, connectionId, dateStart, dateStop);
        results.push(accountData);
      } catch (error) {
        console.error(`❌ Error collecting data for connection ${connectionId}:`, error);
        results.push({
          connectionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          collectedAt: new Date().toISOString()
        });
      }
    }

    return {
      accounts: results,
      totalAccounts: connectionIds.length,
      successfulAccounts: results.filter(r => !r.error).length,
      failedAccounts: results.filter(r => r.error).length,
      dateRange: { start: dateStart, end: dateStop },
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
    console.log(`🔍 Getting campaign details for campaign ${campaignId}`);
    
    const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
    
    if (!connection || connection.platform !== 'GOOGLE') {
      throw new Error('Google connection not found');
    }

    // Verificar e renovar token se necessário
    let accessToken = connection.accessToken;
    if (connection.expiresAt && connection.expiresAt < new Date()) {
      try {
        const newTokens = await GoogleAdsAPIFixed.refreshAccessToken(connection.refreshToken!);
        accessToken = newTokens.access_token;
        
        await SupabaseConnectionService.updateConnection(connectionId, {
          accessToken: newTokens.access_token,
          expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
        });
      } catch (refreshError) {
        throw new Error('Token expired and refresh failed');
      }
    }

    const googleAPI = new GoogleAdsAPIFixed(accessToken);

    try {
      // Buscar métricas da campanha
      const campaignMetrics = await googleAPI.getMetrics(
        connection.accountId, 
        dateStart, 
        dateStop, 
        'campaign', 
        campaignId
      );

      return {
        campaignId,
        metrics: campaignMetrics,
        dateRange: { start: dateStart, end: dateStop },
        collectedAt: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Failed to collect campaign details: ${error}`);
    }
  }

  // Método de diagnóstico público
  static async diagnoseGoogleConnection(
    userId: string,
    connectionId: string
  ) {
    console.log(`🔍 Diagnosing Google connection for user ${userId}, connection ${connectionId}`);
    
    const diagnosis = {
      connectionExists: false,
      connectionValid: false,
      tokenValid: false,
      accessibleCustomers: [] as string[],
      errors: [] as string[],
      recommendations: [] as string[]
    };

    try {
      // 1. Verificar se a conexão existe
      const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
      
      if (!connection) {
        diagnosis.errors.push('Connection not found in database');
        diagnosis.recommendations.push('Reconnect your Google Ads account');
        return diagnosis;
      }
      
      diagnosis.connectionExists = true;
      
      if (connection.platform !== 'GOOGLE') {
        diagnosis.errors.push('Connection is not a Google Ads connection');
        return diagnosis;
      }
      
      diagnosis.connectionValid = true;

      // 2. Verificar se o token está expirado
      if (connection.expiresAt && connection.expiresAt < new Date()) {
        diagnosis.errors.push('Access token is expired');
        diagnosis.recommendations.push('Token needs to be refreshed');
        
        // Tentar renovar o token
        try {
          console.log('🔄 Attempting to refresh expired token...');
          const newTokens = await GoogleAdsAPIFixed.refreshAccessToken(connection.refreshToken!);
          
          await SupabaseConnectionService.updateConnection(connectionId, {
            accessToken: newTokens.access_token,
            expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
          });
          
          diagnosis.recommendations.push('Token refreshed successfully');
        } catch (refreshError) {
          diagnosis.errors.push('Failed to refresh token');
          diagnosis.recommendations.push('Please reconnect your Google Ads account');
          return diagnosis;
        }
      }

      // 3. Testar a API
      const googleAPI = new GoogleAdsAPIFixed(connection.accessToken);
      
      try {
        const apiDiagnosis = await googleAPI.diagnoseConnection();
        diagnosis.tokenValid = apiDiagnosis.tokenValid;
        diagnosis.accessibleCustomers = apiDiagnosis.accessibleCustomers;
        diagnosis.errors.push(...apiDiagnosis.errors);
        
        if (apiDiagnosis.tokenValid) {
          diagnosis.recommendations.push('API connection is working correctly');
        } else {
          diagnosis.recommendations.push('Check your Google Ads account permissions');
        }
      } catch (apiError) {
        diagnosis.errors.push(`API test failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`);
        diagnosis.recommendations.push('Verify your Google Ads account has API access enabled');
      }

    } catch (error) {
      diagnosis.errors.push(`Diagnosis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return diagnosis;
  }
}
