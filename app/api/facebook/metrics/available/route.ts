// ================================
// API ENDPOINT: GET /api/facebook/metrics/available
// Retorna todas as métricas disponíveis do Facebook Ads API
// ================================

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Definição completa das métricas disponíveis no Facebook Ads API
const FACEBOOK_METRICS_CATALOG = {
  // ================================
  // MÉTRICAS BÁSICAS DE PERFORMANCE
  // ================================
  basic: {
    name: "Métricas Básicas",
    description: "Métricas fundamentais de performance da campanha",
    metrics: {
      impressions: {
        name: "Impressões",
        description: "Número total de vezes que o anúncio foi exibido",
        type: "number",
        category: "reach",
        required: false
      },
      reach: {
        name: "Alcance",
        description: "Número de pessoas únicas que viram o anúncio",
        type: "number", 
        category: "reach",
        required: false
      },
      frequency: {
        name: "Frequência",
        description: "Número médio de vezes que cada pessoa viu o anúncio",
        type: "decimal",
        category: "reach",
        required: false
      },
      clicks: {
        name: "Cliques",
        description: "Número total de cliques no anúncio",
        type: "number",
        category: "engagement",
        required: false
      },
      ctr: {
        name: "CTR (%)",
        description: "Taxa de cliques (cliques ÷ impressões)",
        type: "percentage",
        category: "engagement",
        required: false
      },
      spend: {
        name: "Gasto Total",
        description: "Valor total gasto na campanha",
        type: "currency",
        category: "cost",
        required: false
      },
      cpm: {
        name: "CPM",
        description: "Custo por mil impressões",
        type: "currency",
        category: "cost",
        required: false
      },
      cpc: {
        name: "CPC",
        description: "Custo por clique",
        type: "currency",
        category: "cost",
        required: false
      }
    }
  },

  // ================================
  // MÉTRICAS DE TRÁFEGO E CLIQUES
  // ================================
  traffic: {
    name: "Tráfego e Cliques",
    description: "Métricas relacionadas a cliques e direcionamento de tráfego",
    metrics: {
      inline_link_clicks: {
        name: "Cliques em Links (Inline)",
        description: "Cliques em links dentro do anúncio",
        type: "number",
        category: "traffic",
        required: false
      },
      link_click: {
        name: "Cliques no Link",
        description: "Cliques em links do anúncio que levam para fora do Facebook",
        type: "number",
        category: "traffic",
        required: false
      },
      landing_page_view: {
        name: "Visualizações da Landing Page",
        description: "Número de visualizações da página de destino",
        type: "number", 
        category: "traffic",
        required: false
      }
    }
  },

  // ================================
  // MÉTRICAS DE VÍDEO
  // ================================
  video: {
    name: "Métricas de Vídeo",
    description: "Métricas específicas para anúncios em formato de vídeo",
    metrics: {
      video_view: {
        name: "Visualizações de Vídeo",
        description: "Número total de visualizações do vídeo",
        type: "number",
        category: "video",
        required: false
      },
      video_p75_watched_actions: {
        name: "Vídeo 75% Assistido",
        description: "Número de pessoas que assistiram 75% do vídeo",
        type: "number",
        category: "video",
        required: false
      }
    }
  },

  // ================================
  // MÉTRICAS DE CONVERSÃO E-COMMERCE
  // ================================
  ecommerce: {
    name: "E-commerce",
    description: "Conversões relacionadas a vendas online e e-commerce",
    metrics: {
      offsite_conversion_fb_pixel_add_to_cart: {
        name: "Adicionar ao Carrinho",
        description: "Número de produtos adicionados ao carrinho via Pixel",
        type: "number",
        category: "conversion",
        required: false
      },
      offsite_conversion_fb_pixel_initiate_checkout: {
        name: "Iniciar Checkout",
        description: "Número de checkouts iniciados via Pixel",
        type: "number",
        category: "conversion",
        required: false
      },
      offsite_conversion_fb_pixel_purchase: {
        name: "Compras (Pixel)",
        description: "Compras registradas via Facebook Pixel",
        type: "number",
        category: "conversion",
        required: false
      },
      offsite_conversion_fb_pixel_complete_registration: {
        name: "Cadastros Completos",
        description: "Cadastros completos registrados via Pixel",
        type: "number",
        category: "conversion",
        required: false
      },
      offsite_conversion_fb_pixel_custom: {
        name: "Evento Customizado (Pixel)",
        description: "Eventos customizados registrados via Pixel",
        type: "number",
        category: "conversion",
        required: false
      }
    }
  },

  // ================================
  // MÉTRICAS DE LEAD GENERATION
  // ================================
  leads: {
    name: "Geração de Leads",
    description: "Métricas relacionadas à captura de leads",
    metrics: {
      offsite_conversion_fb_pixel_lead: {
        name: "Leads (Pixel)",
        description: "Leads capturados via Facebook Pixel",
        type: "number",
        category: "conversion",
        required: false
      },
      onsite_conversion_lead_grouped: {
        name: "Leads (Facebook)",
        description: "Leads gerados através de formulários nativos do Facebook",
        type: "number",
        category: "conversion",
        required: false
      },
      leadgen_other: {
        name: "Outros Leads",
        description: "Outros tipos de leads capturados",
        type: "number",
        category: "conversion",
        required: false
      }
    }
  },

  // ================================
  // MÉTRICAS DE MESSAGING
  // ================================
  messaging: {
    name: "Messaging",
    description: "Métricas relacionadas a conversas e messaging",
    metrics: {
      onsite_conversion_messaging_conversation_started_7d: {
        name: "Conversas Iniciadas (7d)",
        description: "Conversas iniciadas via Messenger nos últimos 7 dias",
        type: "number",
        category: "engagement",
        required: false
      }
    }
  }
};

