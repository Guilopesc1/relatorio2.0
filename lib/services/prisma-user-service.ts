import { prisma } from '@/lib/prisma';
import { User } from '@prisma/client';
import { UserProfile } from '@/types/database';
import bcrypt from 'bcryptjs';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  profile?: UserProfile;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  profile?: UserProfile;
  image?: string;
}

export class PrismaUserService {
  
  static async createUser(data: CreateUserData): Promise<User> {
    // Verificar se o email já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('Email already registered');
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        profile: data.profile || 'FREE',
        emailVerified: null // Será definido quando verificar o email
      }
    });

    return user;
  }

  static async getUserById(userId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        connections: {
          where: { isActive: true },
          select: {
            id: true,
            platform: true,
            accountName: true,
            isActive: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            connections: {
              where: { isActive: true }
            },
            reports: {
              where: { isActive: true }
            }
          }
        }
      }
    });
  }

  static async getUserByEmail(email: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { email }
    });
  }

  static async updateUser(userId: string, data: UpdateUserData): Promise<User> {
    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.email) {
      // Verificar se o novo email já está em uso
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: { id: userId }
        }
      });

      if (existingUser) {
        throw new Error('Email already in use');
      }

      updateData.email = data.email;
      updateData.emailVerified = null; // Reset email verification
    }
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 12);
    }
    if (data.profile) updateData.profile = data.profile;
    if (data.image !== undefined) updateData.image = data.image;

    return await prisma.user.update({
      where: { id: userId },
      data: updateData
    });
  }

  static async deleteUser(userId: string): Promise<void> {
    // Deletar em cascata: conexões, relatórios, etc.
    await prisma.user.delete({
      where: { id: userId }
    });
  }

  static async verifyEmail(userId: string): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: new Date()
      }
    });
  }

  static async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user || !user.password) {
      throw new Error('User not found');
    }

    // Verificar senha atual
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }

    // Atualizar com nova senha
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });
  }

  static async updateProfile(userId: string, profile: UserProfile): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: { profile }
    });
  }

  static async getUserStats(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        _count: {
          select: {
            connections: {
              where: { isActive: true }
            },
            reports: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Estatísticas por plataforma
    const connectionStats = await prisma.connection.groupBy({
      by: ['platform'],
      where: {
        userId,
        isActive: true
      },
      _count: {
        platform: true
      }
    });

    // Relatórios executados recentemente
    const recentExecutions = await prisma.reportExecution.count({
      where: {
        report: {
          userId
        },
        startedAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 dias
        }
      }
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile as UserProfile,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      stats: {
        totalConnections: user._count.connections,
        totalReports: user._count.reports,
        recentExecutions,
        connectionsByPlatform: connectionStats.reduce((acc, stat) => {
          acc[stat.platform] = stat._count.platform;
          return acc;
        }, {} as Record<string, number>)
      }
    };
  }

  static async searchUsers(query: string, limit: number = 10): Promise<User[]> {
    return await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { email: { contains: query } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        profile: true,
        image: true,
        createdAt: true
      },
      take: limit,
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  static async getAllUsers(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          profile: true,
          image: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              connections: {
                where: { isActive: true }
              },
              reports: {
                where: { isActive: true }
              }
            }
          }
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.user.count()
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  static async getUserActivityLog(userId: string, limit: number = 50) {
    // Buscar atividades recentes do usuário
    const [connections, reportExecutions] = await Promise.all([
      prisma.connection.findMany({
        where: { userId },
        select: {
          id: true,
          platform: true,
          accountName: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: { updatedAt: 'desc' },
        take: limit
      }),
      
      prisma.reportExecution.findMany({
        where: {
          report: { userId }
        },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          report: {
            select: {
              name: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        take: limit
      })
    ]);

    // Combinar e ordenar atividades
    const activities = [
      ...connections.map(conn => ({
        type: 'connection' as const,
        action: 'updated',
        description: `Updated ${conn.platform} connection: ${conn.accountName}`,
        timestamp: conn.updatedAt,
        data: conn
      })),
      ...reportExecutions.map(exec => ({
        type: 'report' as const,
        action: 'executed',
        description: `Executed report: ${exec.report.name} - ${exec.status}`,
        timestamp: exec.startedAt,
        data: exec
      }))
    ];

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  static async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true }
    });

    if (!user || !user.password) {
      return false;
    }

    return await bcrypt.compare(password, user.password);
  }

  static async updateLastLogin(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        updatedAt: new Date()
      }
    });
  }

  // Métodos utilitários para auditoria
  static async getUserSecurityLog(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        updatedAt: true,
        emailVerified: true,
        accounts: {
          select: {
            provider: true,
            createdAt: true
          }
        },
        sessions: {
          select: {
            expires: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    });

    return user;
  }
}
