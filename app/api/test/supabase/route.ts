import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    console.log('=== PRISMA CONNECTION TEST ===');
    
    // Verificar conexão com banco
    console.log('Testing database connection...');
    
    // Testar conexão básica
    const userCount = await prisma.user.count();
    console.log('✅ Database connection successful!');
    
    // Testar diferentes tabelas
    const connectionCount = await prisma.connection.count();
    const reportCount = await prisma.report.count();
    
    console.log(`Found ${userCount} users, ${connectionCount} connections, ${reportCount} reports`);
    
    // Buscar dados de exemplo
    const [recentUsers, recentConnections] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          email: true,
          profile: true,
          createdAt: true
        },
        take: 3,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.connection.findMany({
        select: {
          id: true,
          platform: true,
          accountName: true,
          isActive: true,
          createdAt: true
        },
        take: 3,
        orderBy: { createdAt: 'desc' }
      })
    ]);
    
    // Teste das tabelas Facebook se existirem
    let facebookStats = null;
    try {
      const facebookAccountCount = await prisma.facebookAccount.count();
      const facebookCampaignCount = await prisma.facebookCampaignCache.count();
      facebookStats = {
        accounts: facebookAccountCount,
        campaignsCache: facebookCampaignCount
      };
      console.log('✅ Facebook tables accessible!');
    } catch (error) {
      console.log('ℹ️ Facebook tables not yet populated');
    }
    
    console.log('✅ All Prisma tests successful!');
    
    return NextResponse.json({
      success: true,
      message: 'Prisma connection test successful',
      stats: {
        users: userCount,
        connections: connectionCount,
        reports: reportCount,
        facebook: facebookStats
      },
      samples: {
        recentUsers: recentUsers.map(user => ({
          id: user.id.substring(0, 8) + '...',
          email: user.email,
          profile: user.profile,
          createdAt: user.createdAt
        })),
        recentConnections: recentConnections.map(conn => ({
          id: conn.id.substring(0, 8) + '...',
          platform: conn.platform,
          accountName: conn.accountName,
          isActive: conn.isActive,
          createdAt: conn.createdAt
        }))
      }
    });
    
  } catch (error) {
    console.error('Prisma test error:', error);
    
    return NextResponse.json({
      error: 'Prisma test failed',  
      details: error instanceof Error ? error.message : 'Unknown error',
      message: 'Check if database is accessible and schema is applied'
    }, { status: 500 });
  }
}
