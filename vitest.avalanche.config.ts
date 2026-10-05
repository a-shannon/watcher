import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/config/avalancheConfig.spec.ts',
      'tests/database/avalancheSafetyState.spec.ts',
      'tests/utils/avalancheSafety.spec.ts',
      'tests/utils/avalancheScanner.spec.ts',
      'tests/transactions/avalancheCommitmentCreation.spec.ts',
      'tests/transactions/avalancheCommitmentReveal.spec.ts',
      'tests/ergo/transaction/avalancheQueue.spec.ts',
      'tests/jobs/initScanner.spec.ts',
    ],
    setupFiles: ['tests/setup-tests.ts'],
    globals: false,
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--import', 'tsx'] } },
    env: { NODE_ENV: 'test', NODE_BACKEND: 'js' },
  },
});
