import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { FacebookAdsAPI } from '@/lib/integrations/facebook';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token is required' }, { status: 400 });
    }

    const facebookAPI = new FacebookAdsAPI(accessToken);
    
    // Validar token primeiro
    const isValid = await facebookAPI.validateToken();
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid access token' }, { status: 400 });
    }

    // Buscar contas de anúncios
    const adAccounts = await facebookAPI.getAdAccounts();

    return NextResponse.json({
      success: true,
      data: adAccounts
    });

  } catch (error) {
    console.error('Facebook ad accounts fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ad accounts' }, 
      { status: 500 }
    );
  }
}
