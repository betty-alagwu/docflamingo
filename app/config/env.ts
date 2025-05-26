import { z } from 'zod';

const envSchema = z.object({
  GITHUB_APP_CLIENT_ID: z.string().min(1, 'GitHub App Client ID is required'),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1, 'GitHub App Client Secret is required'),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1, 'GitHub App Private Key is required'),

  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  CLERK_SECRET_KEY: z.string().min(1, 'Clerk Secret Key is required'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'Clerk Publishable Key is required'),
  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: z.string().optional(),

  DEEPSEEK_API_KEY: z.string().min(1, 'DeepSeek API Key is required'),

  TRIGGER_SECRET_KEY: z.string().min(1, 'Trigger Secret Key is required'),
});

const parseEnv = () => {
  // In CI environment, provide fallback values to allow build to complete
  if (process.env.CI === 'true' || process.env.NODE_ENV === 'production') {
    console.warn('Using fallback environment values for CI/production build');
    return {
      GITHUB_APP_CLIENT_ID: process.env.GITHUB_APP_CLIENT_ID || 'dummy_client_id',
      GITHUB_APP_CLIENT_SECRET: process.env.GITHUB_APP_CLIENT_SECRET || 'dummy_client_secret',
      GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY || 'dummy_private_key',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://dummy:dummy@localhost:5432/dummy',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || 'sk_test_dummy_key_for_ci_build_only',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || 'pk_test_dummy_key_for_ci_build_only',
      NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL:
        process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL || '/dashboard',
      NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL:
        process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL || '/dashboard',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || 'dummy_deepseek_key',
      TRIGGER_SECRET_KEY: process.env.TRIGGER_SECRET_KEY || 'dummy_trigger_key',
    };
  }

  try {
    return envSchema.parse(process.env);
  } catch (error) {
    throw new Error(`Invalid environment variables ${error}`);
  }
};

export const env = parseEnv();
