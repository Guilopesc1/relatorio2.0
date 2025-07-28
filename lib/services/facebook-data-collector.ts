import { FacebookAdsAPI } from '@/lib/integrations/facebook';
import { SupabaseConnectionService } from '@/lib/services/supabase-connection-service';

interface RetryOptions {
  maxRetries: number;
  backoffMultiplier: number;
  baseDelay: number;
}

const defaultRetryOptions: RetryOptions = {
  maxRetries: 3,
  backoffMultiplier: 2,
  baseDelay: 1000 // 1 segundo
};

export class FacebookDataCollector {
  
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = defaultRetryOptions
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === options.maxRetries) {
          break;
        }
        
        // Calcular delay com backoff exponencial
        const delay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt);
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  static async collectAccountData(
    userId: string, 
    connectionId: string,
    dateStart: string,
    dateStop: string
  ) {
    try {
      // Buscar conexão
      const connection = await SupabaseConnectionService.getConnection(userId, connectionId);
      if (!connection) {
        throw new Error('Connection not found');
      }

      // Validar token
      const isTokenValid = await SupabaseConnectionService.validateTokenExpiration(connectionId);
      if (!isTokenValid) {
        throw new Error('Token expired');
      }

      const facebookAPI = new FacebookAdsAPI(connection.accessToken);

      // Coletar dados com retry
      const campaigns = await this.withRetry(() => 
        facebookAPI.getCampaigns(connection.accountId)
      );

      const campaignsWithData = await Promise.all(
        campaigns.map(async (campaign) => {
          try {
            // Buscar insights da campanha
            const insights = await this.withRetry(() => 
              facebookAPI.getInsights(campaign.id, dateStart, dateStop, 'campaign')
            );

            // Buscar ad sets
            const adSets = await this.withRetry(() => 
              facebookAPI.getAdSets(campaign.id)
            );

            const adSetsWithData = await Promise.all(
              adSets.map(async (adSet) => {
                try {
                  const adSetInsights = await this.withRetry(() => 
                    facebookAPI.getInsights(adSet.id, dateStart, dateStop, 'adset')
                  );

                  // Buscar ads
                  const ads = await this.withRetry(() => 
                    facebookAPI.getAds(adSet.id)
                  );

                  const adsWithData = await Promise.all(
                    ads.map(async (ad) => {
                      try {
                        const adInsights = await this.withRetry(() => 
                          facebookAPI.getInsights(ad.id, dateStart, dateStop, 'ad')
                        );

                        return {
                          ...ad,
                          insights: adInsights[0] || null
                        };
                      } catch (error) {
                        console.error(`Error collecting data for ad ${ad.id}:`, error);
                        return {
                          ...ad,
                          insights: null,
                          error: error instanceof Error ? error.message : 'Unknown error'
                        };
                      }
                    })
                  );

                  return {
                    ...adSet,
                    insights: adSetInsights[0] || null,
                    ads: adsWithData
                  };
                } catch (error) {
                  console.error(`Error collecting data for adset ${adSet.id}:`, error);
                  return {
                    ...adSet,
                    insights: null,
                    ads: [],
                    error: error instanceof Error ? error.message : 'Unknown error'
                  };
                }
              })
            );

            return {
              ...campaign,
              insights: insights[0] || null,
              adSets: adSetsWithData
            };
          } catch (error) {
            console.error(`Error collecting data for campaign ${campaign.id}:`, error);
            return {
              ...campaign,
              insights: null,
              adSets: [],
              error: error instanceof Error ? error.message : 'Unknown error'
            };
          }
        })
      );

      return {
        connection: {
          id: connection.id,
          platform: connection.platform,
          accountId: connection.accountId,
          accountName: connection.accountName
        },
        dateRange: {
          start: dateStart,
          end: dateStop
        },
        campaigns: campaignsWithData,
        collectedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('Facebook data collection error:', error);
      throw error;
    }
  }

  static async collectMultipleAccounts(
    userId: string,
    connectionIds: string[],
    dateStart: string,
    dateStop: string
  ) {
    const results = await Promise.allSettled(
      connectionIds.map(connectionId => 
        this.collectAccountData(userId, connectionId, dateStart, dateStop)
      )
    );

    const successfulCollections = results
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value);

    const failedCollections = results
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => ({
        error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
        reason: result.reason
      }));

    return {
      successful: successfulCollections,
      failed: failedCollections,
      summary: {
        total: connectionIds.length,
        successful: successfulCollections.length,
        failed: failedCollections.length
      }
    };
  }

  static normalizeInsights(insights: any) {
    if (!insights) return null;

    return {
      dateStart: insights.date_start,
      dateStop: insights.date_stop,
      spend: parseFloat(insights.spend || '0'),
      impressions: parseInt(insights.impressions || '0'),
      clicks: parseInt(insights.clicks || '0'),
      ctr: parseFloat(insights.ctr || '0'),
      cpm: parseFloat(insights.cpm || '0'),
      cpc: parseFloat(insights.cpc || '0'),
      conversions: parseInt(insights.conversions || '0'),
      costPerConversion: parseFloat(insights.cost_per_conversion || '0'),
      reach: parseInt(insights.reach || '0'),
      frequency: parseFloat(insights.frequency || '0')
    };
  }

  static calculateAggregatedMetrics(data: any[]) {
    if (!data.length) return null;

    const totals = data.reduce((acc, item) => {
      const insights = this.normalizeInsights(item.insights);
      if (insights) {
        acc.spend += insights.spend;
        acc.impressions += insights.impressions;
        acc.clicks += insights.clicks;
        acc.conversions += insights.conversions;
        acc.reach += insights.reach;
      }
      return acc;
    }, {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      reach: 0
    });

    // Calcular métricas derivadas
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const costPerConversion = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const conversionRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;

    return {
      ...totals,
      ctr: Number(ctr.toFixed(2)),
      cpm: Number(cpm.toFixed(2)),
      cpc: Number(cpc.toFixed(2)),
      costPerConversion: Number(costPerConversion.toFixed(2)),
      conversionRate: Number(conversionRate.toFixed(2))
    };
  }
}
