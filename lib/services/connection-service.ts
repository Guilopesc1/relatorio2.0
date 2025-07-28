import { prisma } from '../prisma';
import { Connection, Platform, UserProfile } from '@prisma/client';

// Limites por perfil de usuário
const CONNECTION_LIMITS = {
  FREE: 1,
  BASIC: 3,
  PRO: 10,
  ENTERPRISE: 50
} as const;

export class ConnectionService {
  
  static async getUserConnectionCount(userId: string, platform?: Platform): Promise<number> {
    const where: any = { 
      userId, 
      isActive: true 
    };
    
    if (platform) {
      where.platform = platform;
    }

    return await prisma.connection.count({ where });
  }

  static async canAddConnection(userId: string, platform: Platform): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentCount = await this.getUserConnectionCount(userId, platform);
    const maxConnections = CONNECTION_LIMITS[user.profile];

    return currentCount < maxConnections;
  }

  static async createConnection(data: {
    userId: string;
    platform: Platform;
    accountId: string;
    accountName: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  }): Promise<Connection> {
    
    // Verificar se pode adicionar nova conexão
    const canAdd = await this.canAddConnection(data.userId, data.platform);
    if (!canAdd) {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { profile: true }
      });
      throw new Error(`Maximum connections reached for ${user?.profile} plan. Limit: ${CONNECTION_LIMITS[user?.profile || 'FREE']}`);
    }

    // Verificar se já existe conexão para esta conta
    const existingConnection = await prisma.connection.findUnique({
      where: {
        userId_platform_accountId: {
          userId: data.userId,
          platform: data.platform,
          accountId: data.accountId
        }
      }
    });

    if (existingConnection) {
      throw new Error('Connection already exists for this account');
    }

    // Criptografar tokens antes de salvar
    const encryptedData = {
      ...data,
      accessToken: this.encryptToken(data.accessToken),
      refreshToken: data.refreshToken ? this.encryptToken(data.refreshToken) : null
    };

    return await prisma.connection.create({
      data: encryptedData
    });
  }

  static async getConnections(userId: string, platform?: Platform): Promise<Connection[]> {
    const where: any = { 
      userId, 
      isActive: true 
    };
    
    if (platform) {
      where.platform = platform;
    }

    const connections = await prisma.connection.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    // Descriptografar tokens
    return connections.map(conn => ({
      ...conn,
      accessToken: this.decryptToken(conn.accessToken),
      refreshToken: conn.refreshToken ? this.decryptToken(conn.refreshToken) : null
    }));
  }

  static async getConnection(userId: string, connectionId: string): Promise<Connection | null> {
    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId,
        isActive: true
      }
    });

    if (!connection) return null;

    return {
      ...connection,
      accessToken: this.decryptToken(connection.accessToken),
      refreshToken: connection.refreshToken ? this.decryptToken(connection.refreshToken) : null
    };
  }

  static async updateConnection(
    userId: string, 
    connectionId: string, 
    data: Partial<{
      accountName: string;
      accessToken: string;
      refreshToken: string | null;
      expiresAt: Date | null;
      isActive: boolean;
    }>
  ): Promise<Connection> {
    
    // Criptografar tokens se fornecidos
    const updateData: any = { ...data };
    if (updateData.accessToken) {
      updateData.accessToken = this.encryptToken(updateData.accessToken);
    }
    if (updateData.refreshToken) {
      updateData.refreshToken = this.encryptToken(updateData.refreshToken);
    }

    const connection = await prisma.connection.update({
      where: {
        id: connectionId,
        userId // Garantir que usuário só pode atualizar suas próprias conexões
      },
      data: updateData
    });

    return {
      ...connection,
      accessToken: this.decryptToken(connection.accessToken),
      refreshToken: connection.refreshToken ? this.decryptToken(connection.refreshToken) : null
    };
  }

  static async deleteConnection(userId: string, connectionId: string): Promise<void> {
    await prisma.connection.update({
      where: {
        id: connectionId,
        userId
      },
      data: {
        isActive: false
      }
    });
  }

  static async getConnectionLimits(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { profile: true }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const currentConnections = await this.getUserConnectionCount(userId);
    const maxConnections = CONNECTION_LIMITS[user.profile];

    return {
      current: currentConnections,
      max: maxConnections,
      profile: user.profile,
      remaining: maxConnections - currentConnections
    };
  }

  // Métodos de criptografia simples (em produção usar algo mais robusto)
  private static encryptToken(token: string): string {
    // Por enquanto, apenas base64 encode
    // Em produção, usar AES-256 com chave secreta
    return Buffer.from(token).toString('base64');
  }

  private static decryptToken(encryptedToken: string): string {
    // Por enquanto, apenas base64 decode
    // Em produção, usar AES-256 com chave secreta
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }

  static async validateTokenExpiration(connectionId: string): Promise<boolean> {
    const connection = await prisma.connection.findUnique({
      where: { id: connectionId }
    });

    if (!connection || !connection.expiresAt) {
      return true; // Se não tem data de expiração, consideramos válido
    }

    return new Date() < connection.expiresAt;
  }

  static async getExpiredConnections(): Promise<Connection[]> {
    const connections = await prisma.connection.findMany({
      where: {
        isActive: true,
        expiresAt: {
          lt: new Date()
        }
      }
    });

    return connections.map(conn => ({
      ...conn,
      accessToken: this.decryptToken(conn.accessToken),
      refreshToken: conn.refreshToken ? this.decryptToken(conn.refreshToken) : null
    }));
  }
}
