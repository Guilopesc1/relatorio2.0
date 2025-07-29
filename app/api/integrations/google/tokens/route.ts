import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tokenKey } = body;

    if (!tokenKey) {
      return NextResponse.json(
        { error: 'Token key is required' }, 
        { status: 400 }
      );
    }

    console.log('=== RETRIEVING GOOGLE TOKENS ===');
    console.log('Token key:', tokenKey);
    
    // Verificar se o cache existe
    if (!global.googleTokensCache) {
      console.log('❌ No tokens cache found');
      return NextResponse.json({
        error: 'No tokens cache found',
        suggestion: 'Please re-authenticate with Google'
      }, { status: 404 });
    }
    
    // Buscar tokens pelo key
    const tokens = global.googleTokensCache[tokenKey];
    
    if (!tokens) {
      console.log('❌ Tokens not found for key:', tokenKey);
      console.log('Available keys:', Object.keys(global.googleTokensCache));
      
      return NextResponse.json({
        error: 'Tokens not found for provided key',
        suggestion: 'Please re-authenticate with Google'
      }, { status: 404 });
    }
    
    // Verificar se os tokens expiraram
    if (tokens.expires_at && Date.now() > tokens.expires_at) {
      console.log('❌ Tokens expired');
      
      // Remover tokens expirados do cache
      delete global.googleTokensCache[tokenKey];
      
      return NextResponse.json({
        error: 'Tokens expired',
        suggestion: 'Please re-authenticate with Google'
      }, { status: 410 });
    }
    
    console.log('✅ Tokens found and valid');
    console.log('Token info:', {
      access_token: tokens.access_token ? 'PRESENT' : 'MISSING',
      refresh_token: tokens.refresh_token ? 'PRESENT' : 'MISSING',
      scope: tokens.scope,
      expires_at: new Date(tokens.expires_at).toISOString()
    });
    
    return NextResponse.json({
      success: true,
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        expires_at: tokens.expires_at
      }
    });
    
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
