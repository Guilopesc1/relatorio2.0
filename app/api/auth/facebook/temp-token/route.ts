import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { tempTokenService } from '@/lib/services/temp-token-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tokenId = searchParams.get('tokenId');

    if (!tokenId) {
      return NextResponse.json({ error: 'Token ID is required' }, { status: 400 });
    }

    // Recuperar o token temporário
    const tokenData = tempTokenService.retrieve(tokenId);

    if (!tokenData) {
      return NextResponse.json({ error: 'Token not found or expired' }, { status: 404 });
    }

    // Verificar se o token pertence ao usuário atual
    if (tokenData.userId !== session.user.id) {
      return NextResponse.json({ error: 'Invalid token ownership' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      accessToken: tokenData.accessToken
    });

  } catch (error) {
    console.error('Temp token retrieval error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve temporary token' }, 
      { status: 500 }
    );
  }
}
