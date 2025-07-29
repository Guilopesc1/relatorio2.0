import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    console.log('=== SUPABASE CONNECTION TEST ===');
    
    // Verificar variáveis de ambiente
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    
    console.log('SUPABASE_URL:', supabaseUrl ? 'SET' : 'NOT SET');
    console.log('SUPABASE_SERVICE_KEY:', supabaseKey ? 'SET' : 'NOT SET');
    
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        details: 'SUPABASE_URL or SUPABASE_SERVICE_KEY not configured'
      }, { status: 500 });
    }
    
    // Criar cliente Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Testar conexão básica
    console.log('Testing basic connection...');
    const { data: testData, error: testError } = await supabase
      .from('app_users')
      .select('id, email')
      .limit(1);
    
    if (testError) {
      console.error('Supabase connection test failed:', testError);
      return NextResponse.json({
        error: 'Supabase connection failed',
        details: testError.message
      }, { status: 500 });
    }
    
    console.log('✅ Supabase connection successful!');
    
    // Testar tabela de conexões
    console.log('Testing api_connections table...');
    const { data: connectionsData, error: connectionsError } = await supabase
      .from('api_connections')
      .select('id, platform, account_name')
      .limit(5);
    
    if (connectionsError) {
      console.error('api_connections table test failed:', connectionsError);
      return NextResponse.json({
        error: 'api_connections table access failed',
        details: connectionsError.message
      }, { status: 500 });
    }
    
    console.log('✅ api_connections table accessible!');
    
    return NextResponse.json({
      success: true,
      message: 'Supabase connection test successful',
      data: {
        users_found: testData?.length || 0,
        connections_found: connectionsData?.length || 0,
        sample_connections: connectionsData?.map(conn => ({
          id: conn.id,
          platform: conn.platform,
          account_name: conn.account_name
        })) || []
      }
    });
    
  } catch (error) {
    console.error('Supabase test error:', error);
    
    return NextResponse.json({
      error: 'Supabase test failed',  
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
