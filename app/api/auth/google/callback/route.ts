import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('=== GOOGLE AUTH CALLBACK (REDIRECT TO INTEGRATIONS) ===');
    console.log('Code:', code ? 'RECEIVED' : 'MISSING');
    console.log('State:', state);
    console.log('Error:', error);

    // Redirecionar para o callback das integrações que tem a lógica completa
    const integrationsCallbackUrl = new URL('/api/integrations/google/callback', request.url);
    
    // Passar todos os parâmetros
    if (code) integrationsCallbackUrl.searchParams.append('code', code);
    if (state) integrationsCallbackUrl.searchParams.append('state', state);
    if (error) integrationsCallbackUrl.searchParams.append('error', error);

    console.log('Redirecting to integrations callback:', integrationsCallbackUrl.toString());
    
    return NextResponse.redirect(integrationsCallbackUrl);

  } catch (err) {
    console.error('Google auth callback error:', err);
    const errorMessage = encodeURIComponent('Internal error processing Google authentication');
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${errorMessage}`);
  }
}
