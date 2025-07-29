import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken } = body;

    if (!accessToken) {
      return NextResponse.json({ error: 'Access token required' }, { status: 400 });
    }

    // Log das configurações
    console.log('=== GOOGLE ADS API SIMPLE TEST ===');
    console.log('Developer Token:', process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? 'SET' : 'NOT SET');
    console.log('Login Customer ID:', process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
    console.log('Access Token (first 20 chars):', accessToken.substring(0, 20) + '...');

    const managerCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '';
    
    // Teste 1: Tentar buscar informações básicas do customer
    const customerUrl = `https://googleads.googleapis.com/v17/customers/${managerCustomerId}`;
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
      'Content-Type': 'application/json',
      'login-customer-id': managerCustomerId
    };

    console.log('Making request to:', customerUrl);
    console.log('Headers:', JSON.stringify(headers, null, 2));

    const response = await fetch(customerUrl, {
      method: 'GET',
      headers
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.text();
      console.log('Error response body:', errorData);
      
      // Teste 2: Se falhou, tentar uma query simples
      console.log('Trying simple search query...');
      
      const searchUrl = `https://googleads.googleapis.com/v17/customers/${managerCustomerId}/googleAds:search`;
      
      const simpleQuery = {
        query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1"
      };

      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(simpleQuery)
      });

      console.log('Search response status:', searchResponse.status);

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        console.log('Search success:', JSON.stringify(searchData, null, 2));
        
        return NextResponse.json({
          success: true,
          message: 'Customer endpoint failed but search worked',
          data: searchData,
          debug: {
            customerEndpointStatus: response.status,
            searchEndpointStatus: searchResponse.status
          }
        });
      } else {
        const searchError = await searchResponse.text();
        console.log('Search error:', searchError);
        
        return NextResponse.json({
          error: 'Both endpoints failed',
          customerError: errorData,
          searchError: searchError,
          status: response.status,
          searchStatus: searchResponse.status
        }, { status: 400 });
      }
    }

    const data = await response.json();
    console.log('Success response:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      data,
      message: 'Customer endpoint worked',
      debug: {
        url: customerUrl,
        status: response.status
      }
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
