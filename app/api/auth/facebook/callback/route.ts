import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Facebook Callback START ===');
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      console.log('No session in callback, redirecting to login');
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('Callback params:', { 
      hasCode: !!code, 
      state, 
      error, 
      userId: session.user.id 
    });

    // Verificar se houve erro na autorização
    if (error) {
      console.error('Facebook OAuth error:', error);
      return NextResponse.redirect(
        new URL(`/dashboard/connections?error=${encodeURIComponent('Facebook authorization failed')}`, request.url)
      );
    }

    // Verificar se recebeu o código
    if (!code || !state) {
      console.error('Missing code or state:', { hasCode: !!code, hasState: !!state });
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=Missing authorization code', request.url)
      );
    }

    // Validação simples do state
    const userId = session.user.id;
    const userIdPrefix = userId.substring(0, 8);
    
    if (!state.startsWith(`fb_${userIdPrefix}_`)) {
      console.error('Invalid state format:', { state, expectedPrefix: `fb_${userIdPrefix}_` });
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=Invalid state parameter', request.url)
      );
    }

    console.log('State validation successful');

    // Trocar o código pelo access token
    console.log('Exchanging code for access token...');
    
    const tokenParams = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      client_secret: process.env.FACEBOOK_APP_SECRET!,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI!,
      code: code,
    });

    console.log('Token exchange params:', {
      client_id: process.env.FACEBOOK_APP_ID,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
      hasCode: !!code,
      hasSecret: !!process.env.FACEBOOK_APP_SECRET
    });

    const tokenResponse = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        response: errorText
      });
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=Failed to get access token', request.url)
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('Token data received:', { hasAccessToken: !!tokenData.access_token });

    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('No access token in response:', tokenData);
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=No access token received', request.url)
      );
    }

    console.log('Access token received successfully');

    // Para simplificar, vamos usar o token diretamente na URL (temporário para debug)
    const encodedToken = Buffer.from(JSON.stringify({
      accessToken,
      userId: session.user.id,
      timestamp: Date.now()
    })).toString('base64');

    console.log('=== Facebook Callback SUCCESS ===');

    return NextResponse.redirect(
      new URL(`/dashboard/connections/facebook-select?token=${encodedToken}`, request.url)
    );

  } catch (error) {
    console.error('=== Facebook Callback ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.redirect(
      new URL('/dashboard/connections?error=OAuth callback failed', request.url)
    );
  }
}
