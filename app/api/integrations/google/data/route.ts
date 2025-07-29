import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { GoogleAdsAPIFixed } from '@/lib/integrations/google-ads-fixed';
import { GoogleDataCollectorFixed } from '@/lib/services/google-data-collector-fixed';
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

    console.log(`🚀 Google data request:`, {
      connectionId,
      dataType,
      dateRange: dateStart && dateStop ? `${dateStart} to ${dateStop}` : 'Not specified',
      campaignId,
      adGroupId
    });

    if (!connectionId || !dataType) {
      return NextResponse.json(
        { error: 'Connection ID and data type are required' }, 
        { status: 400 }
      );
    }

    let data;

    switch (dataType) {
      case 'diagnosis':
        // Novo endpoint para diagnóstico
        console.log('🔍 Running connection diagnosis...');
        data = await GoogleDataCollectorFixed.diagnoseGoogleConnection(
          session.user.id,
          connectionId
        );
        break;

      case 'campaigns':
        console.log('📋 Fetching campaigns...');
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
            return NextResponse.json({ 
              error: 'Token expired and refresh failed. Please reconnect your Google account.' 
            }, { status: 401 });
          }
        }

        const googleAPI = new GoogleAdsAPIFixed(accessToken);
        data = await googleAPI.getCampaigns(connection.accountId);
        break;

      case 'metrics':
        console.log('📊 Fetching metrics...');
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
            const newTokens = await GoogleAdsAPIFixed.refreshAccessToken(metricsConnection.refreshToken!);
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

        const metricsGoogleAPI = new GoogleAdsAPIFixed(metricsAccessToken);
        data = await metricsGoogleAPI.getMetrics(
          metricsConnection.accountId,
          dateStart,
          dateStop,
          level,
          resourceId
        );
        break;

      case 'account_overview':
        console.log('📈 Fetching account overview...');
        // Usar GoogleDataCollectorFixed para overview completo
        data = await GoogleDataCollectorFixed.collectAccountData(
          session.user.id,
          connectionId,
          dateStart || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          dateStop || new Date().toISOString().split('T')[0]
        );
        break;

      case 'campaign_details':
        console.log('🔍 Fetching campaign details...');
        if (!campaignId) {
          return NextResponse.json(
            { error: 'Campaign ID is required for campaign details' }, 
            { status: 400 }
          );
        }
        
        data = await GoogleDataCollectorFixed.getCampaignDetails(
          session.user.id,
          connectionId,
          campaignId,
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

    console.log(`✅ Google data request completed successfully for type: ${dataType}`);

    return NextResponse.json({
      success: true,
      data,
      meta: {
        connectionId,
        dataType,
        timestamp: new Date().toISOString(),
        userId: session.user.id
      }
    });

  } catch (error) {
    console.error('❌ Google data fetch error:', error);
    
    if (error instanceof Error) {
      // Melhor tratamento de erros específicos
      if (error.message.includes('HTML instead of JSON')) {
        return NextResponse.json({ 
          error: 'Authentication error: Google Ads API returned HTML instead of JSON. Please check your configuration and try reconnecting.',
          type: 'AUTHENTICATION_ERROR',
          details: error.message
        }, { status: 400 });
      }
      
      if (error.message.includes('DEVELOPER_TOKEN_NOT_APPROVED')) {
        return NextResponse.json({ 
          error: 'Developer token not approved. For production use, request a standard developer token from Google Ads.',
          type: 'DEVELOPER_TOKEN_ERROR',
          details: error.message
        }, { status: 400 });
      }
      
      if (error.message.includes('PERMISSION_DENIED')) {
        return NextResponse.json({ 
          error: 'Permission denied. Check if your Google Ads account has API access enabled.',
          type: 'PERMISSION_ERROR',
          details: error.message
        }, { status: 403 });
      }
      
      return NextResponse.json({ 
        error: error.message,
        type: 'API_ERROR'
      }, { status: 400 });
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch Google Ads data',
        type: 'UNKNOWN_ERROR'
      }, 
      { status: 500 }
    );
  }
}
