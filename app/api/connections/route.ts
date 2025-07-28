import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { SupabaseConnectionService } from '@/lib/services/supabase-connection-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | null;

    const connections = await SupabaseConnectionService.getConnections(
      session.user.id, 
      platform || undefined
    );

    const limits = await SupabaseConnectionService.getConnectionLimits(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        connections: connections.map(conn => ({
          id: conn.id,
          platform: conn.platform,
          accountId: conn.accountId,
          accountName: conn.accountName,
          isActive: conn.isActive,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt
        })),
        limits
      }
    });

  } catch (error) {
    console.error('Get connections error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch connections' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get('id');

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 });
    }

    await SupabaseConnectionService.deleteConnection(session.user.id, connectionId);

    return NextResponse.json({
      success: true,
      message: 'Connection deleted successfully'
    });

  } catch (error) {
    console.error('Delete connection error:', error);
    return NextResponse.json(
      { error: 'Failed to delete connection' }, 
      { status: 500 }
    );
  }
}
