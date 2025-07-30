// ================================
// API ENDPOINT: GET /api/facebook/metrics/detailed
// Coleta métricas detalhadas do Facebook Ads conforme query especificada
// ================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';
import { FacebookTokenManager, FacebookTokenLogger } from '@/lib/facebook/token-manager';

// Campos das métricas que serão coletadas (conforme sua especificação)
const DETAILED_METRICS_FIELDS = [
  'campaign_name',
  'campaign_id', 
  'adset_id',
  'adset_name',
  'ad_id',
  'ad_name',
  'date_start',
  'reach', 
  'impressions',
  'spend',
  'inline_link_clicks',
  'actions' // Este campo conterá as ações detalhadas
];

// Ações específicas que queremos extrair do campo 'actions'
const TARGET_ACTIONS = [
  'link_click',
  'video_view', 
  'video_p75_watched_actions',
  'landing_page_view',
  'offsite_conversion.fb_pixel_add_to_cart',
  'offsite_conversion.fb_pixel_initiate_checkout', 
  'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.messaging_conversation_started_7d',
  'offsite_conversion.fb_pixel_purchase',
  'offsite_conversion.fb_pixel_custom',
  'offsite_conversion.fb_pixel_complete_registration',
  'onsite_conversion.lead_grouped',
  'leadgen_other'
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const dateRange = searchParams.get('date_range') || 'last_7_days';
    const objectLevel = searchParams.get('level') || 'ad'; // campaign, adset, ad
    const forceRefresh = searchParams.get('force_refresh') === 'true';

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    console.log(`[DETAILED METRICS] Iniciando coleta para conta: ${accountId}, nível: ${objectLevel}, período: ${dateRange}`);

    // Buscar conexão do Facebook
    const connection = await prisma.connection.findFirst({
      where: { 
        userId: session.user.id, 
        platform: 'FACEBOOK', 
        accountId: accountId, 
        isActive: true 
      },
    });

    if (!connection || !connection.accessToken) {
      return NextResponse.json({ 
        error: 'Facebook connection not found or token is missing' 
      }, { status: 404 });
    }

    // Validar e renovar token se necessário usando o novo sistema
    console.log(`[FB TOKEN] Validando token para conexão ${connection.id}`);
    const tokenValidation = await FacebookTokenManager.ensureValidToken(connection.id);

    if (tokenValidation.error) {
      FacebookTokenLogger.logError(tokenValidation.error, 'Token validation failed', connection.id);
      
      // Marcar conexão como inativa se token for irrecuperável
      await FacebookTokenManager.markConnectionInactive(connection.id, tokenValidation.error);
      
      return NextResponse.json({ 
        error: 'Token do Facebook inválido', 
        details: tokenValidation.error,
        action_required: 'Por favor, reconecte sua conta do Facebook nas configurações',
        connection_id: connection.id
      }, { status: 401 });
    }

    const validToken = tokenValidation.token;
    
    // Log do status do token
    if (tokenValidation.isNew) {
      FacebookTokenLogger.logRefresh(connection.id, true);
      console.log(`[TOKEN] Token renovado automaticamente para conta ${accountId}`);
    } else {
      FacebookTokenLogger.logValidation(connection.id, true);
      console.log(`[TOKEN] Token válido para conta ${accountId}`);
    }

    // Garantir que a conta Facebook existe no nosso banco
    const facebookAccount = await prisma.facebookAccount.upsert({
      where: {
        userId_accountId: {
          userId: session.user.id,
          accountId: accountId,
        },
      },
      update: { 
        accountName: connection.accountName, 
        accessToken: validToken,
        lastSync: new Date()
      },
      create: {
        userId: session.user.id,
        accountId: accountId,
        accountName: connection.accountName,
        accessToken: validToken,
        permissions: '[]',
      },
    });

    // Gerar chave de cache única
    const cacheKey = `detailed-${objectLevel}-${dateRange}-${Date.now()}`;
    
    // Verificar cache se não forçar refresh
    if (!forceRefresh) {
      const cachedData = await prisma.facebookDetailedMetrics.findFirst({
        where: {
          accountId: facebookAccount.id,
          cacheExpiresAt: { gt: new Date() },
          isStale: false
        },
        orderBy: { cacheCreatedAt: 'desc' }
      });

      if (cachedData) {
        console.log(`[CACHE HIT] Retornando dados em cache para: ${cacheKey}`);
        return NextResponse.json({ 
          success: true, 
          data: [cachedData],
          meta: { 
            fromCache: true,
            account_name: connection.accountName,
            total_records: 1
          } 
        });
      }
    }

    console.log(`[CACHE MISS] Buscando dados do Facebook API para: ${cacheKey}`);
    
    // Inicializar Facebook Ads API com token validado
    FacebookTokenLogger.logApiCall(`Inicializando Facebook Ads API para conta ${accountId}`, connection.id);
    FacebookAdsApi.init(validToken);
    const adAccount = new AdAccount(accountId);

    // Parâmetros para a consulta
    const params = {
      date_preset: dateRange,
      level: objectLevel,
      action_breakdowns: ['action_type'],
      time_increment: 1, // Dados diários
      limit: 1000
    };

    console.log(`[FB API] Fazendo requisição com parâmetros:`, { fields: DETAILED_METRICS_FIELDS, params });

    // Fazer requisição para Facebook Ads API
    const insights = await adAccount.getInsights(DETAILED_METRICS_FIELDS, params);

    if (!insights || insights.length === 0) {
      console.log(`[FB API] Nenhum dado encontrado para os parâmetros fornecidos`);
      return NextResponse.json({ 
        success: true, 
        data: [], 
        message: "Nenhum dado encontrado para o período especificado." 
      });
    }

    console.log(`[FB API] Recebidos ${insights.length} registros do Facebook`);

    // Processar e salvar os dados
    const processedData = [];
    const cacheExpiresAt = new Date(new Date().getTime() + 4 * 60 * 60 * 1000); // 4 horas

    for (let i = 0; i < insights.length; i++) {
      const rawData = insights[i];
      
      // Processar ações (conversões)
      const actionsData = rawData.actions || [];
      const extractedActions: any = {};
      
      // Extrair ações específicas
      TARGET_ACTIONS.forEach(actionType => {
        const action = actionsData.find((a: any) => a.action_type === actionType);
        extractedActions[actionType] = action ? parseInt(action.value) : null;
      });

      // Preparar dados para salvamento
      const dataToSave = {
        accountId: facebookAccount.id,
        campaignName: rawData.campaign_name || null,
        campaignId: rawData.campaign_id || null,
        adSetId: rawData.adset_id || null,
        adSetName: rawData.adset_name || null,
        adId: rawData.ad_id || null,
        adName: rawData.ad_name || null,
        dateStart: new Date(rawData.date_start),
        dateStop: rawData.date_stop ? new Date(rawData.date_stop) : null,
        
        // Métricas básicas
        reach: rawData.reach ? parseInt(rawData.reach) : null,
        impressions: rawData.impressions ? parseInt(rawData.impressions) : null,
        spend: rawData.spend ? parseFloat(rawData.spend) : null,
        
        // Cliques
        inlineLinkClicks: rawData.inline_link_clicks ? parseInt(rawData.inline_link_clicks) : null,
        linkClick: extractedActions['link_click'],
        
        // Vídeo
        videoView: extractedActions['video_view'],
        videoP75WatchedActions: extractedActions['video_p75_watched_actions'],
        
        // Landing Page
        landingPageView: extractedActions['landing_page_view'],
        
        // E-commerce
        offsiteConversionFbPixelAddToCart: extractedActions['offsite_conversion.fb_pixel_add_to_cart'],
        offsiteConversionFbPixelInitiateCheckout: extractedActions['offsite_conversion.fb_pixel_initiate_checkout'],
        offsiteConversionFbPixelPurchase: extractedActions['offsite_conversion.fb_pixel_purchase'],
        offsiteConversionFbPixelCompleteRegistration: extractedActions['offsite_conversion.fb_pixel_complete_registration'],
        offsiteConversionFbPixelCustom: extractedActions['offsite_conversion.fb_pixel_custom'],
        
        // Leads
        offsiteConversionFbPixelLead: extractedActions['offsite_conversion.fb_pixel_lead'],
        onsiteConversionLeadGrouped: extractedActions['onsite_conversion.lead_grouped'],
        leadgenOther: extractedActions['leadgen_other'],
        
        // Messaging
        onsiteConversionMessagingConversationStarted7d: extractedActions['onsite_conversion.messaging_conversation_started_7d'],
        
        // Metadados de cache
        cacheCreatedAt: new Date(),
        cacheExpiresAt: cacheExpiresAt,
        cacheKey: `${cacheKey}-${i}`,
        isStale: false,
        
        // Dados adicionais (JSON)
        additionalData: JSON.stringify({
          original_actions: actionsData,
          raw_data_keys: Object.keys(rawData),
          processing_timestamp: new Date().toISOString()
        })
      };

      // Salvar no banco de dados
      const savedMetric = await prisma.facebookDetailedMetrics.create({
        data: dataToSave
      });

      processedData.push(savedMetric);
    }

    console.log(`[CACHE SET] Salvos ${processedData.length} registros detalhados para: ${cacheKey}`);

    // Atualizar timestamp da conta
    await prisma.facebookAccount.update({
      where: { id: facebookAccount.id },
      data: { lastSync: new Date() }
    });

    return NextResponse.json({
      success: true,
      data: processedData,
      meta: { 
        fromCache: false, 
        account_name: connection.accountName,
        total_records: processedData.length,
        date_range: dateRange,
        object_level: objectLevel,
        cache_expires_at: cacheExpiresAt
      },
    });

  } catch (error: any) {
    console.error('Error fetching detailed Facebook metrics:', error);
    
    // Log detalhado do erro
    FacebookTokenLogger.logError(error, 'Detailed metrics collection', connection?.id);
    
    if (error.response?.data) {
      console.error('Facebook API Error:', error.response.data);
      const errorMessage = error.response.data.error?.message || 'Unknown API error';
      const isTokenError = errorMessage.toLowerCase().includes('token') || 
                          errorMessage.toLowerCase().includes('oauth') ||
                          errorMessage.toLowerCase().includes('access') ||
                          error.response.status === 401;
      
      if (isTokenError && connection) {
        // Marcar conexão como inativa se for erro de token
        await FacebookTokenManager.markConnectionInactive(connection.id, errorMessage);
      }
      
      return NextResponse.json({ 
        error: 'Erro da API do Facebook', 
        details: errorMessage,
        action_required: isTokenError ? 'Reconecte sua conta do Facebook nas configurações' : undefined,
        is_token_error: isTokenError
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}

// ================================
// POST - Trigger manual de coleta de métricas
// ================================
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { account_id, date_range = 'last_7_days', level = 'ad' } = body;

    if (!account_id) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Redirecionar para GET com force_refresh
    const url = new URL(request.url);
    url.searchParams.set('account_id', account_id);
    url.searchParams.set('date_range', date_range);
    url.searchParams.set('level', level);
    url.searchParams.set('force_refresh', 'true');

    // Simular chamada GET
    const getRequest = new NextRequest(url.toString(), { method: 'GET' });
    return GET(getRequest);

  } catch (error: any) {
    console.error('Error in POST detailed metrics:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
