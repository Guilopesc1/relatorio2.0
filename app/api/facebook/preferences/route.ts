// ================================
// API ENDPOINT: /api/facebook/preferences
// Gerencia as preferências de métricas do usuário para Facebook Ads
// ================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { supabase } from '@/lib/supabase';

// ================================
// GET - Buscar preferências do usuário
// ================================
export async function GET() {
  try {
    // Em produção, verificar autenticação
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Para desenvolvimento, usar um ID fixo
    const userId = 'test-user-id';

    const { data: preferences, error } = await supabase
      .from('user_facebook_metric_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !preferences) {
      // Retornar preferências padrão se não existir
      const defaultPreferences = {
        enabledMetrics: [
          'impressions',
          'reach',
          'frequency', 
          'clicks',
          'ctr',
          'spend',
          'cpm',
          'cpc'
        ],
        metricAliases: {},
        cacheDurationHours: 4,
        autoRefresh: true,
        enabledBreakdowns: [],
        defaultDateRange: 7,
        defaultObjectLevel: 'CAMPAIGN'
      };

      return NextResponse.json({
        success: true,
        data: defaultPreferences
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        enabledMetrics: preferences.enabled_metrics,
        metricAliases: preferences.metric_aliases,
        cacheDurationHours: preferences.cache_duration_hours,
        autoRefresh: preferences.auto_refresh,
        enabledBreakdowns: preferences.enabled_breakdowns,
        defaultDateRange: preferences.default_date_range,
        defaultObjectLevel: preferences.default_object_level
      }
    });

  } catch (error) {
    console.error('Erro ao buscar preferências:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// ================================
// POST - Salvar preferências do usuário
// ================================
export async function POST(request: NextRequest) {
  try {
    // Em produção, verificar autenticação
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Para desenvolvimento, usar um ID fixo
    const userId = 'test-user-id';

    const body = await request.json();
    
    // Validar dados recebidos
    const {
      enabledMetrics = [],
      metricAliases = {},
      cacheDurationHours = 4,
      autoRefresh = true,
      enabledBreakdowns = [],
      defaultDateRange = 7,
      defaultObjectLevel = 'CAMPAIGN'
    } = body;

    // Validações básicas
    if (!Array.isArray(enabledMetrics)) {
      return NextResponse.json(
        { success: false, error: 'enabledMetrics deve ser um array' },
        { status: 400 }
      );
    }

    if (cacheDurationHours < 1 || cacheDurationHours > 24) {
      return NextResponse.json(
        { success: false, error: 'cacheDurationHours deve estar entre 1 e 24' },
        { status: 400 }
      );
    }

    if (defaultDateRange < 1 || defaultDateRange > 365) {
      return NextResponse.json(
        { success: false, error: 'defaultDateRange deve estar entre 1 e 365' },
        { status: 400 }
      );
    }

    const validObjectLevels = ['ACCOUNT', 'CAMPAIGN', 'ADSET', 'AD'];
    if (!validObjectLevels.includes(defaultObjectLevel)) {
      return NextResponse.json(
        { success: false, error: 'defaultObjectLevel inválido' },
        { status: 400 }
      );
    }

    // Salvar ou atualizar preferências usando upsert do Supabase
    const { data: preferences, error } = await supabase
      .from('user_facebook_metric_preferences')
      .upsert({
        user_id: userId,
        enabled_metrics: enabledMetrics,
        metric_aliases: metricAliases,
        cache_duration_hours: cacheDurationHours,
        auto_refresh: autoRefresh,
        enabled_breakdowns: enabledBreakdowns,
        default_date_range: defaultDateRange,
        default_object_level: defaultObjectLevel,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar preferências:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao salvar preferências' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preferências salvas com sucesso',
      data: {
        id: preferences.id,
        enabledMetrics: preferences.enabled_metrics,
        metricAliases: preferences.metric_aliases,
        cacheDurationHours: preferences.cache_duration_hours,
        autoRefresh: preferences.auto_refresh,
        enabledBreakdowns: preferences.enabled_breakdowns,
        defaultDateRange: preferences.default_date_range,
        defaultObjectLevel: preferences.default_object_level,
        updatedAt: preferences.updated_at
      }
    });

  } catch (error) {
    console.error('Erro ao salvar preferências:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}

// ================================
// DELETE - Resetar preferências para padrão
// ================================
export async function DELETE() {
  try {
    // Em produção, verificar autenticação
    // const session = await getServerSession(authOptions);
    // if (!session?.user?.id) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    // Para desenvolvimento, usar um ID fixo
    const userId = 'test-user-id';

    const { error } = await supabase
      .from('user_facebook_metric_preferences')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Erro ao resetar preferências:', error);
      return NextResponse.json(
        { success: false, error: 'Erro ao resetar preferências' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preferências resetadas para o padrão'
    });

  } catch (error) {
    console.error('Erro ao resetar preferências:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
