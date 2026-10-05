import '@rosen-bridge/extended-typeorm/bootstrap';
import { describe, expect, it } from 'vitest';
import {
  AvalancheSafetyState,
  AvalancheSafetyState1790769600000,
} from '@rosen-bridge/evm-scanner';

import { dataSource } from '../../config/dataSource';
import { createMemoryDatabase } from '../resources/inMemoryDb';

describe('Avalanche watcher database registration', () => {
  describe('entity and migration registration', () => {
    /**
     * @target dataSource Avalanche safety registration: registers the safety
     * entity and migration in the production data source
     * @dependencies Actual production DataSource definitions; real SQLite
     * migrations and repository from createMemoryDatabase; no external
     * connection
     * @scenario Load the actual production dataSource definition and inspect
     * its registrations without connecting.
     * @expected Contain the actual safety entity/migration and disable schema
     * synchronization.
     */
    it('registers the safety entity and migration in the production data source', () => {
      expect(dataSource.options.entities).toContain(AvalancheSafetyState);
      expect(dataSource.options.migrations).toContain(
        AvalancheSafetyState1790769600000
      );
      expect(dataSource.options.synchronize).toEqual(false);
    });
  });
  describe('runMigrations and persisted safety repository', () => {
    /**
     * @target dataSource Avalanche safety registration: migrates and stores
     * safety identity through the watcher test database
     * @dependencies Actual production DataSource definitions; real SQLite
     * migrations and repository from createMemoryDatabase; no external
     * connection
     * @scenario Initialize the real in-memory migration fixture, insert a
     * synthetic safety row, read it back, and destroy the fixture.
     * @expected Preserve the exact chain/source/start/frontier/hold fields.
     */
    it('migrates and stores safety identity through the watcher test database', async () => {
      const database = await createMemoryDatabase();
      try {
        const repository = database.getRepository(AvalancheSafetyState);
        await repository.insert({
          scanner: 'avalanche',
          chainId: '43113',
          sourceId: 'fuji-rpc-1',
          policy: 'fixture-policy',
          initialHeight: -1,
          finalizedHeight: 10,
          finalizedHash: `0x${'12'.repeat(32)}`,
          holdReason: 'fixture-conflict',
        });
        const state = await repository.findOneByOrFail({
          scanner: 'avalanche',
        });
        expect(state.chainId).toEqual('43113');
        expect(state.sourceId).toEqual('fuji-rpc-1');
        expect(state.initialHeight).toEqual(-1);
        expect(state.finalizedHeight).toEqual(10);
        expect(state.holdReason).toEqual('fixture-conflict');
      } finally {
        await database.destroy();
      }
    });
  });
});
