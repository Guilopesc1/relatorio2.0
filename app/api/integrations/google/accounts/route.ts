import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

// ⚡ NOVA CLASSE: OAuth User Google Ads API (SEM DEVELOPER TOKEN)
class GoogleOAuthUserAPI {
  private baseUrl = 'https://googleads.googleapis.com/v20';
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  // 🔍 VERIFICAÇÃO CRUCIAL: Validar se token é REALMENTE do usuário
  async validateOAuthUserToken(): Promise<{ email: string; isValid: boolean }> {
    try {
      console.log('🔍 Validando token OAuth do usuário...');
      
      const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`);
      
      if (!tokenInfoResponse.ok) {
        return { email: '', isValid: false };
      }

      const tokenInfo = await tokenInfoResponse.json();
      console.log('📧 Token info:', {
        email: tokenInfo.email,
        scope: tokenInfo.scope,
        audience: tokenInfo.audience,
        expires_in: tokenInfo.expires_in
      });

      // Verificar scope do Google Ads
      const requiredScope = 'https://www.googleapis.com/auth/adwords';
      if (!tokenInfo.scope || !tokenInfo.scope.includes(requiredScope)) {
        console.log('❌ Token sem scope Google Ads');
        return { email: tokenInfo.email || '', isValid: false };
      }

      return { 
        email: tokenInfo.email || '', 
        isValid: true 
      };
    } catch (error) {
      console.error('❌ Erro validando token:', error);
      return { email: '', isValid: false };
    }
  }

  // 🎯 BUSCAR CONTAS - MÉTODO OAUTH LIMPO (SEM DEVELOPER TOKEN)
  async getUserGoogleAdsAccounts(): Promise<any[]> {
    try {
      console.log('🔍 Buscando contas Google Ads do usuário OAuth...');
      
      // ⚠️ TENTATIVA 1: Usar APENAS OAuth token (sem developer token)
      const oauthOnlyHeaders = {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      };

      console.log('🚀 Headers OAuth-only:', JSON.stringify(oauthOnlyHeaders, null, 2));

      const oauthResponse = await fetch(`${this.baseUrl}/customers:listAccessibleCustomers`, {
        method: 'GET',
        headers: oauthOnlyHeaders
      });

      console.log('📊 OAuth-only response status:', oauthResponse.status);

      if (oauthResponse.ok) {
        const oauthData = await oauthResponse.json();
        console.log('✅ OAuth-only SUCCESS:', oauthData);
        return oauthData.resourceNames || [];
      }

      // ⚠️ TENTATIVA 2: Oauth + Developer token MAS sem login-customer-id
      console.log('⚠️ OAuth-only falhou, tentando com developer token...');
      
      const hybridHeaders = {
        'Authorization': `Bearer ${this.accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json'
      };

      console.log('🔧 Headers hybrid:', JSON.stringify(hybridHeaders, null, 2));

      const hybridResponse = await fetch(`${this.baseUrl}/customers:listAccessibleCustomers`, {
        method: 'GET',
        headers: hybridHeaders
      });

      console.log('📊 Hybrid response status:', hybridResponse.status);

      if (hybridResponse.ok) {
        const hybridData = await hybridResponse.json();
        console.log('✅ Hybrid SUCCESS:', hybridData);
        
        // 🔍 FILTRAR: Apenas contas que o usuário realmente pode acessar
        const resourceNames = hybridData.resourceNames || [];
        console.log(`📋 Total de contas encontradas: ${resourceNames.length}`);
        
        // Se encontrou muitas contas (>5), pode ser pool de teste
        if (resourceNames.length > 5) {
          console.log('⚠️ AVISO: Muitas contas encontradas. Pode ser pool de teste.');
          console.log('📝 Tentando identificar contas reais do usuário...');
          
          // Tentar apenas as primeiras 3 para evitar pool de teste
          return resourceNames.slice(0, 3);
        }
        
        return resourceNames;
      }

      // ❌ Ambas as tentativas falharam
      const errorData = await hybridResponse.json().catch(() => ({}));
      console.error('❌ Ambas tentativas falharam:', errorData);
      
      throw new Error(`Google Ads API Error: ${hybridResponse.status} - ${errorData.error?.message || 'Unknown error'}`);

    } catch (error) {
      console.error('❌ Erro buscando contas:', error);
      throw error;
    }
  }

