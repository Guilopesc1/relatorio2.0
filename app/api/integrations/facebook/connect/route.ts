import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { FacebookAdsAPI } from '@/lib/integrations/facebook';
import { PrismaConnectionService } from '@/lib/services/prisma-connection-service';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accessToken, accountId } = body;

    if (!accessToken || !accountId) {
      return NextResponse.json(
        { error: 'Access token and account ID are required' }, 
        { status: 400 }
      );
    }

    const facebookAPI = new FacebookAdsAPI(accessToken);
    
    // Validar token
    const isValid = await facebookAPI.validateToken();
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 400 });
    }

    // Buscar informações da conta
    const adAccounts = await facebookAPI.getAdAccounts();
    const account = adAccounts.find(acc => acc.id === accountId);
    
    if (!account) {
      return NextResponse.json({ error: 'Ad account not found' }, { status: 404 });
    }

    // Verificar se pode adicionar nova conexão
    const canAdd = await PrismaConnectionService.canAddConnection(session.user.id, 'FACEBOOK');
    if (!canAdd) {
      const limits = await PrismaConnectionService.getConnectionLimits(session.user.id);
      return NextResponse.json({
        error: `Maximum connections reached for your ${limits.profile} plan. Limit: ${limits.max}`
      }, { status: 400 });
    }

    // Criar conexão
    const connection = await PrismaConnectionService.createConnection({
      userId: session.user.id,
      platform: 'FACEBOOK',
      accountId: account.id,
      accountName: account.name,
      accessToken,
      refreshToken: null,
      expiresAt: null
    });

    return NextResponse.json({
      success: true,
      message: 'Facebook account connected successfully',
      data: {
        id: connection.id,
        accountId: connection.accountId,
        accountName: connection.accountName,
        platform: connection.platform,
        createdAt: connection.createdAt
      }
    });

  } catch (error) {
    console.error('Facebook connection error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to connect Facebook account' }, 
      { status: 500 }
    );
  }
}