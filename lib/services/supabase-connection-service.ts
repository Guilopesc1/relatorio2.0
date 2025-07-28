import { createClient } from '@supabase/supabase-js';
import { Platform, UserProfile } from '@prisma/client';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Limites por perfil de usuário
const CONNECTION_LIMITS = {
  FREE: 1,
  BASIC: 3,
  PRO: 10,
  ENTERPRISE: 50
} as const;

export class SupabaseConnectionService {
  
  static async getUserConnectionCount(userId: string, platform?: Platform): Promise<number> {
    let query = supabase
      .from('api_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true);
    
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { count, error } = await query;

    if (error) {
      console.error('Error counting connections:', error);
      throw new Error('Failed to count connections');
    }

    return count || 0;
  }

  static async canAddConnection(userId: string, platform: Platform): Promise<boolean> {
    const { data: user, error } = await supabase
      .from('app_users')
      .select('profile')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    const currentCount = await this.getUserConnectionCount(userId, platform);
    const maxConnections = CONNECTION_LIMITS[user.profile as UserProfile];

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
  }) {
    
    // Verificar se pode adicionar nova conexão
    const canAdd = await this.canAddConnection(data.userId, data.platform);
    if (!canAdd) {
      const { data: user } = await supabase
        .from('app_users')
        .select('profile')
        .eq('id', data.userId)
        .single();
      
      const profile = user?.profile as UserProfile || 'FREE';
      throw new Error(`Maximum connections reached for ${profile} plan. Limit: ${CONNECTION_LIMITS[profile]}`);
    }

    // Verificar se já existe conexão para esta conta
    const { data: existingConnection } = await supabase
      .from('api_connections')
      .select('id')
      .eq('user_id', data.userId)
      .eq('platform', data.platform)
      .eq('account_id', data.accountId)
      .single();

    if (existingConnection) {
      throw new Error('Connection already exists for this account');
    }

    // Criptografar tokens antes de salvar
    const encryptedData = {
      user_id: data.userId,
      platform: data.platform,
      account_id: data.accountId,
      account_name: data.accountName,
      access_token: this.encryptToken(data.accessToken),
      refresh_token: data.refreshToken ? this.encryptToken(data.refreshToken) : null,
      expires_at: data.expiresAt?.toISOString() || null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { data: connection, error } = await supabase
      .from('api_connections')
      .insert(encryptedData)
      .select()
      .single();

    if (error) {
      console.error('Error creating connection:', error);
      throw new Error('Failed to create connection');
    }

    return {
      id: connection.id,
      userId: connection.user_id,
      platform: connection.platform,
      accountId: connection.account_id,
      accountName: connection.account_name,
      accessToken: this.decryptToken(connection.access_token),
      refreshToken: connection.refresh_token ? this.decryptToken(connection.refresh_token) : null,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : null,
      isActive: connection.is_active,
      createdAt: new Date(connection.created_at),
      updatedAt: new Date(connection.updated_at)
    };
  }

  static async getConnections(userId: string, platform?: Platform) {
    let query = supabase
      .from('api_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (platform) {
      query = query.eq('platform', platform);
    }

    const { data: connections, error } = await query;

    if (error) {
      console.error('Error fetching connections:', error);
      throw new Error('Failed to fetch connections');
    }

    // Descriptografar tokens
    return (connections || []).map(conn => ({
      id: conn.id,
      userId: conn.user_id,
      platform: conn.platform,
      accountId: conn.account_id,
      accountName: conn.account_name,
      accessToken: this.decryptToken(conn.access_token),
      refreshToken: conn.refresh_token ? this.decryptToken(conn.refresh_token) : null,
      expiresAt: conn.expires_at ? new Date(conn.expires_at) : null,
      isActive: conn.is_active,
      createdAt: new Date(conn.created_at),
      updatedAt: new Date(conn.updated_at)
    }));
  }

  static async getConnection(userId: string, connectionId: string) {
    const { data: connection, error } = await supabase
      .from('api_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // No rows found
        return null;
      }
      console.error('Error fetching connection:', error);
      throw new Error('Failed to fetch connection');
    }

    if (!connection) return null;

    return {
      id: connection.id,
      userId: connection.user_id,
      platform: connection.platform,
      accountId: connection.account_id,
      accountName: connection.account_name,
      accessToken: this.decryptToken(connection.access_token),
      refreshToken: connection.refresh_token ? this.decryptToken(connection.refresh_token) : null,
      expiresAt: connection.expires_at ? new Date(connection.expires_at) : null,
      isActive: connection.is_active,
      createdAt: new Date(connection.created_at),
      updatedAt: new Date(connection.updated_at)
    };
  }

  static async deleteConnection(userId: string, connectionId: string): Promise<void> {
    const { error } = await supabase
      .from('api_connections')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', connectionId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting connection:', error);
      throw new Error('Failed to delete connection');
    }
  }

  static async getConnectionLimits(userId: string) {
    const { data: user, error } = await supabase
      .from('app_users')
      .select('profile')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new Error('User not found');
    }

    const currentConnections = await this.getUserConnectionCount(userId);
    const profile = user.profile as UserProfile;
    const maxConnections = CONNECTION_LIMITS[profile];

    return {
      current: currentConnections,
      max: maxConnections,
      profile: profile,
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
    const { data: connection, error } = await supabase
      .from('api_connections')
      .select('expires_at')
      .eq('id', connectionId)
      .single();

    if (error || !connection || !connection.expires_at) {
      return true; // Se não tem data de expiração, consideramos válido
    }

    return new Date() < new Date(connection.expires_at);
  }
}