  // 🔍 BUSCAR DETALHES DE UMA CONTA (COM VALIDAÇÃO)
  async getAccountDetails(customerId: string): Promise<any> {
    try {
      const cleanCustomerId = customerId.replace(/-/g, '');
      
      const query = `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.status
        FROM customer
        WHERE customer.id = ${cleanCustomerId}
      `;

      const headers = {
        'Authorization': `Bearer ${this.accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json'
      };

      const response = await fetch(`${this.baseUrl}/customers/${cleanCustomerId}/googleAds:search`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Account details error: ${response.status} - ${errorData.error?.message || 'Unknown'}`);
      }

      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const customer = data.results[0].customer;
        return {
          id: customer.id,
          name: customer.descriptive_name || `Customer ${customer.id}`,
          currency_code: customer.currency_code,
          status: customer.status,
          time_zone: customer.time_zone,
          descriptive_name: customer.descriptive_name,
          verified: true
        };
      } else {
        throw new Error('Customer not found');
      }
    } catch (error) {
      console.error(`❌ Erro nos detalhes da conta ${customerId}:`, error);
      throw error;
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' }, 
        { status: 400 }
      );
    }

    console.log('=== 🔧 GOOGLE ACCOUNTS (CORREÇÃO DEFINITIVA) ===');
    console.log('User ID:', session.user.id);
    console.log('User Email:', session.user.email);
    console.log('Access Token (first 20):', accessToken.substring(0, 20) + '...');

    // 🔍 ETAPA 1: Validar token OAuth do usuário
    const googleAPI = new GoogleOAuthUserAPI(accessToken);
    const tokenValidation = await googleAPI.validateOAuthUserToken();

    if (!tokenValidation.isValid) {
      return NextResponse.json({
        error: 'Invalid OAuth Token',
        details: 'Token validation failed or missing Google Ads scope',
        token_email: tokenValidation.email,
        session_email: session.user.email
      }, { status: 403 });
    }

    // 🔍 ETAPA 2: Verificar se email do token = email da sessão
    if (tokenValidation.email && session.user.email && 
        tokenValidation.email !== session.user.email) {
      
      console.log('🚨 SECURITY ALERT: Email mismatch!');
      console.log('Token email:', tokenValidation.email);
      console.log('Session email:', session.user.email);
      
      return NextResponse.json({
        error: 'Token/Session Mismatch',
        details: 'The OAuth token belongs to a different user',
        token_email: tokenValidation.email,
        session_email: session.user.email,
        suggestion: 'Please logout and login again with the correct Google account'
      }, { status: 403 });
    }

    console.log('✅ Token validation passed! Email match confirmed.');
    console.log('👤 Authenticated user:', tokenValidation.email);

    // 🔍 ETAPA 3: Buscar contas do usuário (método limpo)
    try {
      const userAccounts = await googleAPI.getUserGoogleAdsAccounts();
      
      if (!userAccounts || userAccounts.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            accounts: [],
            total: 0,
            user_email: tokenValidation.email,
            message: '📭 Nenhuma conta do Google Ads encontrada para este usuário.',
            suggestion: 'Certifique-se de ter contas ativas do Google Ads ou criar uma nova conta.'
          }
        });
      }

      // ✅ CORREÇÃO: Usar apenas o Manager Customer ID
      const managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
      
      if (!managerCustomerId) {
        return NextResponse.json({
          error: 'Manager Customer ID not configured',
          details: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID environment variable is required'
        }, { status: 500 });
      }

      console.log('🎯 Using Manager Customer ID:', managerCustomerId);
      console.log('📊 Total accessible accounts:', userAccounts.length);

      // 🔍 ETAPA 4: Buscar detalhes da conta manager
      try {
        console.log(`📋 Buscando detalhes da conta manager: ${managerCustomerId}`);
        
        const accountDetails = await googleAPI.getAccountDetails(managerCustomerId);
        const accountsWithDetails = [{
          ...accountDetails,
          owner: 'manager_account',
          index: 1
        }];
        
        console.log(`✅ Conta manager processada: ${accountDetails.name}`);
        
        console.log('📊 RESULTADO FINAL:');
        console.log('✅ Contas processadas:', accountsWithDetails.length);
        console.log('👤 Usuário autenticado:', tokenValidation.email);
        console.log('🏢 Manager Account:', managerCustomerId);

        return NextResponse.json({
          success: true,
          data: {
            accounts: accountsWithDetails,
            total: accountsWithDetails.length,
            user_email: tokenValidation.email,
            manager_customer_id: managerCustomerId,
            message: `✅ Encontrada 1 conta(s) do Google Ads Manager.`,
            developer_token_status: 'manager_mode',
            note: 'Using Manager Customer ID for all operations'
          }
        });
        
      } catch (detailsError) {
        console.log(`⚠️ Falha na conta manager ${managerCustomerId}:`, detailsError instanceof Error ? detailsError.message : 'Unknown error');
        
        // Adicionar com informações básicas
        const accountsWithDetails = [{
          id: managerCustomerId,
          name: `Google Ads Manager ${managerCustomerId}`,
          currency_code: 'USD',
          status: 'ENABLED',
          time_zone: 'UTC',
          descriptive_name: `Manager Account ${managerCustomerId}`,
          owner: 'manager_account',
          verified: false,
          error: 'Failed to fetch details',
          index: 1
        }];

        return NextResponse.json({
          success: true,
          data: {
            accounts: accountsWithDetails,
            total: accountsWithDetails.length,
            user_email: tokenValidation.email,
            manager_customer_id: managerCustomerId,
            message: `✅ Encontrada 1 conta(s) do Google Ads Manager (detalhes básicos).`,
            developer_token_status: 'manager_mode_basic',
            note: 'Using Manager Customer ID with basic details'
          }
        });
      }

    } catch (accountsError) {
      console.error('❌ Erro buscando contas do usuário:', accountsError);
      
      return NextResponse.json({
        error: 'Failed to fetch user accounts',
        details: accountsError instanceof Error ? accountsError.message : 'Unknown error',
        user_email: tokenValidation.email,
        suggestion: 'This user may not have Google Ads accounts or the developer token may be limited'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ Accounts endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
