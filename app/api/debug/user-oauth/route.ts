import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, accessToken } = body;

    console.log('🔧 DEBUG USER OAUTH');
    console.log('Action:', action);
    console.log('User:', session.user.email);

    if (action === 'validate_token' && accessToken) {
      // Validar token detalhadamente
      try {
        const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
        
        if (tokenInfoResponse.ok) {
          const tokenInfo = await tokenInfoResponse.json();
          
          return NextResponse.json({
            success: true,
            token_info: {
              email: tokenInfo.email,
              scope: tokenInfo.scope,
              audience: tokenInfo.audience,
              expires_in: tokenInfo.expires_in,
              user_id: tokenInfo.user_id,
              verified_email: tokenInfo.verified_email
            },
            session_info: {
              user_id: session.user.id,
              email: session.user.email,
              name: session.user.name
            },
            email_match: tokenInfo.email === session.user.email,
            has_ads_scope: tokenInfo.scope?.includes('https://www.googleapis.com/auth/adwords') || false
          });
        } else {
          return NextResponse.json({
            success: false,
            error: 'Token validation failed',
            status: tokenInfoResponse.status
          });
        }
      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'Token validation error',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    if (action === 'test_google_api' && accessToken) {
      // Testar Google Ads API
      try {
        // Teste 1: OAuth only
        const oauthOnlyResponse = await fetch('https://googleads.googleapis.com/v20/customers:listAccessibleCustomers', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });

        const oauthResult = {
          status: oauthOnlyResponse.status,
          success: oauthOnlyResponse.ok,
          data: oauthOnlyResponse.ok ? await oauthOnlyResponse.json() : await oauthOnlyResponse.text()
        };

        // Teste 2: OAuth + Developer Token
        const hybridResponse = await fetch('https://googleads.googleapis.com/v20/customers:listAccessibleCustomers', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
            'Content-Type': 'application/json'
          }
        });

        const hybridResult = {
          status: hybridResponse.status,
          success: hybridResponse.ok,
          data: hybridResponse.ok ? await hybridResponse.json() : await hybridResponse.text()
        };

        return NextResponse.json({
          success: true,
          tests: {
            oauth_only: oauthResult,
            oauth_plus_dev_token: hybridResult
          },
          recommendation: oauthResult.success ? 'Use OAuth only' : 'Need developer token'
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          error: 'API test failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid action or missing parameters',
      available_actions: ['validate_token', 'test_google_api']
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
