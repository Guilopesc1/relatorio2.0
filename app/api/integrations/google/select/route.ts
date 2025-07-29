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
    const { accessToken, refreshToken } = body;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Access token and refresh token are required' }, 
        { status: 400 }
      );
    }

    console.log('=== GOOGLE SELECT REDIRECT ===');
    console.log('User ID:', session.user.id);
    console.log('Preparing tokens for selection page...');

    // Criar token temporário (base64) para passar na URL
    const tokenData = {
      accessToken,
      refreshToken,
      timestamp: Date.now(),
      userId: session.user.id
    };

    const encodedToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');
    
    console.log('Token encoded for redirect');

    return NextResponse.json({
      success: true,
      redirectUrl: `/dashboard/connections/google-select?token=${encodedToken}`
    });

  } catch (error) {
    console.error('Google select redirect error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
