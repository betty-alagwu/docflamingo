# Testing Guide

## Environment Variables

Tests in this project require environment variables to run properly. These are automatically mocked in the `jest.setup.ts` file at the root of the project.

If you need to add new environment variables to your application:

1. Add them to the `envSchema` in `app/config/env.ts`
2. Add mock values for these variables in `jest.setup.ts`

## Running Tests

To run all tests:

```bash
npm run test
```

To run a specific test file:

```bash
npm run test -- path/to/test/file.test.ts
```

To run tests in watch mode:

```bash
npm run test -- --watch
```

## Test Structure

Tests are organized in the `__tests__` directory, mirroring the structure of the `app` directory. For example, tests for `app/services/ai.service.ts` are located in `__tests__/services/ai.service.test.ts`.

## Mocking

Most external dependencies are mocked in the test files. For example, the Octokit client is mocked in the GitHub service tests.

If you need to add new mocks, follow the existing patterns in the test files.
