import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsAPIStandard } from '@/lib/integrations/google-ads-standard';

export async function GET(request: NextRequest) {
  try {
    // Gerar um state único para segurança
    const state = `google_oauth_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    
    console.log('=== INITIATING GOOGLE OAUTH (STANDARD) ===');
    console.log('Generated state:', state);
    
    // Gerar URL de autorização com scope correto do Google Ads
    const authUrl = GoogleAdsAPIStandard.getAuthUrl(state);
    
    console.log('OAuth URL generated:', authUrl);
    
    // Redirecionar para o Google OAuth
    return NextResponse.redirect(authUrl);
    
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(`/dashboard/connections?error=oauth_init_failed&details=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}
