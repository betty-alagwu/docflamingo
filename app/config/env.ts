function getEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    if (process.env.CI === 'true') {
      return '';
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }

  return value;
}

function getEnvOptional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export const env = {
  get GITHUB_APP_CLIENT_ID() {
    return getEnv('GITHUB_APP_CLIENT_ID');
  },
  get GITHUB_APP_CLIENT_SECRET() {
    return getEnv('GITHUB_APP_CLIENT_SECRET');
  },
  get GITHUB_APP_PRIVATE_KEY() {
    return getEnv('GITHUB_APP_PRIVATE_KEY');
  },
  get DATABASE_URL() {
    return getEnv('DATABASE_URL');
  },
  get CLERK_SECRET_KEY() {
    return getEnv('CLERK_SECRET_KEY');
  },
  get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY() {
    return getEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  },
  get NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL() {
    return getEnvOptional('NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL', '/overview');
  },
  get NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL() {
    return getEnvOptional('NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL', '/overview');
  },
  get DEEPSEEK_API_KEY() {
    return getEnv('DEEPSEEK_API_KEY');
  },
  get TRIGGER_SECRET_KEY() {
    return getEnv('TRIGGER_SECRET_KEY');
  },
};
