// ================================
// API ENDPOINT: GET /api/facebook/metrics/detailed/list
// Lista e filtra métricas detalhadas já coletadas e armazenadas
// ================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    
    // Parâmetros de filtro
    const accountId = searchParams.get('account_id');
    const campaignId = searchParams.get('campaign_id');
    const adsetId = searchParams.get('adset_id');
    const adId = searchParams.get('ad_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('page_size') || '50');
    const sortBy = searchParams.get('sort_by') || 'dateStart';
    const sortOrder = searchParams.get('sort_order') || 'desc';

    // Construir filtros WHERE
    const whereConditions: any = {};

    // Filtro por conta (obrigatório via relacionamento)
    if (accountId) {
      const facebookAccount = await prisma.facebookAccount.findFirst({
        where: {
          userId: session.user.id,
          accountId: accountId
        }
      });

      if (!facebookAccount) {
        return NextResponse.json({ 
          error: 'Facebook account not found' 
        }, { status: 404 });
      }

      whereConditions.accountId = facebookAccount.id;
    } else {
      // Se não especificar conta, buscar todas as contas do usuário
      const userAccounts = await prisma.facebookAccount.findMany({
        where: { userId: session.user.id },
        select: { id: true }
      });

      whereConditions.accountId = {
        in: userAccounts.map(acc => acc.id)
      };
    }

    // Filtros opcionais
    if (campaignId) {
      whereConditions.campaignId = campaignId;
    }

    if (adsetId) {
      whereConditions.adSetId = adsetId;
    }

    if (adId) {
      whereConditions.adId = adId;
    }

    // Filtros de data
    if (dateFrom || dateTo) {
      whereConditions.dateStart = {};
      if (dateFrom) {
        whereConditions.dateStart.gte = new Date(dateFrom);
      }
      if (dateTo) {
        whereConditions.dateStart.lte = new Date(dateTo);
      }
    }

    // Filtrar apenas dados não expirados por padrão
    whereConditions.isStale = false;

    // Configurar ordenação
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    console.log(`[DETAILED LIST] Buscando métricas com filtros:`, whereConditions);

    // Contar total de registros
    const totalRecords = await prisma.facebookDetailedMetrics.count({
      where: whereConditions
    });

    // Buscar dados paginados
    const metrics = await prisma.facebookDetailedMetrics.findMany({
      where: whereConditions,
      orderBy: orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        account: {
          select: {
            accountId: true,
            accountName: true
          }
        }
      }
    });

    // Processar dados para resposta
    const processedMetrics = metrics.map(metric => ({
      id: metric.id,
      account: {
        id: metric.account.accountId,
        name: metric.account.accountName
      },
      campaign: {
        id: metric.campaignId,
        name: metric.campaignName
      },
      adset: {
        id: metric.adSetId,
        name: metric.adSetName
      },
      ad: {
        id: metric.adId,
        name: metric.adName
      },
      date: {
        start: metric.dateStart,
        stop: metric.dateStop
      },
      metrics: {
        // Métricas básicas
        reach: metric.reach,
        impressions: metric.impressions,
        spend: metric.spend,
        
        // Cliques
        inline_link_clicks: metric.inlineLinkClicks,
        link_click: metric.linkClick,
        
        // Vídeo
        video_view: metric.videoView,
        video_p75_watched_actions: metric.videoP75WatchedActions,
        
        // Landing Page
        landing_page_view: metric.landingPageView,
        
        // E-commerce
        offsite_conversion_fb_pixel_add_to_cart: metric.offsiteConversionFbPixelAddToCart,
        offsite_conversion_fb_pixel_initiate_checkout: metric.offsiteConversionFbPixelInitiateCheckout,
        offsite_conversion_fb_pixel_purchase: metric.offsiteConversionFbPixelPurchase,
        offsite_conversion_fb_pixel_complete_registration: metric.offsiteConversionFbPixelCompleteRegistration,
        offsite_conversion_fb_pixel_custom: metric.offsiteConversionFbPixelCustom,
        
        // Leads
        offsite_conversion_fb_pixel_lead: metric.offsiteConversionFbPixelLead,
        onsite_conversion_lead_grouped: metric.onsiteConversionLeadGrouped,
        leadgen_other: metric.leadgenOther,
        
        // Messaging
        onsite_conversion_messaging_conversation_started_7d: metric.onsiteConversionMessagingConversationStarted7d
      },
      cache: {
        created_at: metric.cacheCreatedAt,
        expires_at: metric.cacheExpiresAt,
        is_stale: metric.isStale,
        cache_key: metric.cacheKey
      },
      additional_data: metric.additionalData ? JSON.parse(metric.additionalData) : null
    }));

    // Calcular metadados de paginação
    const totalPages = Math.ceil(totalRecords / pageSize);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Estatísticas agregadas (opcional)
    const aggregateStats = await prisma.facebookDetailedMetrics.aggregate({
      where: whereConditions,
      _sum: {
        impressions: true,
        reach: true,
        spend: true,
        inlineLinkClicks: true,
        offsiteConversionFbPixelPurchase: true,
        offsiteConversionFbPixelLead: true
      },
      _avg: {
        spend: true
      },
      _count: {
        id: true
      }
    });

    console.log(`[DETAILED LIST] Retornando ${processedMetrics.length} métricas (página ${page}/${totalPages})`);

    return NextResponse.json({
      success: true,
      data: processedMetrics,
      pagination: {
        current_page: page,
        page_size: pageSize,
        total_records: totalRecords,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_previous_page: hasPrevPage
      },
      aggregates: {
        total_impressions: aggregateStats._sum.impressions || 0,
        total_reach: aggregateStats._sum.reach || 0,
        total_spend: aggregateStats._sum.spend || 0,
        total_clicks: aggregateStats._sum.inlineLinkClicks || 0,
        total_purchases: aggregateStats._sum.offsiteConversionFbPixelPurchase || 0,
        total_leads: aggregateStats._sum.offsiteConversionFbPixelLead || 0,
        average_spend: aggregateStats._avg.spend || 0,
        total_records: aggregateStats._count.id
      },
      filters_applied: {
        account_id: accountId,
        campaign_id: campaignId,
        adset_id: adsetId,
        ad_id: adId,
        date_from: dateFrom,
        date_to: dateTo,
        sort_by: sortBy,
        sort_order: sortOrder
      }
    });

  } catch (error: any) {
    console.error('Error listing detailed Facebook metrics:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}

// ================================
// DELETE - Limpar métricas antigas ou específicas
// ================================
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const olderThanDays = parseInt(searchParams.get('older_than_days') || '30');
    const onlyStale = searchParams.get('only_stale') === 'true';

    // Filtros para deletar
    const whereConditions: any = {};

    // Filtro por conta do usuário
    if (accountId) {
      const facebookAccount = await prisma.facebookAccount.findFirst({
        where: {
          userId: session.user.id,
          accountId: accountId
        }
      });

      if (!facebookAccount) {
        return NextResponse.json({ 
          error: 'Facebook account not found' 
        }, { status: 404 });
      }

      whereConditions.accountId = facebookAccount.id;
    } else {
      // Todas as contas do usuário
      const userAccounts = await prisma.facebookAccount.findMany({
        where: { userId: session.user.id },
        select: { id: true }
      });

      whereConditions.accountId = {
        in: userAccounts.map(acc => acc.id)
      };
    }

    // Filtro por idade
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    whereConditions.cacheCreatedAt = {
      lt: cutoffDate
    };

    // Filtro apenas dados stale se especificado
    if (onlyStale) {
      whereConditions.isStale = true;
    }

    console.log(`[DETAILED DELETE] Deletando métricas com filtros:`, whereConditions);

    // Contar registros que serão deletados
    const countToDelete = await prisma.facebookDetailedMetrics.count({
      where: whereConditions
    });

    // Deletar registros
    const deleteResult = await prisma.facebookDetailedMetrics.deleteMany({
      where: whereConditions
    });

    console.log(`[DETAILED DELETE] Deletados ${deleteResult.count} registros`);

    return NextResponse.json({
      success: true,
      message: `${deleteResult.count} registros de métricas detalhadas foram removidos`,
      deleted_count: deleteResult.count,
      expected_count: countToDelete,
      filters_applied: {
        account_id: accountId,
        older_than_days: olderThanDays,
        only_stale: onlyStale
      }
    });

  } catch (error: any) {
    console.error('Error deleting detailed Facebook metrics:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}
