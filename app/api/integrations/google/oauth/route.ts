import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { GoogleAdsAPI } from '@/lib/integrations/google';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('=== GOOGLE OAUTH START DEBUG ===');
    console.log('User ID:', session.user.id);
    console.log('Starting OAuth flow...');

    // Gerar estado único para segurança
    const state = `user_${session.user.id}_${Date.now()}`;
    
    try {
      // Gerar URL de autorização OAuth
      const authUrl = GoogleAdsAPI.getAuthUrl(state);
      
      console.log('OAuth authorization URL generated successfully');
      console.log('Redirect URL will be:', authUrl);
      
      // REDIRECIONAR DIRETAMENTE em vez de retornar JSON
      return NextResponse.redirect(authUrl);
      
    } catch (configError) {
      console.error('OAuth configuration error:', configError);
      return NextResponse.json({
        error: 'OAuth configuration missing',
        details: configError instanceof Error ? configError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Google OAuth start error:', error);
    return NextResponse.json({
      error: 'Failed to start OAuth process',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
