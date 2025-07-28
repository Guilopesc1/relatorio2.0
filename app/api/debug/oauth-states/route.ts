import { NextRequest, NextResponse } from 'next/server';
import { oauthStateService } from '@/lib/services/oauth-state-service';

export async function GET(request: NextRequest) {
  try {
    const debugInfo = oauthStateService.getDebugInfo();
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...debugInfo
    });
  } catch (error) {
    console.error('Debug OAuth states error:', error);
    return NextResponse.json(
      { error: 'Failed to get debug info' }, 
      { status: 500 }
    );
  }
}
