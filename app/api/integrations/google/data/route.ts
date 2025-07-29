import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { GoogleAdsAPIStandard } from '@/lib/integrations/google-ads-standard';
import { GoogleDataCollector } from '@/lib/services/google-data-collector';
import { SupabaseConnectionService } from '@/lib/services/supabase-connection-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      connectionId, 
      dataType, 
      dateStart, 
      dateStop,
      campaignId,
      adGroupId 
    } = body;

    if (!connectionId || !dataType) {
      return NextResponse.json(
        { error: 'Connection ID and data type are required' }, 
        { status: 400 }
      );
    }

    let data;

    switch (dataType) {
      case 'campaigns':
        // Buscar conexão e validar token
        const connection = await SupabaseConnectionService.getConnection(
          session.user.id, 
          connectionId
        );

        if (!connection || connection.platform !== 'GOOGLE') {
          return NextResponse.json({ error: 'Google connection not found' }, { status: 404 });
        }

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
            return NextResponse.json({ 
              error: 'Token expired and refresh failed. Please reconnect your Google account.' 
            }, { status: 401 });
          }
        }

        const googleAPI = new GoogleAdsAPIStandard(accessToken, connection.accountId);
        data = await googleAPI.getCampaigns(connection.accountId);
        break;

      case 'adgroups':
        data = await GoogleDataCollector.getCampaignDetails(
          session.user.id,
          connectionId,
          campaignId!,
          dateStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dateStop || new Date().toISOString().split('T')[0]
        );
        break;

      case 'ads':
        data = await GoogleDataCollector.getAdGroupDetails(
          session.user.id,
          connectionId,
          adGroupId!,
          dateStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dateStop || new Date().toISOString().split('T')[0]
        );
        break;

      case 'metrics':
        if (!dateStart || !dateStop) {
          return NextResponse.json(
            { error: 'Date range is required for metrics' }, 
            { status: 400 }
          );
        }
        
        const level = adGroupId ? 'ad_group' : campaignId ? 'campaign' : 'customer';
        const resourceId = adGroupId || campaignId;
        
        // Similar logic to campaigns case for token validation
        const metricsConnection = await SupabaseConnectionService.getConnection(
          session.user.id, 
          connectionId
        );
        
        if (!metricsConnection || metricsConnection.platform !== 'GOOGLE') {
          return NextResponse.json({ error: 'Google connection not found' }, { status: 404 });
        }

        let metricsAccessToken = metricsConnection.accessToken;
        if (metricsConnection.expiresAt && metricsConnection.expiresAt < new Date()) {
          try {
            const newTokens = await GoogleAdsAPIStandard.refreshAccessToken(metricsConnection.refreshToken!);
            metricsAccessToken = newTokens.access_token;
            
            await SupabaseConnectionService.updateConnection(connectionId, {
              accessToken: newTokens.access_token,
              expiresAt: new Date(Date.now() + newTokens.expires_in * 1000)
            });
          } catch (refreshError) {
            return NextResponse.json({ 
              error: 'Token expired and refresh failed. Please reconnect your Google account.' 
            }, { status: 401 });
          }
        }

        const metricsGoogleAPI = new GoogleAdsAPIStandard(metricsAccessToken, metricsConnection.accountId);
        data = await metricsGoogleAPI.getMetrics(
          metricsConnection.accountId,
          dateStart,
          dateStop,
          level,
          resourceId
        );
        break;

      case 'account_overview':
        // Usar GoogleDataCollector para overview completo
        data = await GoogleDataCollector.collectAccountData(
          session.user.id,
          connectionId,
          dateStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dateStop || new Date().toISOString().split('T')[0]
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported data type: ${dataType}` }, 
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      data,
      meta: {
        connectionId,
        dataType,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Google data fetch error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch Google Ads data' }, 
      { status: 500 }
    );
  }
}
