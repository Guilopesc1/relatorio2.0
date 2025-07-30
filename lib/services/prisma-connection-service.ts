import { prisma } from '@/lib/prisma';
import { Connection, Platform, UserProfile } from '@prisma/client';
import crypto from 'crypto';

// Limites por perfil de usuário
const CONNECTION_LIMITS = {
  FREE: 1,
  BASIC: 3,
  PRO: 10,
  ENTERPRISE: 50
} as const;

// Chave para criptografia (deve ter 32 caracteres para aes-256-cbc)
// Em produção, use uma variável de ambiente segura.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a-very-secret-key-for-encrypt-123';
const ALGORITHM = 'aes-256-cbc';

// Garante que a chave tenha 32 bytes
const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest('base64').substr(0, 32);

export class PrismaConnectionService {
  
  static async getUserConnectionCount(userId: string, platform?: Platform): Promise<number> {
    const count = await prisma.connection.count({
      where: {
        userId,
        platform,
        isActive: true
      }
    });
    return count;
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
    const maxConnections = CONNECTION_LIMITS[user.profile as keyof typeof CONNECTION_LIMITS];

    return currentCount < maxConnections;
  }

  static async createConnection(data: {
    userId: string;
    platform: Platform;
    accountId: string;
    accountName: string;
    accessToken: string;
    refreshToken?: string | null;
    developerToken?: string | null;
    expiresAt?: Date | null;
  }): Promise<Connection> {
    
    const canAdd = await this.canAddConnection(data.userId, data.platform);
    if (!canAdd) {
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { profile: true }
      });
      
      const profile = (user?.profile || 'FREE') as keyof typeof CONNECTION_LIMITS;
      throw new Error(`Maximum connections reached for ${profile} plan. Limit: ${CONNECTION_LIMITS[profile]}`);
    }

    const existingConnection = await prisma.connection.findFirst({
      where: {
        userId: data.userId,
        platform: data.platform,
        accountId: data.accountId
      }
    });

    if (existingConnection) {
      console.log('Connection exists, updating instead of creating new');
      return await this.updateConnection(existingConnection.id, {
        accountName: data.accountName,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        developerToken: data.developerToken,
        expiresAt: data.expiresAt,
        isActive: true
      });
    }

    const connection = await prisma.connection.create({
      data: {
        userId: data.userId,
        platform: data.platform,
        accountId: data.accountId,
        accountName: data.accountName,
        accessToken: this.encryptToken(data.accessToken),
        refreshToken: data.refreshToken ? this.encryptToken(data.refreshToken) : null,
        developerToken: data.developerToken ? this.encryptToken(data.developerToken) : null,
        expiresAt: data.expiresAt,
        isActive: true
      }
    });

    return {
      ...connection,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      developerToken: data.developerToken
    };
  }

  static async getConnections(userId: string, platform?: Platform): Promise<Connection[]> {
    const connections = await prisma.connection.findMany({
      where: {
        userId,
        platform,
        isActive: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return connections.map(conn => this.decryptConnection(conn));
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
    return this.decryptConnection(connection);
  }

  static async getConnectionByAccount(
    userId: string, 
    platform: Platform, 
    accountId: string
  ): Promise<Connection | null> {
    const connection = await prisma.connection.findFirst({
      where: {
        userId,
        platform,
        accountId,
        isActive: true
      }
    });

    if (!connection) return null;
    return this.decryptConnection(connection);
  }

  static async updateConnection(connectionId: string, data: {
    accountName?: string;
    accessToken?: string;
    refreshToken?: string | null;
    developerToken?: string | null;
    expiresAt?: Date | null;
    isActive?: boolean;
  }): Promise<Connection> {
    const updateData: Partial<Connection> = {};

    if (data.accountName) updateData.accountName = data.accountName;
    if (data.accessToken) updateData.accessToken = this.encryptToken(data.accessToken);
    if (data.refreshToken !== undefined) {
      updateData.refreshToken = data.refreshToken ? this.encryptToken(data.refreshToken) : null;
    }
    if (data.developerToken !== undefined) {
      updateData.developerToken = data.developerToken ? this.encryptToken(data.developerToken) : null;
    }
    if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const connection = await prisma.connection.update({
      where: { id: connectionId },
      data: updateData
    });
    
    return this.decryptConnection(connection);
  }

  static async deleteConnection(userId: string, connectionId: string): Promise<void> {
    await prisma.connection.updateMany({
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
    const profile = user.profile as keyof typeof CONNECTION_LIMITS;
    const maxConnections = CONNECTION_LIMITS[profile];

    return {
      current: currentConnections,
      max: maxConnections,
      profile: profile,
      remaining: maxConnections - currentConnections
    };
  }
  
  static async getConnectionStats(userId: string) {
    const stats = await prisma.connection.groupBy({
      by: ['platform'],
      where: {
        userId,
        isActive: true
      },
      _count: {
        platform: true
      }
    });

    return stats.reduce((acc, stat) => {
      acc[stat.platform] = stat._count.platform;
      return acc;
    }, {} as Record<Platform, number>);
  }

  // Métodos de criptografia corrigidos
  private static encryptToken(token: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }

  private static decryptToken(encryptedToken: string | null): string | null {
    if (!encryptedToken) return null;

    try {
      if (encryptedToken.includes(':')) {
        const [ivHex, encryptedHex] = encryptedToken.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const encrypted = Buffer.from(encryptedHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString('utf8');
      }
      // Fallback para tokens antigos em base64
      return Buffer.from(encryptedToken, 'base64').toString('utf-8');
    } catch (error) {
      console.error('Error decrypting token:', error);
      // Se a descriptografia falhar, retorna nulo para evitar expor dados
      return null; 
    }
  }

  private static decryptConnection(connection: Connection): Connection {
      return {
          ...connection,
          accessToken: this.decryptToken(connection.accessToken) || '',
          refreshToken: this.decryptToken(connection.refreshToken),
          developerToken: this.decryptToken(connection.developerToken),
      }
  }
}
