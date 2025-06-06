/**
 * Environment configuration with lazy validation
 * No hardcoded dummy values - validation only happens when variables are accessed
 */

/**
 * Get environment variable with runtime validation
 * Only validates when actually accessed, not at build time
 */
function getEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }

  return value;
}

/**
 * Get environment variable with optional fallback
 */
function getEnvOptional(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

/**
 * Environment configuration with lazy validation
 * Values are only validated when accessed, allowing builds to complete
 */
export const env = {
  get GITHUB_APP_CLIENT_ID() { return getEnv('GITHUB_APP_CLIENT_ID'); },
  get GITHUB_APP_CLIENT_SECRET() { return getEnv('GITHUB_APP_CLIENT_SECRET'); },
  get GITHUB_APP_PRIVATE_KEY() { return getEnv('GITHUB_APP_PRIVATE_KEY'); },
  get DATABASE_URL() { return getEnv('DATABASE_URL'); },
  get CLERK_SECRET_KEY() { return getEnv('CLERK_SECRET_KEY'); },
  get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY() { return getEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'); },
  get NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL() { return getEnvOptional('NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL', '/dashboard'); },
  get NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL() { return getEnvOptional('NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL', '/dashboard'); },
  get DEEPSEEK_API_KEY() { return getEnv('DEEPSEEK_API_KEY'); },
  get TRIGGER_SECRET_KEY() { return getEnv('TRIGGER_SECRET_KEY'); },
};
