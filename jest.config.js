module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/__tests__/(.*)$': '<rootDir>/__tests__/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    '!app/**/*.d.ts',
    '!app/**/_*.{ts,tsx}',
    '!app/components/**/*.tsx',
    '!app/**/page.tsx',
    '!app/**/layout.tsx',
    '!app/globals.css',
    '!app/home.css',
  ],
  coverageThreshold: {
    global: {
      branches: 40,
      functions: 60,
      lines: 55,
      statements: 55,
    },
  },
};
