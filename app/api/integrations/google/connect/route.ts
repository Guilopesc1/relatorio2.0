import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../auth/[...nextauth]/route';
import { createGoogleConnectionStandard } from '../../../../../lib/integrations/google-ads-standard';
import { PrismaConnectionService } from '../../../../../lib/services/prisma-connection-service';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, accessToken, refreshToken, accountName } = body;
    
    // Suporte para ambos os formatos (camelCase e snake_case)
    const access_token = accessToken || body.access_token;
    const refresh_token = refreshToken || body.refresh_token;

    console.log('=== GOOGLE CONNECT DEBUG ===');
    console.log('User ID:', session.user.id);
    console.log('Customer ID:', customerId);
    console.log('Account Name:', accountName);
    console.log('Access Token:', accessToken ? 'RECEIVED' : 'MISSING');
    console.log('Refresh Token:', refreshToken ? 'RECEIVED' : 'MISSING');

    // Validar dados obrigatórios
    if (!customerId || !access_token || !refresh_token) {
      return NextResponse.json({
        error: 'Missing required fields',
        details: 'customerId, accessToken/access_token, and refreshToken/refresh_token are required'
      }, { status: 400 });
    }

    try {
      // Verificar se já existe uma conexão para esta conta
      console.log('Checking for existing connection...');
      
      const existingConnection = await PrismaConnectionService.getConnectionByAccount(
        session.user.id,
        'GOOGLE',
        customerId
      );

      if (existingConnection) {
        console.log('Connection already exists, updating...');
        
        // Atualizar a conexão existente
        const updatedConnection = await PrismaConnectionService.updateConnection(
          existingConnection.id,
          {
            accountName: accountName || existingConnection.accountName,
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora
            isActive: true
          }
        );

        console.log('Connection updated successfully:', updatedConnection.id);

        return NextResponse.json({
          success: true,
          data: updatedConnection,
          message: 'Google Ads connection updated successfully'
        });
      }

      // Para developer token básico, não conseguimos validar o token
      // Vamos criar a conexão diretamente
      console.log('Creating new connection with basic validation...');
      
      const connectionData = {
        userId: session.user.id,
        platform: 'GOOGLE' as const,
        accountId: customerId,
        accountName: accountName || `Google Ads Account ${customerId}`,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hora
        isActive: true
      };

      console.log('Connection data prepared:', {
        userId: connectionData.userId,
        platform: connectionData.platform,
        accountId: connectionData.accountId,
        accountName: connectionData.accountName
      });

      // Salvar no banco via Prisma
      const savedConnection = await PrismaConnectionService.createConnection(connectionData);

      console.log('Connection saved successfully:', savedConnection.id);

      return NextResponse.json({
        success: true,
        data: savedConnection,
        message: `Google Ads account "${connectionData.accountName}" connected successfully!`
      });

    } catch (connectionError) {
      console.error('Error creating/updating connection:', connectionError);
      
      if (connectionError instanceof Error) {
        if (connectionError.message.includes('Maximum connections reached')) {
          return NextResponse.json({
            error: 'Connection limit reached',
            details: connectionError.message,
            suggestion: 'Upgrade your plan to connect more accounts'
          }, { status: 403 });
        }

        if (connectionError.message.includes('User not found')) {
          return NextResponse.json({
            error: 'User validation failed',
            details: 'User not found in database',
            suggestion: 'Please log out and log in again'
          }, { status: 404 });
        }
      }

      return NextResponse.json({
        error: 'Failed to create connection',
        details: connectionError instanceof Error ? connectionError.message : 'Unknown error',
        suggestion: 'Please try again or contact support'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Connect endpoint error:', error);
    
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}