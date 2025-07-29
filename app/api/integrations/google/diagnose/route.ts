import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { GoogleDataCollectorFixed } from '@/lib/services/google-data-collector-fixed';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { connectionId } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' }, 
        { status: 400 }
      );
    }

    console.log(`🔍 Running Google Ads connection diagnosis for: ${connectionId}`);

    const diagnosis = await GoogleDataCollectorFixed.diagnoseGoogleConnection(
      session.user.id,
      connectionId
    );

    console.log('📊 Diagnosis results:', diagnosis);

    return NextResponse.json({
      success: true,
      diagnosis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Diagnosis failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' }, 
        { status: 400 }
      );
    }

    console.log(`🔍 Running GET diagnosis for: ${connectionId}`);

    const diagnosis = await GoogleDataCollectorFixed.diagnoseGoogleConnection(
      session.user.id,
      connectionId
    );

    return NextResponse.json({
      success: true,
      diagnosis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ GET Diagnosis failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
