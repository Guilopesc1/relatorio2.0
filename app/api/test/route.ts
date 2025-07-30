// API de teste para verificar se o Prisma está funcionando
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Teste simples para verificar conexão com Prisma
    const userCount = await prisma.user.count();
    const connectionCount = await prisma.connection.count();

    // Teste de busca básica
    const recentUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        profile: true,
        createdAt: true
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Conexão com Prisma funcionando!',
      data: {
        userCount,
        connectionCount,
        recentUsers: recentUsers.length,
        sample: recentUsers.map(user => ({
          id: user.id,
          email: user.email,
          profile: user.profile
        }))
      }
    });

  } catch (error) {
    console.error('Erro Prisma:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