// ================================
// TEMPLATES PRÉ-DEFINIDOS
// ================================
const FACEBOOK_TEMPLATES = {
  basic_performance: {
    name: "Performance Básica",
    description: "Métricas essenciais para acompanhar performance geral",
    metrics: [
      "impressions",
      "reach", 
      "frequency",
      "inline_link_clicks",
      "ctr",
      "spend",
      "cpm",
      "cpc"
    ],
    breakdowns: [],
    recommended: true
  },
  lead_generation: {
    name: "Geração de Leads",
    description: "Foco em campanhas de captura de leads",
    metrics: [
      "impressions",
      "reach",
      "spend",
      "inline_link_clicks",
      "link_click",
      "landing_page_view",
      "offsite_conversion_fb_pixel_lead",
      "onsite_conversion_lead_grouped",
      "leadgen_other"
    ],
    breakdowns: [],
    recommended: true
  },
  ecommerce: {
    name: "E-commerce",
    description: "Métricas específicas para vendas online",
    metrics: [
      "impressions",
      "reach",
      "spend",
      "inline_link_clicks",
      "link_click",
      "landing_page_view",
      "offsite_conversion_fb_pixel_add_to_cart",
      "offsite_conversion_fb_pixel_initiate_checkout",
      "offsite_conversion_fb_pixel_purchase",
      "offsite_conversion_fb_pixel_complete_registration"
    ],
    breakdowns: [],
    recommended: true
  },
  video_marketing: {
    name: "Marketing de Vídeo",
    description: "Métricas específicas para campanhas com vídeo",
    metrics: [
      "impressions",
      "reach",
      "spend",
      "video_view",
      "video_p75_watched_actions",
      "inline_link_clicks",
      "link_click",
      "landing_page_view"
    ],
    breakdowns: [],
    recommended: true
  },
  messaging_engagement: {
    name: "Engajamento via Messaging",
    description: "Métricas focadas em conversas e messaging",
    metrics: [
      "impressions",
      "reach",
      "spend",
      "inline_link_clicks",
      "onsite_conversion_messaging_conversation_started_7d",
      "onsite_conversion_lead_grouped"
    ],
    breakdowns: [],
    recommended: false
  },
  complete_funnel: {
    name: "Funil Completo",
    description: "Todas as métricas principais para análise completa do funil",
    metrics: [
      "impressions",
      "reach",
      "spend",
      "inline_link_clicks",
      "link_click",
      "landing_page_view",
      "offsite_conversion_fb_pixel_add_to_cart",
      "offsite_conversion_fb_pixel_initiate_checkout",
      "offsite_conversion_fb_pixel_purchase",
      "offsite_conversion_fb_pixel_lead",
      "onsite_conversion_lead_grouped",
      "video_view",
      "video_p75_watched_actions"
    ],
    breakdowns: [],
    recommended: true
  }
};

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      data: {
        metrics: FACEBOOK_METRICS_CATALOG,
        templates: FACEBOOK_TEMPLATES,
        metadata: {
          totalMetrics: Object.values(FACEBOOK_METRICS_CATALOG).reduce(
            (total, category) => total + Object.keys(category.metrics).length, 
            0
          ),
          totalTemplates: Object.keys(FACEBOOK_TEMPLATES).length,
          lastUpdated: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Erro ao buscar métricas disponíveis:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor' 
      },
      { status: 500 }
    );
  }
}
