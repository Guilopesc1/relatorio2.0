import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    console.log('=== GOOGLE ACCOUNTS SIMPLIFIED TEST ===');
    
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    // Verificar variáveis de ambiente
    const managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    
    console.log('Environment check:');
    console.log('- Manager Customer ID:', managerCustomerId ? 'SET' : 'NOT SET');
    console.log('- Developer Token:', developerToken ? 'SET' : 'NOT SET');
    console.log('- Access Token:', accessToken.substring(0, 20) + '...');

    if (!managerCustomerId || !developerToken) {
      return NextResponse.json({
        error: 'Missing required environment variables',
        details: {
          managerCustomerId: !!managerCustomerId,
          developerToken: !!developerToken
        }
      }, { status: 500 });
    }

    // Retornar conta manager como fallback sempre
    const accounts = [{
      id: managerCustomerId,
      name: `Google Ads Manager ${managerCustomerId}`,
      currency_code: 'USD',
      status: 'ENABLED',
      time_zone: 'UTC',
      descriptive_name: `Manager Account ${managerCustomerId}`
    }];

    console.log('Returning fallback account:', accounts[0]);

    return NextResponse.json({
      success: true,
      data: {
        accounts: accounts,
        total: accounts.length,
        mode: 'fallback',
        message: 'Using fallback manager account'
      }
    });

  } catch (error) {
    console.error('Simplified accounts error:', error);
    return NextResponse.json({
      error: 'Simplified test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
