import { NextRequest, NextResponse } from 'next/server';
import { GoogleAdsAPI } from '@/lib/integrations/google';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    const googleAPI = new GoogleAdsAPI(accessToken);

    // Log das configurações
    console.log('=== GOOGLE ADS API DEBUG ===');
    console.log('Developer Token:', process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'SET' : 'NOT SET');
    console.log('Login Customer ID:', process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    console.log('Access Token (first 20 chars):', accessToken.substring(0, 20) + '...');

    try {
      // Testar a chamada diretamente
      const url = 'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers';
      
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
        'Content-Type': 'application/json',
      };

      console.log('Making direct request to:', url);
      console.log('Headers:', JSON.stringify(headers, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({})
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.text();
        console.log('Error response body:', errorData);
        
        return NextResponse.json({
          error: 'API request failed',
          status: response.status,
          statusText: response.statusText,
          body: errorData,
          url,
          headers
        }, { status: 400 });
      }

      const data = await response.json();
      console.log('Success response:', JSON.stringify(data, null, 2));

      return NextResponse.json({
        success: true,
        data,
        debug: {
          url,
          status: response.status,
          headers: Object.fromEntries(response.headers.entries())
        }
      });

    } catch (error) {
      console.error('Direct API call failed:', error);
      return NextResponse.json({
        error: 'API call failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
