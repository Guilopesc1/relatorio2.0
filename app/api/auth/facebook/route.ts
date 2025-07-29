import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Facebook OAuth Init START ===');
    
    const session = await getServerSession(authOptions);
    console.log('Session check:', { hasUser: !!session?.user?.id });
    
    if (!session?.user?.id) {
      console.log('No session found, returning 401');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parâmetros do Facebook OAuth
    const facebookClientId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    
    console.log('Facebook config:', { 
      hasClientId: !!facebookClientId, 
      hasRedirectUri: !!redirectUri,
      redirectUri 
    });
    
    if (!facebookClientId || !redirectUri) {
      console.log('Facebook OAuth not configured');
      return NextResponse.json({ error: 'Facebook OAuth not configured' }, { status: 500 });
    }

    // Escopos necessários para Facebook Ads
    const scopes = [
      'ads_read',
      'ads_management', 
      'business_management',
      'pages_read_engagement',
      'pages_show_list'
    ].join(',');

    // Estado para verificação de segurança (simplificado)
    const timestamp = Date.now();
    const state = `fb_${session.user.id.substring(0, 8)}_${timestamp}`;

    console.log('Generated simple state:', { state, userId: session.user.id });

    // URL de autorização do Facebook
    const authUrl = new URL('https://www.facebook.com/v19.0/dialog/oauth');
    authUrl.searchParams.set('client_id', facebookClientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    const responseData = {
      success: true,
      authUrl: authUrl.toString()
    };

    console.log('=== Facebook OAuth Init SUCCESS ===');
    console.log('Response data:', responseData);

    return Response.json(responseData, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    console.error('=== Facebook OAuth Init ERROR ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return Response.json(
      { 
        error: 'Failed to initialize Facebook OAuth',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}
