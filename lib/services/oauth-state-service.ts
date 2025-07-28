// Serviço para gerenciar states OAuth temporários
// Usa globalThis para persistir durante development

interface OAuthState {
  userId: string;
  timestamp: number;
  expiresAt: number;
}

declare global {
  var __oauthStates: Map<string, OAuthState> | undefined;
}

class OAuthStateService {
  private states: Map<string, OAuthState>;
  
  constructor() {
    // Usar globalThis para persistir durante development
    if (global.__oauthStates) {
      this.states = global.__oauthStates;
      console.log('Reusing existing OAuth states:', this.states.size);
    } else {
      this.states = new Map<string, OAuthState>();
      global.__oauthStates = this.states;
      console.log('Created new OAuth states map');
    }
    
    // Limpar states expirados a cada 5 minutos
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  generate(userId: string): string {
    const stateId = this.generateStateId();
    const now = Date.now();
    
    const stateData = {
      userId,
      timestamp: now,
      expiresAt: now + (15 * 60 * 1000) // 15 minutos
    };
    
    this.states.set(stateId, stateData);
    
    console.log('Generated OAuth state:', { 
      stateId, 
      userId, 
      totalStates: this.states.size,
      expiresAt: new Date(stateData.expiresAt).toISOString()
    });

    return stateId;
  }

  validate(stateId: string, userId: string): boolean {
    console.log('Validating state:', { 
      stateId, 
      userId, 
      totalStates: this.states.size,
      allStates: Array.from(this.states.keys())
    });
    
    const stateData = this.states.get(stateId);
    
    if (!stateData) {
      console.log('State not found:', stateId);
      return false;
    }

    if (Date.now() > stateData.expiresAt) {
      console.log('State expired:', { 
        stateId, 
        now: new Date().toISOString(),
        expiresAt: new Date(stateData.expiresAt).toISOString()
      });
      this.states.delete(stateId);
      return false;
    }

    if (stateData.userId !== userId) {
      console.log('State user mismatch:', { 
        stateId,
        expected: stateData.userId, 
        actual: userId 
      });
      return false;
    }

    // State válido, remover após uso
    this.states.delete(stateId);
    console.log('State validation successful, removed state:', stateId);
    return true;
  }

  private generateStateId(): string {
    return `oauth_${Math.random().toString(36).substr(2, 9)}_${Date.now().toString(36)}`;
  }

  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [stateId, stateData] of this.states.entries()) {
      if (now > stateData.expiresAt) {
        this.states.delete(stateId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`Cleaned up ${cleanedCount} expired OAuth states`);
    }
  }

  // Método para debug
  getDebugInfo() {
    return {
      totalStates: this.states.size,
      states: Array.from(this.states.entries()).map(([id, data]) => ({
        id,
        userId: data.userId,
        expiresAt: new Date(data.expiresAt).toISOString(),
        isExpired: Date.now() > data.expiresAt
      }))
    };
  }
}

// Singleton instance
export const oauthStateService = new OAuthStateService();
