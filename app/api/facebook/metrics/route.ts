// app/api/facebook/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { prisma } from '@/lib/prisma';
// CORREÇÃO 1: Importar 'FacebookAdsApi' em vez de 'Api'
import { FacebookAdsApi, AdAccount } from 'facebook-nodejs-business-sdk';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const dateRange = searchParams.get('date_range') || 'last_7_days';
    const objectLevel = 'account';

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const connection = await prisma.connection.findFirst({
      where: { userId: session.user.id, platform: 'FACEBOOK', accountId: accountId, isActive: true },
    });

    if (!connection || !connection.accessToken) {
      return NextResponse.json({ error: 'Facebook connection not found or token is missing' }, { status: 404 });
    }

    const facebookAccount = await prisma.facebookAccount.upsert({
      where: {
        userId_accountId: {
          userId: session.user.id,
          accountId: accountId,
        },
      },
      update: { accountName: connection.accountName, accessToken: connection.accessToken },
      create: {
        userId: session.user.id,
        accountId: accountId,
        accountName: connection.accountName,
        accessToken: connection.accessToken,
        permissions: '[]',
      },
    });
    
    const cacheKey = `${accountId}-${objectLevel}-${dateRange}`;
    
    // CORREÇÃO 2: Usar a chave composta 'accountId_cacheKey' para o findUnique
    const cachedData = await prisma.facebookMetricCache.findUnique({
      where: {
        accountId_cacheKey: {
          accountId: facebookAccount.id,
          cacheKey: cacheKey,
        },
      },
    });

    if (cachedData && cachedData.cacheExpiresAt > new Date()) {
      console.log(`[CACHE HIT] Retornando dados para: ${cacheKey}`);
      const metrics = { ...cachedData, actions: JSON.parse(cachedData.actions || '[]') };
      return NextResponse.json({ success: true, data: metrics, meta: { fromCache: true } });
    }
    
    console.log(`[CACHE MISS] Buscando dados do Facebook para: ${cacheKey}`);
    
    // CORREÇÃO 3: Usar 'FacebookAdsApi.init' em vez de 'Api.init'
    FacebookAdsApi.init(connection.accessToken);
    const adAccount = new AdAccount(accountId);

    const fields = ['reach', 'impressions', 'spend', 'inline_link_clicks', 'actions'];
    const params = { date_preset: dateRange, level: objectLevel, action_breakdowns: ['action_type'] };

    const insights = await adAccount.getInsights(fields, params);

    if (!insights || insights.length === 0) {
      return NextResponse.json({ success: true, data: { message: "Nenhum dado encontrado." } });
    }
    
    const rawData = insights[0];

    const cacheExpiresAt = new Date(new Date().getTime() + 4 * 60 * 60 * 1000);

    const dataToCache = {
      accountId: facebookAccount.id,
      objectType: objectLevel,
      objectId: accountId,
      dateStart: new Date(rawData.date_start),
      dateStop: new Date(rawData.date_stop),
      impressions: parseInt(rawData.impressions || '0'),
      clicks: parseInt(rawData.inline_link_clicks || '0'),
      spend: parseFloat(rawData.spend || '0'),
      reach: parseInt(rawData.reach || '0'),
      actions: rawData.actions ? JSON.stringify(rawData.actions) : null,
      cacheExpiresAt: cacheExpiresAt,
      cacheKey: cacheKey,
    };
    
    // CORREÇÃO 4: Usar a chave composta 'accountId_cacheKey' também no upsert
    await prisma.facebookMetricCache.upsert({
      where: {
        accountId_cacheKey: {
          accountId: facebookAccount.id,
          cacheKey: cacheKey,
        },
      },
      update: dataToCache,
      create: { ...dataToCache, cacheCreatedAt: new Date() },
    });
    
    console.log(`[CACHE SET] Dados salvos para: ${cacheKey}`);

    return NextResponse.json({
      success: true,
      data: { ...dataToCache, actions: JSON.parse(dataToCache.actions || '[]') },
      meta: { fromCache: false, account_name: connection.accountName },
    });

  } catch (error: any) {
    console.error('Error fetching Facebook metrics:', error.message);
    
    // Tratamento mais robusto de erros
    if (error.response?.data) {
      console.error('Facebook API Error:', error.response.data);
      const errorMessage = error.response.data.error?.message || 'Facebook API error occurred';
      return NextResponse.json({ 
        error: 'Facebook API Error', 
        details: errorMessage 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      error: 'Internal Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}