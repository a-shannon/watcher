import '@rosen-bridge/extended-typeorm/bootstrap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSource } from '@rosen-bridge/extended-typeorm';
import {
  BlockEntity,
  ExtractorStatusEntity,
  migrations,
} from '@rosen-bridge/abstract-scanner';
import { ObservationEntity } from '@rosen-bridge/abstract-observation-extractor';
import {
  AvalancheRpcNetwork,
  AvalancheRpcScanner,
  AvalancheSafetyState,
  AvalancheSafetyState1790769600000,
} from '@rosen-bridge/evm-scanner';
import { AvalancheObservationSafety } from '../../src/utils/avalancheSafety';

/** Encode a deterministic synthetic block hash for the requested fixture height. */
const hash = (height: number) => '0x' + height.toString(16).padStart(64, '0');
/** Build an observation bound to the fixture scanner's completed block one. */
const observation = () =>
  Object.assign(new ObservationEntity(), {
    fromChain: 'avalanche',
    height: 1,
    block: hash(1),
    sourceBlockId: hash(1),
    extractor: 'avalanche-rpc-extractor',
  });
/** Await a rejection and verify the expected safety diagnostic. */
const rejected = async (operation: Promise<unknown>, message: string) => {
  let error: unknown;
  try {
    await operation;
  } catch (caught) {
    error = caught;
  }
  expect(String(error)).toContain(message);
};

