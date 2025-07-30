// lib/facebook/token-validator.ts

/**
 * Valida e renova tokens do Facebook quando necessário
 */
export class FacebookTokenValidator {
  
  /**
   * Valida se um token do Facebook ainda é válido
   */
  static async validateToken(accessToken: string): Promise<{ isValid: boolean; error?: string }> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?access_token=${accessToken}`,
        { method: 'GET' }
      );
      
      const data = await response.json();
      
      if (data.error) {
        return {
          isValid: false,
          error: data.error.message || 'Token inválido'
        };
      }
      
      return { isValid: true };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message || 'Erro ao validar token'
      };
    }
  }
  
  /**
   * Tenta renovar um token usando refresh_token (se disponível)
   */
  static async refreshToken(refreshToken: string, appId: string, appSecret: string): Promise<{ success: boolean; accessToken?: string; error?: string }> {
    try {
      const response = await fetch(
        `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${refreshToken}`,
        { method: 'GET' }
      );
      
      const data = await response.json();
      
      if (data.error) {
        return {
          success: false,
          error: data.error.message || 'Erro ao renovar token'
        };
      }
      
      return {
        success: true,
        accessToken: data.access_token
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Erro ao renovar token'
      };
    }
  }
  
  /**
   * Valida e renova token automaticamente se necessário
   */
  static async ensureValidToken(accessToken: string, refreshToken?: string): Promise<{ token: string; isNew: boolean; error?: string }> {
    // Primeiro, tenta validar o token atual
    const validation = await this.validateToken(accessToken);
    
    if (validation.isValid) {
      return {
        token: accessToken,
        isNew: false
      };
    }
    
    // Se o token não é válido e temos um refresh token, tenta renovar
    if (refreshToken) {
      const appId = process.env.FACEBOOK_CLIENT_ID;
      const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
      
      if (appId && appSecret) {
        const refresh = await this.refreshToken(refreshToken, appId, appSecret);
        
        if (refresh.success && refresh.accessToken) {
          return {
            token: refresh.accessToken,
            isNew: true
          };
        }
      }
    }
    
    // Se chegou aqui, não conseguiu validar nem renovar
    return {
      token: accessToken,
      isNew: false,
      error: validation.error || 'Token inválido e não foi possível renovar'
    };
  }
}

/**
 * Helper para logs de debugging do Facebook
 */
export class FacebookLogger {
  static logApiCall(url: string, method: string = 'GET') {
    console.log(`[FB API] ${method} ${url}`);
  }
  
  static logTokenValidation(isValid: boolean, accountId?: string) {
    console.log(`[FB TOKEN] ${accountId ? `Conta ${accountId}: ` : ''}Token ${isValid ? 'válido' : 'inválido'}`);
  }
  
  static logError(error: any, context: string) {
    console.error(`[FB ERROR] ${context}:`, error);
  }
}
