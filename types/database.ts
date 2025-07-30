// Tipos que substituem os enums do Prisma para SQLite

export type UserProfile = 'FREE' | 'BASIC' | 'PRO' | 'ENTERPRISE';

export type Platform = 'FACEBOOK' | 'GOOGLE' | 'TIKTOK';

export type ExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';

export type FacebookAccountStatus = 'ACTIVE' | 'INACTIVE' | 'EXPIRED' | 'ERROR';

export type FacebookObjectType = 'ACCOUNT' | 'CAMPAIGN' | 'ADSET' | 'AD';

// Constantes para validação
export const USER_PROFILES: UserProfile[] = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'];

export const PLATFORMS: Platform[] = ['FACEBOOK', 'GOOGLE', 'TIKTOK'];

export const EXECUTION_STATUSES: ExecutionStatus[] = ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'];

export const FACEBOOK_ACCOUNT_STATUSES: FacebookAccountStatus[] = ['ACTIVE', 'INACTIVE', 'EXPIRED', 'ERROR'];

export const FACEBOOK_OBJECT_TYPES: FacebookObjectType[] = ['ACCOUNT', 'CAMPAIGN', 'ADSET', 'AD'];

// Helper functions para validação
export const isValidUserProfile = (profile: string): profile is UserProfile => {
  return USER_PROFILES.includes(profile as UserProfile);
};

export const isValidPlatform = (platform: string): platform is Platform => {
  return PLATFORMS.includes(platform as Platform);
};

export const isValidExecutionStatus = (status: string): status is ExecutionStatus => {
  return EXECUTION_STATUSES.includes(status as ExecutionStatus);
};

export const isValidFacebookAccountStatus = (status: string): status is FacebookAccountStatus => {
  return FACEBOOK_ACCOUNT_STATUSES.includes(status as FacebookAccountStatus);
};

export const isValidFacebookObjectType = (type: string): type is FacebookObjectType => {
  return FACEBOOK_OBJECT_TYPES.includes(type as FacebookObjectType);
};
