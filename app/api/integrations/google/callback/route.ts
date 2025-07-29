import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { GoogleAdsAPIStandard } from '../../../../../lib/integrations/google-ads-standard';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    console.log('=== GOOGLE OAUTH CALLBACK ===');
    console.log('Code:', code ? 'RECEIVED' : 'MISSING');
    console.log('State:', state);
    console.log('Error:', error);

    // Verificar se houve erro no OAuth
    if (error) {
      console.error('OAuth error:', error);
      const errorMessage = encodeURIComponent(`Google OAuth error: ${error}`);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${errorMessage}`);
    }

    // Verificar se temos o code
    if (!code) {
      console.error('Missing authorization code');
      const errorMessage = encodeURIComponent('Missing authorization code from Google');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${errorMessage}`);
    }

    // Verificar se usuário está logado
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('User not authenticated');
      const errorMessage = encodeURIComponent('You must be logged in to connect Google Ads');
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/auth/signin?error=${errorMessage}`);
    }

    try {
      console.log('Exchanging authorization code for tokens...');
      
      // Trocar o código por tokens
      const tokens = await GoogleAdsAPIStandard.exchangeCodeForTokens(code);
      
      console.log('Tokens received successfully');
      console.log('Access token:', tokens.access_token ? 'RECEIVED' : 'MISSING');
      console.log('Refresh token:', tokens.refresh_token ? 'RECEIVED' : 'MISSING');
      
      // Criar instância da API para buscar contas
      const googleAPI = new GoogleAdsAPIStandard(tokens.access_token);
      
      console.log('Fetching accessible customers...');
      const accessibleCustomers = await googleAPI.getAccessibleCustomers();
      
      if (!accessibleCustomers.resource_names || accessibleCustomers.resource_names.length === 0) {
        console.log('No Google Ads accounts found for user');
        const errorMessage = encodeURIComponent('No Google Ads accounts found. Make sure you have active Google Ads accounts.');
        return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${errorMessage}`);
      }
      
      console.log('🔍 Processing user OAuth accounts...');
      
      // Extrair customer IDs das contas do usuário
      const customerIds = accessibleCustomers.resource_names.map((resourceName: string) => {
        return resourceName.split('/')[1];
      });
      
      console.log('📋 User accessible accounts:', customerIds);
      
      // Buscar detalhes de cada conta do usuário
      const accountsWithDetails = [];
      
      for (const customerId of customerIds) { // Removido slice(0, 5) para processar todas as contas
        try {
          console.log(`📋 Attempting to fetch details for customer: ${customerId}`);
          
          // ✅ NOVA ABORDAGEM: Usar a conta específica do usuário
          const customerDetails = await googleAPI.getCustomerDetailsForUser(customerId);
          
          accountsWithDetails.push({
            id: customerDetails.id,
            name: customerDetails.name,
            currency_code: customerDetails.currency_code,
            status: customerDetails.status,
            time_zone: customerDetails.time_zone,
            descriptive_name: customerDetails.descriptive_name
          });
          
          console.log(`✅ Successfully fetched details for customer ${customerId}`);
          
        } catch (detailError) {
          console.log(`⚠️ Failed to fetch details for customer ${customerId}:`, detailError instanceof Error ? detailError.message : 'Unknown error');
          
          // ✅ TRATAMENTO DO ERRO 403: Adicionar conta com informações básicas
          // Isso é esperado para usuários que não têm permissão total mas podem conectar
          accountsWithDetails.push({
            id: customerId,
            name: `Google Ads Account ${customerId}`,
            currency_code: 'USD',
            status: 'ENABLED',
            time_zone: 'UTC',
            descriptive_name: `Account ${customerId}`
          });
          
          console.log(`📝 Added basic info for customer ${customerId} (403 error handled)`);
        }
      }
      
      console.log(`Total accounts processed: ${accountsWithDetails.length}`);
      
      // ✅ NOVA ABORDAGEM: Redirecionar para seleção de contas em vez de conectar automaticamente
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        accounts: accountsWithDetails,
        timestamp: Date.now()
      };
      
      // Codificar dados do token para passar via URL
      const encodedTokenData = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      
      console.log('✅ Token data prepared:', {
        accountsCount: tokenData.accounts.length,
        hasAccessToken: !!tokenData.access_token,
        hasRefreshToken: !!tokenData.refresh_token,
        timestamp: tokenData.timestamp
      });
      console.log('✅ Redirecting to account selection page');
      
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/connections/google/select?tokens=${encodedTokenData}`
      );
      
    } catch (tokenError) {
      console.error('Error processing OAuth callback:', tokenError);
      const errorMessage = encodeURIComponent(`Failed to process Google authentication: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${errorMessage}`);
    }
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = encodeURIComponent('Internal error processing Google authentication');
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/connections?error=${errorMessage}`);
  }
}
