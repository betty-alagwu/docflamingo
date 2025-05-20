import { z } from 'zod';

const envSchema = z.object({
  GITHUB_APP_CLIENT_ID: z.string().min(1, "GitHub App Client ID is required"),
  GITHUB_APP_CLIENT_SECRET: z.string().min(1, "GitHub App Client Secret is required"),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1, "GitHub App Private Key is required"),
  
  DATABASE_URL: z.string().min(1, "Database URL is required"),
  
  CLERK_SECRET_KEY: z.string().min(1, "Clerk Secret Key is required"),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk Publishable Key is required"),
  NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL: z.string().optional(),
  
  DEEPSEEK_API_KEY: z.string().min(1, "DeepSeek API Key is required"),
  
  TRIGGER_SECRET_KEY: z.string().min(1, "Trigger Secret Key is required"),
});

const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    throw new Error("Invalid environment variables");
  }
};

export const env = parseEnv();