describe('AvalancheObservationSafety', () => {
  let database: DataSource;
  let network: AvalancheRpcNetwork;
  let scanner: AvalancheRpcScanner;
  let safety: AvalancheObservationSafety;

  beforeEach(async () => {
    database = await new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: false,
      entities: [BlockEntity, ExtractorStatusEntity, AvalancheSafetyState],
      migrations: [...migrations.sqlite, AvalancheSafetyState1790769600000],
    }).initialize();
    await database.runMigrations();
    network = new AvalancheRpcNetwork('http://127.0.0.1:1', 43113n);
    vi.spyOn(network, 'getCurrentHeight').mockResolvedValue(2);
    vi.spyOn(network, 'getBlockAtHeight').mockImplementation(
      async (height) => ({
        height,
        hash: hash(height),
        parentHash: hash(height - 1),
        timestamp: 1790769600 + height,
        txCount: 0,
      })
    );
    vi.spyOn(network, 'getBlockTxs').mockResolvedValue([]);
    scanner = new AvalancheRpcScanner({
      dataSource: database,
      network,
      initialHeight: 0,
      sourceId: 'fixture-fuji',
      blockCleanupConfig: {
        blockCleanupThresholdDuration: 86400,
        blockTrimCountInRound: 0,
      },
    });
    safety = new AvalancheObservationSafety(
      () => 'avalanche',
      () => scanner
    );
    await scanner.update();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    network['provider'].destroy();
    await database.destroy();
  });
  describe('assertObservation', () => {
    /**
     * @target AvalancheObservationSafety.assertObservation: rejects a generic
     * or missing scanner
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Construct the safety reader with no settled Avalanche scanner
     * and check the synthetic observation.
     * @expected Reject the missing settled scanner.
     */
    it('rejects a generic or missing scanner', async () => {
      await rejected(
        new AvalancheObservationSafety(
          () => 'avalanche',
          () => undefined
        ).assertObservation(observation()),
        'requires its settled scanner'
      );
    });
  });
  describe('withObservation', () => {
    /**
     * @target AvalancheObservationSafety.withObservation: accepts a matching
     * completed block from the qualified source
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Read the synthetic observation and execute its action through
     * the actual qualified completed-block lease.
     * @expected Return executed from the qualified action.
     */
    it('accepts a matching completed block from the qualified source', async () => {
      await safety.assertObservation(observation());
      expect(
        await safety.withObservation(observation(), () => 'executed')
      ).toEqual('executed');
    });

    /**
     * @target AvalancheObservationSafety.withObservation: fails closed without
     * persisted qualification
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Clear only the persisted safety row, then try eligibility and
     * action-time checks.
     * @expected Both checks reject qualification and the action is never
     * called.
     */
    it('fails closed without persisted qualification', async () => {
      await database.getRepository(AvalancheSafetyState).clear();
      await rejected(safety.assertObservation(observation()), 'not qualified');
      const action = vi.fn();
      await rejected(
        safety.withObservation(observation(), action),
        'not qualified'
      );
      expect(action).not.toHaveBeenCalled();
    });

    const literalControlCases1 = [
      ['hold', { holdReason: 'fixture-conflict' }],
      ['source', { sourceId: 'another-provider' }],
      ['chain', { chainId: '43114' }],
      ['policy', { policy: 'another-policy' }],
      ['initial height', { initialHeight: 1 }],
      ['missing frontier height', { finalizedHeight: null }],
      ['missing frontier hash', { finalizedHash: null }],
    ] as const;
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl1_0 = async ([
      name,
      change,
    ]: typeof literalControlCases1[number]) => {
      await database
        .getRepository(AvalancheSafetyState)
        .update({ scanner: 'avalanche' }, change);
      await rejected(safety.assertObservation(observation()), 'not qualified');
      const action = vi.fn();
      await rejected(
        safety.withObservation(observation(), action),
        'not qualified'
      );
      expect(action).not.toHaveBeenCalled();
    };

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed hold
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed hold', async () =>
      await runLiteralControl1_0(literalControlCases1[0]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed source
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed source', async () =>
      await runLiteralControl1_0(literalControlCases1[1]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed chain
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed chain', async () =>
      await runLiteralControl1_0(literalControlCases1[2]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed policy
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed policy', async () =>
      await runLiteralControl1_0(literalControlCases1[3]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed initial height
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed initial height', async () =>
      await runLiteralControl1_0(literalControlCases1[4]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed missing frontier height
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed missing frontier height', async () =>
      await runLiteralControl1_0(literalControlCases1[5]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects changed missing frontier hash
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Change exactly the named persisted safety field, then try
     * eligibility and action-time checks.
     * @expected Reject qualification and never call the action.
     */
    it('rejects changed missing frontier hash', async () =>
      await runLiteralControl1_0(literalControlCases1[6]));

    const literalControlCases2 = [
      ['unfinished block', { status: 'PROCESSING' }],
      ['wrong stored hash', { hash: hash(8) }],
      ['wrong scanner', { scanner: 'ethereum' }],
    ] as const;
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl2_0 = async ([
      name,
      change,
    ]: typeof literalControlCases2[number]) => {
      await database.getRepository(BlockEntity).update({ height: 1 }, change);
      await rejected(
        safety.assertObservation(observation()),
        'no matching completed block'
      );
      const action = vi.fn();
      await rejected(
        safety.withObservation(observation(), action),
        'no matching completed block'
      );
      expect(action).not.toHaveBeenCalled();
    };

    /**
     * @target AvalancheObservationSafety.withObservation: rejects unfinished block
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects unfinished block', async () =>
      await runLiteralControl2_0(literalControlCases2[0]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects wrong stored hash
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects wrong stored hash', async () =>
      await runLiteralControl2_0(literalControlCases2[1]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects wrong scanner
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects wrong scanner', async () =>
      await runLiteralControl2_0(literalControlCases2[2]));

    const literalControlCases3 = [
      ['missing observation', undefined],
      ['wrong source chain', { ...observation(), fromChain: 'ethereum' }],
      [
        'wrong extractor',
        { ...observation(), extractor: 'ethereum-rpc-extractor' },
      ],
      ['source block mismatch', { ...observation(), sourceBlockId: hash(7) }],
    ] as const;
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl3_0 = async ([
      name,
      value,
    ]: typeof literalControlCases3[number]) => {
      await rejected(
        safety.assertObservation(value),
        'Invalid Avalanche observation provenance'
      );
      const action = vi.fn().mockReturnValue('forbidden');
      await rejected(
        safety.withObservation(value, action),
        'Invalid Avalanche observation provenance'
      );
      expect(action).not.toHaveBeenCalled();
    };

    /**
     * @target AvalancheObservationSafety.withObservation: rejects missing observation
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects missing observation', async () =>
      await runLiteralControl3_0(literalControlCases3[0]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects wrong source chain
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects wrong source chain', async () =>
      await runLiteralControl3_0(literalControlCases3[1]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects wrong extractor
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects wrong extractor', async () =>
      await runLiteralControl3_0(literalControlCases3[2]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects source block mismatch
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Alter only the named block/provenance field, then try
     * eligibility and action-time checks.
     * @expected Reject the incompatible completed block or provenance and never
     * call the action.
     */
    it('rejects source block mismatch', async () =>
      await runLiteralControl3_0(literalControlCases3[3]));

    /**
     * @target AvalancheObservationSafety.withObservation: leaves other chains
     * unchanged without retrieving an Avalanche scanner
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Select Ethereum and inject a scanner getter that throws if
     * used; perform eligibility and action checks.
     * @expected Return executed without retrieving an Avalanche scanner.
     */
    it('leaves other chains unchanged without retrieving an Avalanche scanner', async () => {
      const getScanner = vi.fn(() => {
        throw new Error('must not be accessed');
      });
      await new AvalancheObservationSafety(
        () => 'ethereum',
        getScanner
      ).assertObservation();
      expect(
        await new AvalancheObservationSafety(
          () => 'ethereum',
          getScanner
        ).withObservation(undefined, () => 'executed')
      ).toEqual('executed');
      expect(getScanner).not.toHaveBeenCalled();
    });

    const literalControlCases4 = ['avalanche', 'AVALANCHE'];
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl4_0 = async (
      fromChain: typeof literalControlCases4[number]
    ) => {
      const otherChain = new AvalancheObservationSafety(
        () => 'ethereum',
        () => scanner
      );
      const stored = { ...observation(), fromChain };
      const action = vi.fn();
      let assertError: unknown;
      let actionError: unknown;
      try {
        await otherChain.assertObservation(stored);
      } catch (error) {
        assertError = error;
      }
      try {
        await otherChain.withObservation(stored, action);
      } catch (error) {
        actionError = error;
      }
      expect(assertError).toBeInstanceOf(Error);
      expect(actionError).toBeInstanceOf(Error);
      expect(action).not.toHaveBeenCalled();
    };

    /**
     * @target AvalancheObservationSafety.withObservation: rejects stored avalanche observations after switching configured chain
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Select another chain while passing the tested spelling of a
     * stored Avalanche observation.
     * @expected Both checks reject and never execute the action.
     */
    it('rejects stored avalanche observations after switching configured chain', async () =>
      await runLiteralControl4_0(literalControlCases4[0]));

    /**
     * @target AvalancheObservationSafety.withObservation: rejects stored AVALANCHE observations after switching configured chain
     * @dependencies Real settled scanner, SQLite state and block repositories;
     * mocked connector methods and action callback
     * @scenario Select another chain while passing the tested spelling of a
     * stored Avalanche observation.
     * @expected Both checks reject and never execute the action.
     */
    it('rejects stored AVALANCHE observations after switching configured chain', async () =>
      await runLiteralControl4_0(literalControlCases4[1]));
  });
});
