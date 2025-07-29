import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID || '';
  const redirectUri = new URL(request.url).origin + '/api/auth/google/callback';
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=${encodeURIComponent('https://www.googleapis.com/auth/adwords')}&` +
    `response_type=code&` +
    `access_type=offline&` +
    `prompt=consent`;

  return NextResponse.json({
    message: 'Google OAuth Debug Info',
    clientId,
    redirectUri,
    authUrl,
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID ? 'SET' : 'NOT SET',
      NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID ? 'SET' : 'NOT SET',
      GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI
    }
  });
}
