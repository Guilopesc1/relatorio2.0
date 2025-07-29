import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { GoogleAdsAPIStandard } from '../../../../../lib/integrations/google-ads-standard';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { accessToken, customerId } = body;

    if (!accessToken || !customerId) {
      return NextResponse.json(
        { error: 'Access token and customer ID are required' }, 
        { status: 400 }
      );
    }

    console.log('=== 🔍 GOOGLE ACCOUNT DETAILS DEBUG ===');
    console.log('User ID:', session.user.id);
    console.log('User Email:', session.user.email);
    console.log('Customer ID solicitado:', customerId);
    console.log('Access Token (first 20):', accessToken.substring(0, 20) + '...');
    
    // VERIFICAÇÃO DE SEGURANÇA: Validar se o token pertence ao usuário da sessão
    try {
      const tokenInfoResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${accessToken}`);
      
      if (tokenInfoResponse.ok) {
        const tokenInfo = await tokenInfoResponse.json();
        console.log('🔐 Token owner email:', tokenInfo.email);
        console.log('👤 Session email:', session.user.email);
        
        if (tokenInfo.email && session.user.email && tokenInfo.email !== session.user.email) {
          console.log('🚨 SECURITY ALERT: Token/Session email mismatch!');
          return NextResponse.json({
            error: 'Security Error',
            details: 'Token belongs to different user than session',
            suggestion: 'Please logout and login again with correct account'
          }, { status: 403 });
        }
      }
    } catch (securityError) {
      console.log('⚠️ Could not verify token security:', securityError);
    }

    try {
      const googleAPI = new GoogleAdsAPIStandard(accessToken);
      
      // ✅ CORREÇÃO: Usar Manager Customer ID em vez do customerId específico
      const managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
      
      if (!managerCustomerId) {
        return NextResponse.json({
          error: 'Manager Customer ID not configured',
          details: 'GOOGLE_ADS_LOGIN_CUSTOMER_ID environment variable is required'
        }, { status: 500 });
      }
      
      // Buscar detalhes da conta manager
      const accountDetails = await googleAPI.getCustomerDetails(managerCustomerId);
      
      console.log('✅ Account details fetched successfully:', accountDetails);

      return NextResponse.json({
        success: true,
        data: {
          account: {
            id: accountDetails.id,
            name: accountDetails.name,
            currency_code: accountDetails.currency_code,
            status: accountDetails.status,
            time_zone: accountDetails.time_zone,
            descriptive_name: accountDetails.descriptive_name
          }
        },
        note: 'Using Manager Customer ID for all requests'
      });

    } catch (apiError) {
      console.error('Google Ads API error:', apiError);
      
      if (apiError instanceof Error) {
        if (apiError.message.includes('PERMISSION_DENIED')) {
          return NextResponse.json({
            error: 'Permission Denied',
            details: 'You do not have access to the Manager Google Ads account',
            suggestion: 'Make sure your OAuth token has access to the manager account'
          }, { status: 403 });
        }
        
        if (apiError.message.includes('UNAUTHENTICATED')) {
          return NextResponse.json({
            error: 'Authentication Failed',
            details: 'Access token is invalid or expired',
            suggestion: 'Please re-authenticate with Google'
          }, { status: 401 });
        }
        
        if (apiError.message.includes('NOT_FOUND')) {
          return NextResponse.json({
            error: 'Manager Account Not Found',
            details: 'The configured Manager Customer ID was not found',
            suggestion: 'Verify the GOOGLE_ADS_LOGIN_CUSTOMER_ID is correct'
          }, { status: 404 });
        }
      }
      
      return NextResponse.json({
        error: 'Failed to fetch account details',
        details: apiError instanceof Error ? apiError.message : 'Unknown error',
        suggestion: 'Please try again or contact support'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Account details endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
