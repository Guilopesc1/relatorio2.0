import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configuração específica para SQLite
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Função para testar conectividade
export async function testPrismaConnection() {
  try {
    await prisma.$connect()
    console.log('✅ Prisma SQLite connection successful')
    return true
  } catch (error) {
    console.error('❌ Prisma connection failed:', error)
    return false
  }
}

// Cleanup function
export async function disconnectPrisma() {
  await prisma.$disconnect()
}
