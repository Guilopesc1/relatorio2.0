import { prisma } from '@/lib/prisma'
import { UserProfile } from '@prisma/client'

export interface ProfileLimits {
  connectionsPerPlatform: number
  totalReports: number
  whatsappNumbers: number
  advancedFeatures: boolean
  priority: 'low' | 'normal' | 'high' | 'critical'
}

export const PROFILE_LIMITS: Record<UserProfile, ProfileLimits> = {
  FREE: {
    connectionsPerPlatform: 1,
    totalReports: 3,
    whatsappNumbers: 1,
    advancedFeatures: false,
    priority: 'low'
  },
  BASIC: {
    connectionsPerPlatform: 3,
    totalReports: 10,
    whatsappNumbers: 3,
    advancedFeatures: false,
    priority: 'normal'
  },
  PRO: {
    connectionsPerPlatform: 10,
    totalReports: 50,
    whatsappNumbers: 10,
    advancedFeatures: true,
    priority: 'high'
  },
  ENTERPRISE: {
    connectionsPerPlatform: 999,
    totalReports: 999,
    whatsappNumbers: 999,
    advancedFeatures: true,
    priority: 'critical'
  }
}

export async function getUserWithStats(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      connections: {
        where: { isActive: true },
        select: {
          id: true,
          platform: true,
          accountName: true,
          createdAt: true,
          isActive: true
        }
      },
      reports: {
        select: {
          id: true,
          name: true,
          isActive: true,
          lastRun: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          connections: true,
          reports: true
        }
      }
    }
  })

  if (!user) return null

  const limits = PROFILE_LIMITS[user.profile]
  
  return {
    ...user,
    limits,
    usage: {
      connections: user._count.connections,
      reports: user._count.reports,
      connectionsPercentage: Math.round((user._count.connections / (limits.connectionsPerPlatform * 3)) * 100),
      reportsPercentage: Math.round((user._count.reports / limits.totalReports) * 100)
    }
  }
}

export async function canUserAddConnection(userId: string, platform: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      connections: {
        where: {
          platform: platform as any,
          isActive: true
        }
      }
    }
  })

  if (!user) return false

  const limits = PROFILE_LIMITS[user.profile]
  return user.connections.length < limits.connectionsPerPlatform
}

export async function canUserAddReport(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { reports: true }
      }
    }
  })

  if (!user) return false

  const limits = PROFILE_LIMITS[user.profile]
  return user._count.reports < limits.totalReports
}