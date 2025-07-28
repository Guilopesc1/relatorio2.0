import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { FacebookDataCollector } from '@/lib/services/facebook-data-collector';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { connectionId, dateStart, dateStop } = body;

    if (!connectionId || !dateStart || !dateStop) {
      return NextResponse.json({
        error: 'Connection ID, date start and date stop are required'
      }, { status: 400 });
    }

    // Validar formato de datas
    const startDate = new Date(dateStart);
    const endDate = new Date(dateStop);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json({
        error: 'Start date must be before end date'
      }, { status: 400 });
    }

    // Coletar dados
    const data = await FacebookDataCollector.collectAccountData(
      session.user.id,
      connectionId,
      dateStart,
      dateStop
    );

    return NextResponse.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Facebook data collection error:', error);
    
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to collect Facebook data' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionIds = searchParams.get('connectionIds')?.split(',') || [];
    const dateStart = searchParams.get('dateStart');
    const dateStop = searchParams.get('dateStop');

    if (connectionIds.length === 0 || !dateStart || !dateStop) {
      return NextResponse.json({
        error: 'Connection IDs, date start and date stop are required'
      }, { status: 400 });
    }

    // Coletar dados de múltiplas contas
    const results = await FacebookDataCollector.collectMultipleAccounts(
      session.user.id,
      connectionIds,
      dateStart,
      dateStop
    );

    return NextResponse.json({
      success: true,
      data: results
    });

  } catch (error) {
    console.error('Facebook multiple accounts data collection error:', error);
    return NextResponse.json(
      { error: 'Failed to collect Facebook data from multiple accounts' }, 
      { status: 500 }
    );
  }
}
