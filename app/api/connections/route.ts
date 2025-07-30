import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaConnectionService } from '@/lib/services/prisma-connection-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform') as 'FACEBOOK' | 'GOOGLE' | 'TIKTOK' | null;

    const connections = await PrismaConnectionService.getConnections(
      session.user.id, 
      platform || undefined
    );

    const limits = await PrismaConnectionService.getConnectionLimits(session.user.id);
    const stats = await PrismaConnectionService.getConnectionStats(session.user.id);

    return NextResponse.json({
      success: true,
      data: {
        connections: connections.map(conn => ({
          id: conn.id,
          platform: conn.platform,
          accountId: conn.accountId,
          accountName: conn.accountName,
          isActive: conn.isActive,
          expiresAt: conn.expiresAt,
          createdAt: conn.createdAt,
          updatedAt: conn.updatedAt
        })),
        limits,
        stats
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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { platform, accountId, accountName, accessToken, refreshToken, developerToken, expiresAt } = body;

    if (!platform || !accountId || !accountName || !accessToken) {
      return NextResponse.json({ 
        error: 'Missing required fields: platform, accountId, accountName, accessToken' 
      }, { status: 400 });
    }

    const connection = await PrismaConnectionService.createConnection({
      userId: session.user.id,
      platform,
      accountId,
      accountName,
      accessToken,
      refreshToken: refreshToken || null,
      developerToken: developerToken || null,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    return NextResponse.json({
      success: true,
      data: {
        id: connection.id,
        platform: connection.platform,
        accountId: connection.accountId,
        accountName: connection.accountName,
        isActive: connection.isActive,
        expiresAt: connection.expiresAt,
        createdAt: connection.createdAt,
        updatedAt: connection.updatedAt
      }
    });

  } catch (error) {
    console.error('Create connection error:', error);
    
    if (error instanceof Error && error.message.includes('Maximum connections reached')) {
      return NextResponse.json(
        { error: error.message }, 
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create connection' }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { connectionId, ...updateData } = body;

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID is required' }, { status: 400 });
    }

    // Verificar se a conexão pertence ao usuário
    const existingConnection = await PrismaConnectionService.getConnection(
      session.user.id, 
      connectionId
    );

    if (!existingConnection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const updatedConnection = await PrismaConnectionService.updateConnection(
      connectionId, 
      updateData
    );

    return NextResponse.json({
      success: true,
      data: {
        id: updatedConnection.id,
        platform: updatedConnection.platform,
        accountId: updatedConnection.accountId,
        accountName: updatedConnection.accountName,
        isActive: updatedConnection.isActive,
        expiresAt: updatedConnection.expiresAt,
        createdAt: updatedConnection.createdAt,
        updatedAt: updatedConnection.updatedAt
      }
    });

  } catch (error) {
    console.error('Update connection error:', error);
    return NextResponse.json(
      { error: 'Failed to update connection' }, 
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

    // Verificar se a conexão pertence ao usuário antes de deletar
    const existingConnection = await PrismaConnectionService.getConnection(
      session.user.id, 
      connectionId
    );

    if (!existingConnection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    await PrismaConnectionService.deleteConnection(session.user.id, connectionId);

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
