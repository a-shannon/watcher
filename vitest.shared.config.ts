import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/ergo/utils.spec.ts',
      'tests/ergo/transaction/queue.spec.ts',
    ],
    setupFiles: ['tests/sharedSetup.ts'],
    globals: false,
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    poolOptions: { forks: { execArgv: ['--import', 'tsx'] } },
    env: { NODE_ENV: 'test', NODE_BACKEND: 'js' },
  },
});
