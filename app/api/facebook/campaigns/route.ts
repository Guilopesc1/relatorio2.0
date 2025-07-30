import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { PrismaConnectionService } from '@/lib/services/prisma-connection-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const dateRange = searchParams.get('date_range') || 'last_7_days';

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Buscar a conexão do Facebook para esse usuário e conta usando Prisma
    const connection = await PrismaConnectionService.getConnectionByAccount(
      session.user.id, 
      'FACEBOOK', 
      accountId
    );

    if (!connection) {
      return NextResponse.json({ error: 'Facebook connection not found' }, { status: 404 });
    }

    console.log('Facebook Campaigns Request:', {
      userId: session.user.id,
      accountId,
      dateRange,
      hasConnection: !!connection,
      connectionActive: connection.isActive
    });

    // TODO: Implementar integração real com Facebook Ads API
    // const facebookCampaigns = await fetchFacebookCampaigns(connection.accessToken, accountId, dateRange);
    
    // Por enquanto, retornar dados mock realistas baseados na conta real
    const campaignNames = [
      `Campanha de Conversão - ${connection.accountName}`,
      `Remarketing - ${connection.accountName}`,
      `Prospecção - ${connection.accountName}`,
      `Brand Awareness - ${connection.accountName}`,
      `Lead Generation - ${connection.accountName}`
    ];

    const objectives = ['CONVERSIONS', 'CONVERSIONS', 'TRAFFIC', 'BRAND_AWARENESS', 'LEAD_GENERATION'];
    const statuses = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'PAUSED', 'ACTIVE'];

    const mockCampaigns = campaignNames.map((name, index) => {
      const spend = Math.random() * 800 + 100;
      const impressions = Math.floor(Math.random() * 20000 + 5000);
      const clicks = Math.floor(Math.random() * 400 + 50);
      const conversions = Math.floor(Math.random() * 15 + 1);
      
      return {
        id: `camp_${accountId}_${index + 1}`,
        name,
        status: statuses[index],
        objective: objectives[index],
        spend: spend,
        impressions: impressions,
        clicks: clicks,
        ctr: (clicks / impressions) * 100,
        cpc: spend / clicks,
        conversions: conversions,
        roas: conversions > 0 ? (conversions * 150) / spend : 0, // Assumindo R$ 150 por conversão
        created_time: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    });

    console.log('Returning Facebook campaigns:', mockCampaigns.length, 'campaigns');

    return NextResponse.json({
      success: true,
      data: mockCampaigns,
      meta: {
        account_id: accountId,
        account_name: connection.accountName,
        date_range: dateRange,
        total_campaigns: mockCampaigns.length,
        last_updated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching Facebook campaigns:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Facebook campaigns',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
