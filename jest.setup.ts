// Mock environment variables for tests
process.env.GITHUB_APP_CLIENT_ID = 'test-client-id';
process.env.GITHUB_APP_CLIENT_SECRET = 'test-client-secret';
process.env.GITHUB_APP_PRIVATE_KEY = 'test-private-key';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CLERK_SECRET_KEY = 'test-clerk-secret-key';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'test-clerk-publishable-key';
process.env.DEEPSEEK_API_KEY = 'test-deepseek-api-key';
process.env.TRIGGER_SECRET_KEY = 'test-trigger-secret-key';

// Optional environment variables
process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL = '/dashboard';
process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL = '/dashboard';

// Mock modules that might cause issues in tests
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '',
}));
