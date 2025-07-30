import { prisma } from './lib/prisma'
import { Platform, UserProfile } from '@prisma/client'

const CONNECTION_LIMITS = {
  FREE: 1,
  BASIC: 3,
  PRO: 10,
  ENTERPRISE: 50
} as const;

export class PrismaConnectionService {
  // 1. Conta quantas conexões o usuário tem
  static async getUserConnectionCount(userId: string, platform?: Platform): Promise<number> {
    return prisma.api_connections.count({
      where: {
        user_id: userId,
        is_active: true,
        ...(platform && { platform }),
      },
    });
  }

  // 2. Checa se pode adicionar nova conexão
  static async canAddConnection(userId: string, platform: Platform): Promise<boolean> {
    const user = await prisma.app_users.findUnique({
      where: { id: userId },
      select: { profile: true },
    });

    if (!user) throw new Error('User not found');

    const currentCount = await this.getUserConnectionCount(userId, platform);
    const maxConnections = CONNECTION_LIMITS[user.profile as UserProfile];
    return currentCount < maxConnections;
  }

  // 3. Cria nova conexão (ou atualiza se já existir)
  static async createConnection(data: {
    userId: string;
    platform: Platform;
    accountId: string;
    accountName: string;
    accessToken: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
  }) {
    // Verifica se pode adicionar nova
    const canAdd = await this.canAddConnection(data.userId, data.platform);
    if (!canAdd) {
      const user = await prisma.app_users.findUnique({
        where: { id: data.userId },
        select: { profile: true },
      });
      const profile = user?.profile as UserProfile || 'FREE';
      throw new Error(`Maximum connections reached for ${profile} plan. Limit: ${CONNECTION_LIMITS[profile]}`);
    }

    // Verifica se já existe
    const existingConnection = await prisma.api_connections.findFirst({
      where: {
        user_id: data.userId,
        platform: data.platform,
        account_id: data.accountId,
      },
    });

    if (existingConnection) {
      return await this.updateConnection(existingConnection.id, {
        accountName: data.accountName,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresAt: data.expiresAt,
        isActive: true,
      });
    }

    // Cria nova conexão
    const newConnection = await prisma.api_connections.create({
      data: {
        user_id: data.userId,
        platform: data.platform,
        account_id: data.accountId,
        account_name: data.accountName,
        access_token: this.encryptToken(data.accessToken),
        refresh_token: data.refreshToken ? this.encryptToken(data.refreshToken) : null,
        expires_at: data.expiresAt,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      id: newConnection.id,
      userId: newConnection.user_id,
      platform: newConnection.platform,
      accountId: newConnection.account_id,
      accountName: newConnection.account_name,
      accessToken: this.decryptToken(newConnection.access_token),
      refreshToken: newConnection.refresh_token ? this.decryptToken(newConnection.refresh_token) : null,
      expiresAt: newConnection.expires_at,
      isActive: newConnection.is_active,
      createdAt: newConnection.created_at,
      updatedAt: newConnection.updated_at,
    };
  }

  // 4. Lista conexões
  static async getConnections(userId: string, platform?: Platform) {
    const connections = await prisma.api_connections.findMany({
      where: {
        user_id: userId,
        is_active: true,
        ...(platform && { platform }),
      },
      orderBy: { created_at: 'desc' },
    });

    return connections.map(conn => ({
      id: conn.id,
      userId: conn.user_id,
      platform: conn.platform,
      accountId: conn.account_id,
      accountName: conn.account_name,
      accessToken: this.decryptToken(conn.access_token),
      refreshToken: conn.refresh_token ? this.decryptToken(conn.refresh_token) : null,
      expiresAt: conn.expires_at,
      isActive: conn.is_active,
      createdAt: conn.created_at,
      updatedAt: conn.updated_at,
    }));
  }

  // 5. Pega conexão única
  static async getConnection(userId: string, connectionId: string) {
    const connection = await prisma.api_connections.findFirst({
      where: {
        id: connectionId,
        user_id: userId,
        is_active: true,
      },
    });

    if (!connection) return null;

    return {
      id: connection.id,
      userId: connection.user_id,
      platform: connection.platform,
      accountId: connection.account_id,
      accountName: connection.account_name,
      accessToken: this.decryptToken(connection.access_token),
      refreshToken: connection.refresh_token ? this.decryptToken(connection.refresh_token) : null,
      expiresAt: connection.expires_at,
      isActive: connection.is_active,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };
  }

  // 6. Deleta (desativa) conexão
  static async deleteConnection(userId: string, connectionId: string): Promise<void> {
    await prisma.api_connections.updateMany({
      where: {
        id: connectionId,
        user_id: userId,
      },
      data: {
        is_active: false,
        updated_at: new Date(),
      },
    });
  }

  // 7. Atualiza conexão
  static async updateConnection(connectionId: string, data: {
    accountName?: string;
    accessToken?: string;
    refreshToken?: string | null;
    expiresAt?: Date | null;
    isActive?: boolean;
  }) {
    const updateData: any = {
      updated_at: new Date(),
    };

    if (data.accountName) updateData.account_name = data.accountName;
    if (data.accessToken) updateData.access_token = this.encryptToken(data.accessToken);
    if (data.refreshToken !== undefined) {
      updateData.refresh_token = data.refreshToken ? this.encryptToken(data.refreshToken) : null;
    }
    if (data.expiresAt !== undefined) {
      updateData.expires_at = data.expiresAt;
    }
    if (data.isActive !== undefined) updateData.is_active = data.isActive;

    const connection = await prisma.api_connections.update({
      where: { id: connectionId },
      data: updateData,
    });

    return {
      id: connection.id,
      userId: connection.user_id,
      platform: connection.platform,
      accountId: connection.account_id,
      accountName: connection.account_name,
      accessToken: this.decryptToken(connection.access_token),
      refreshToken: connection.refresh_token ? this.decryptToken(connection.refresh_token) : null,
      expiresAt: connection.expires_at,
      isActive: connection.is_active,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };
  }

  // 8. Limites por usuário
  static async getConnectionLimits(userId: string) {
    const user = await prisma.app_users.findUnique({
      where: { id: userId },
      select: { profile: true },
    });

    if (!user) throw new Error('User not found');

    const currentConnections = await this.getUserConnectionCount(userId);
    const profile = user.profile as UserProfile;
    const maxConnections = CONNECTION_LIMITS[profile];

    return {
      current: currentConnections,
      max: maxConnections,
      profile: profile,
      remaining: maxConnections - currentConnections,
    };
  }

  // 9. Criptografia simples (para produção, melhorar)
  private static encryptToken(token: string): string {
    return Buffer.from(token).toString('base64');
  }
  private static decryptToken(encryptedToken: string): string {
    return Buffer.from(encryptedToken, 'base64').toString('utf-8');
  }

  // 10. Valida expiração do token
  static async validateTokenExpiration(connectionId: string): Promise<boolean> {
    const connection = await prisma.api_connections.findUnique({
      where: { id: connectionId },
      select: { expires_at: true },
    });

    if (!connection || !connection.expires_at) return true;
    return new Date() < connection.expires_at;
  }

  // 11. Busca conexão por conta
  static async getConnectionByAccount(userId: string, platform: Platform, accountId: string) {
    const connection = await prisma.api_connections.findFirst({
      where: {
        user_id: userId,
        platform,
        account_id: accountId,
      },
    });

    if (!connection) return null;

    return {
      id: connection.id,
      userId: connection.user_id,
      platform: connection.platform,
      accountId: connection.account_id,
      accountName: connection.account_name,
      accessToken: this.decryptToken(connection.access_token),
      refreshToken: connection.refresh_token ? this.decryptToken(connection.refresh_token) : null,
      expiresAt: connection.expires_at,
      isActive: connection.is_active,
      createdAt: connection.created_at,
      updatedAt: connection.updated_at,
    };
  }
}
