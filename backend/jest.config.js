/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/lambda.ts',
    '!src/index.ts',
    '!src/routes/index.ts',
    '!src/infrastructure/prismaClient.ts',
    '!src/domain/models/index.ts',
    '!src/domain/repositories/index.ts',
    '!src/application/services/index.ts',
    '!src/presentation/controllers/index.ts',
  ],
};
