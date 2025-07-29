import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsAPI } from '@/lib/integrations/google';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, code } = body;

    console.log('=== GOOGLE OAUTH TEST ENDPOINT ===');
    console.log('Action:', action);

    if (action === 'generate_url') {
      // Gerar URL de teste
      try {
        const authUrl = GoogleAdsAPI.getAuthUrl('test_state_123');
        
        return NextResponse.json({
          success: true,
          authUrl: authUrl,
          message: 'Open this URL in a new tab, complete authorization, and copy the authorization code from the callback URL'
        });
      } catch (error) {
        return NextResponse.json({
          error: 'Failed to generate auth URL',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    if (action === 'test_code' && code) {
      // Testar troca de código por tokens
      try {
        console.log('Testing authorization code:', code.substring(0, 20) + '...');
        
        const tokens = await GoogleAdsAPI.exchangeCodeForTokens(code);
        
        console.log('Token exchange result:', {
          access_token: tokens.access_token ? 'RECEIVED (' + tokens.access_token.substring(0, 20) + '...)' : 'MISSING',
          refresh_token: tokens.refresh_token ? 'RECEIVED' : 'MISSING',
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
          scope: tokens.scope
        });

        // Testar o access token imediatamente
        const testResponse = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`
          }
        });

        if (testResponse.ok) {
          const userInfo = await testResponse.json();
          
          return NextResponse.json({
            success: true,
            tokens: {
              access_token: tokens.access_token.substring(0, 20) + '...',
              refresh_token: tokens.refresh_token ? tokens.refresh_token.substring(0, 20) + '...' : null,
              expires_in: tokens.expires_in,
              token_type: tokens.token_type,
              scope: tokens.scope
            },
            userInfo: {
              email: userInfo.email,
              name: userInfo.name,
              id: userInfo.id
            },
            message: 'OAuth working correctly! ✅'
          });
        } else {
          const errorText = await testResponse.text();
          console.log('Token validation failed:', testResponse.status, errorText);
          
          return NextResponse.json({
            error: 'Token validation failed',
            details: `Status: ${testResponse.status}, Error: ${errorText}`,
            tokens: {
              access_token: tokens.access_token.substring(0, 20) + '...',
              refresh_token: tokens.refresh_token ? tokens.refresh_token.substring(0, 20) + '...' : null,
              expires_in: tokens.expires_in
            }
          }, { status: 400 });
        }

      } catch (tokenError) {
        console.error('Token exchange error:', tokenError);
        
        return NextResponse.json({
          error: 'Token exchange failed',
          details: tokenError instanceof Error ? tokenError.message : 'Unknown error'
        }, { status: 400 });
      }
    }

    return NextResponse.json({
      error: 'Invalid action',
      availableActions: ['generate_url', 'test_code']
    }, { status: 400 });

  } catch (error) {
    console.error('OAuth test endpoint error:', error);
    
    return NextResponse.json({
      error: 'Test endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
