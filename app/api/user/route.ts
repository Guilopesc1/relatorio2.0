import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { PrismaUserService } from '@/lib/services/prisma-user-service';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'profile':
        const userWithStats = await PrismaUserService.getUserStats(session.user.id);
        return NextResponse.json({
          success: true,
          data: userWithStats
        });

      case 'activity':
        const limit = parseInt(searchParams.get('limit') || '50');
        const activities = await PrismaUserService.getUserActivityLog(session.user.id, limit);
        return NextResponse.json({
          success: true,
          data: { activities }
        });

      case 'security':
        const securityLog = await PrismaUserService.getUserSecurityLog(session.user.id);
        return NextResponse.json({
          success: true,
          data: securityLog
        });

      default:
        const user = await PrismaUserService.getUserById(session.user.id);
        if (!user) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            image: user.image,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        });
    }

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user data' }, 
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...updateData } = body;

    switch (action) {
      case 'change-password':
        const { oldPassword, newPassword } = updateData;
        
        if (!oldPassword || !newPassword) {
          return NextResponse.json({ 
            error: 'Old password and new password are required' 
          }, { status: 400 });
        }

        await PrismaUserService.changePassword(session.user.id, oldPassword, newPassword);
        
        return NextResponse.json({
          success: true,
          message: 'Password changed successfully'
        });

      case 'update-profile':
        const { profile } = updateData;
        
        if (!profile) {
          return NextResponse.json({ 
            error: 'Profile is required' 
          }, { status: 400 });
        }

        const updatedUser = await PrismaUserService.updateProfile(session.user.id, profile);
        
        return NextResponse.json({
          success: true,
          data: {
            id: updatedUser.id,
            name: updatedUser.name,
            email: updatedUser.email,
            profile: updatedUser.profile,
            image: updatedUser.image
          }
        });

      case 'verify-password':
        const { password } = updateData;
        
        if (!password) {
          return NextResponse.json({ 
            error: 'Password is required' 
          }, { status: 400 });
        }

        const isValid = await PrismaUserService.validatePassword(session.user.id, password);
        
        return NextResponse.json({
          success: true,
          data: { isValid }
        });

      default:
        // Update geral do usuário
        const { name, email, image } = updateData;
        
        const user = await PrismaUserService.updateUser(session.user.id, {
          name,
          email,
          image
        });

        return NextResponse.json({
          success: true,
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
            image: user.image,
            emailVerified: user.emailVerified
          },
          message: 'User updated successfully'
        });
    }

  } catch (error) {
    console.error('Update user error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Email already in use')) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      
      if (error.message.includes('Current password is incorrect')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to update user' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { password, confirmation } = body;

    if (!password || confirmation !== 'DELETE_ACCOUNT') {
      return NextResponse.json({ 
        error: 'Password and confirmation required' 
      }, { status: 400 });
    }

    // Verificar senha antes de deletar
    const isValidPassword = await PrismaUserService.validatePassword(session.user.id, password);
    
    if (!isValidPassword) {
      return NextResponse.json({ 
        error: 'Invalid password' 
      }, { status: 400 });
    }

    // Deletar usuário (cascata deletará conexões, relatórios, etc.)
    await PrismaUserService.deleteUser(session.user.id);

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' }, 
      { status: 500 }
    );
  }
}
