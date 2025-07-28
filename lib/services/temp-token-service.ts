// Serviço simples para gerenciar tokens temporários em memória
// Usa globalThis para persistir durante development

interface TempTokenData {
  accessToken: string;
  userId: string;
  timestamp: number;
  expiresAt: number;
}

declare global {
  var __tempTokens: Map<string, TempTokenData> | undefined;
}

class TempTokenService {
  private tokens: Map<string, TempTokenData>;
  
  constructor() {
    // Usar globalThis para persistir durante development
    if (global.__tempTokens) {
      this.tokens = global.__tempTokens;
      console.log('Reusing existing temp tokens:', this.tokens.size);
    } else {
      this.tokens = new Map<string, TempTokenData>();
      global.__tempTokens = this.tokens;
      console.log('Created new temp tokens map');
    }
    
    // Limpar tokens expirados a cada 5 minutos
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  store(accessToken: string, userId: string): string {
    const tokenId = this.generateTokenId();
    const now = Date.now();
    
    const tokenData = {
      accessToken,
      userId,
      timestamp: now,
      expiresAt: now + (10 * 60 * 1000) // 10 minutos
    };

    this.tokens.set(tokenId, tokenData);
    
    console.log('Stored temp token:', { 
      tokenId, 
      userId, 
      totalTokens: this.tokens.size,
      expiresAt: new Date(tokenData.expiresAt).toISOString()
    });

    return tokenId;
  }

  retrieve(tokenId: string): TempTokenData | null {
    console.log('Retrieving temp token:', { 
      tokenId, 
      totalTokens: this.tokens.size,
      allTokens: Array.from(this.tokens.keys())
    });
    
    const data = this.tokens.get(tokenId);
    
    if (!data) {
      console.log('Temp token not found:', tokenId);
      return null;
    }

    if (Date.now() > data.expiresAt) {
      console.log('Temp token expired:', {
        tokenId,
        now: new Date().toISOString(),
        expiresAt: new Date(data.expiresAt).toISOString()
      });
      this.tokens.delete(tokenId);
      return null;
    }

    console.log('Temp token retrieved successfully:', tokenId);
    return data;
  }

  remove(tokenId: string): void {
    const removed = this.tokens.delete(tokenId);
    console.log('Removed temp token:', { tokenId, removed });
  }

  private generateTokenId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [tokenId, data] of this.tokens.entries()) {
      if (now > data.expiresAt) {
        this.tokens.delete(tokenId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired temp tokens`);
    }
  }

  // Método para debug
  getDebugInfo() {
    return {
      totalTokens: this.tokens.size,
      tokens: Array.from(this.tokens.entries()).map(([id, data]) => ({
        id,
        userId: data.userId,
        expiresAt: new Date(data.expiresAt).toISOString(),
        isExpired: Date.now() > data.expiresAt
      }))
    };
  }
}

// Singleton instance
export const tempTokenService = new TempTokenService();
