import { NextRequest, NextResponse } from 'next/server';
import { PrismaUserService } from '@/lib/services/prisma-user-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password, profile } = body;

    // Validações básicas
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Criar usuário usando Prisma
    const user = await PrismaUserService.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      profile: profile || 'FREE'
    });

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profile
      },
      message: 'User created successfully'
    });

  } catch (error) {
    console.error('Register error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Email already registered')) {
        return NextResponse.json(
          { error: 'Email is already registered' },
          { status: 409 }
        );
      }
      
      if (error.message.includes('Unique constraint')) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Endpoint para verificar se email já existe (útil para validação em tempo real)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      );
    }

    const existingUser = await PrismaUserService.getUserByEmail(email.toLowerCase().trim());

    return NextResponse.json({
      success: true,
      data: {
        exists: !!existingUser,
        available: !existingUser
      }
    });

  } catch (error) {
    console.error('Check email error:', error);
    return NextResponse.json(
      { error: 'Failed to check email availability' },
      { status: 500 }
    );
  }
}
