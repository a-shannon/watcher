import { mockRpc, mockJoeRpc } from './mocked/avalancheScanner.mock';
import '@rosen-bridge/extended-typeorm/bootstrap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DataSource } from '@rosen-bridge/extended-typeorm';
import {
  BlockEntity,
  ExtractorStatusEntity,
  migrations as scannerMigrations,
} from '@rosen-bridge/abstract-scanner';
import {
  ObservationEntity,
  migrations as observationMigrations,
} from '@rosen-bridge/abstract-observation-extractor';
import {
  AvalancheRpcNetwork,
  AvalancheRpcScanner,
  AvalancheSafetyState,
  AvalancheSafetyState1790769600000,
} from '@rosen-bridge/evm-scanner';
import { TokenMap } from '@rosen-bridge/tokens';
import { AddressManager } from '@rosen-bridge/address-manager';
import { chainValidators, chainDecoders } from '@rosen-bridge/address-codec';
import type { AvalancheConfig } from '../../src/config/config';
import { createAvalancheScanner } from '../../src/utils/avalancheScanner';
import { TokensConfig } from '../../src/config/tokensConfig';
import { RosenConfig } from '../../src/config/rosenConfig';

import {
  lockAddress,
  hash,
  targetToken,
  rawData,
  joe,
  joeCounterpart,
  joeMetadata,
  mergedContractsSha256,
  mergedTokensSha256,
} from './avalancheScannerTestData';
/** Create a token-map fixture member with the requested ID and precision. */
const token = (tokenId: string, decimals: number) => ({
  tokenId,
  decimals,
  name: 'synthetic',
  type: 'test',
  residency: 'test',
  extra: {},
});

describe('avalancheScanner', () => {
  describe('createAvalancheScanner', () => {
    let database: DataSource;
    let network: AvalancheRpcNetwork;
    let tokens: TokenMap;
    const config: AvalancheConfig = {
      type: 'rpc',
      chainId: 43113,
      sourceId: 'fixture-fuji',
      initialHeight: 9,
      interval: 7,
      blockTime: 1.25,
      rpc: { url: 'http://127.0.0.1:1', timeout: 4, authToken: 'fixture-auth' },
    };
    const dependencies = () => ({
      dataSource: database,
      tokens,
      rosen: { lockAddress },
      storeRawData: true,
      blockCleanupConfig: {
        blockCleanupThresholdDuration: 86400,
        blockTrimCountInRound: 0,
      },
      createNetwork: () => network,
    });

    beforeEach(async () => {
      AddressManager.init(chainValidators, chainDecoders);
      database = await new DataSource({
        type: 'sqlite',
        database: ':memory:',
        synchronize: false,
        entities: [
          BlockEntity,
          ExtractorStatusEntity,
          ObservationEntity,
          AvalancheSafetyState,
        ],
        migrations: [
          ...scannerMigrations.sqlite,
          ...observationMigrations.sqlite,
          AvalancheSafetyState1790769600000,
        ],
      }).initialize();
      await database.runMigrations();
      tokens = new TokenMap();
      await tokens.updateConfigByJson([
        { avalanche: token('avax', 18), ergo: token(targetToken, 9) },
      ]);
      network = new AvalancheRpcNetwork(config.rpc.url, 43113n);
    });

    afterEach(async () => {
      vi.restoreAllMocks();
      network['provider'].destroy();
      if (database.isInitialized) await database.destroy();
    });

    const literalControlCases1 = [43113, 43114] as const;
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl1_0 = async (
      chainId: typeof literalControlCases1[number]
    ) => {
      network['provider'].destroy();
      network = new AvalancheRpcNetwork(config.rpc.url, BigInt(chainId));
      const { tx, receipts } = mockRpc(network);
      const createNetwork = vi.fn().mockReturnValue(network);
      const scanner = await createAvalancheScanner(
        { ...config, chainId },
        { ...dependencies(), createNetwork }
      );
      expect(createNetwork).toHaveBeenCalledWith(
        config.rpc.url,
        BigInt(chainId),
        4000,
        'fixture-auth'
      );
      expect(scanner).toBeInstanceOf(AvalancheRpcScanner);
      await scanner.update();
      const rows = await database.getRepository(ObservationEntity).find();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        fromChain: 'avalanche',
        toChain: 'ergo',
        sourceChainTokenId: 'avax',
        targetChainTokenId: targetToken,
        amount: '92850989',
        sourceTxId: tx.hash,
        sourceBlockId: hash,
        height: 10,
        extractor: 'avalanche-rpc-extractor',
        rawData,
      });
      expect(receipts).toHaveBeenCalledTimes(1);
      expect(
        await database
          .getRepository(AvalancheSafetyState)
          .findOneByOrFail({ scanner: 'avalanche' })
      ).toMatchObject({
        sourceId: config.sourceId,
        chainId: String(chainId),
        initialHeight: 9,
        finalizedHeight: 10,
        holdReason: null,
      });
      await scanner.assertObservation(10, hash);
    };

    /**
     * @target createAvalancheScanner: joins configured chain 43113, settled RPC, extractor and persisted observation
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Construct the tested chain connector, inject only ethers
     * response APIs, build the real factory, and ingest one synthetic lock
     * transaction.
     * @expected Persist one exact Avalanche observation and qualified safety
     * row; use the configured URL/ID/timeout/auth and one receipt read.
     */
    it('joins configured chain 43113, settled RPC, extractor and persisted observation', async () =>
      await runLiteralControl1_0(literalControlCases1[0]));

    /**
     * @target createAvalancheScanner: joins configured chain 43114, settled RPC, extractor and persisted observation
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Construct the tested chain connector, inject only ethers
     * response APIs, build the real factory, and ingest one synthetic lock
     * transaction.
     * @expected Persist one exact Avalanche observation and qualified safety
     * row; use the configured URL/ID/timeout/auth and one receipt read.
     */
    it('joins configured chain 43114, settled RPC, extractor and persisted observation', async () =>
      await runLiteralControl1_0(literalControlCases1[1]));

    /**
     * @target createAvalancheScanner: uses the Rosen lock address and rejects
     * transactions to another lock
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Supply a different Rosen lock address, ingest the synthetic
     * transaction, and count observations.
     * @expected Persist zero observations for the unmatched lock.
     */
    it('uses the Rosen lock address and rejects transactions to another lock', async () => {
      mockRpc(network);
      const scanner = await createAvalancheScanner(config, {
        ...dependencies(),
        rosen: { lockAddress: '0x' + '33'.repeat(20) },
      });
      await scanner.update();
      expect(await database.getRepository(ObservationEntity).count()).toEqual(
        0
      );
    });

    /**
     * @target createAvalancheScanner: honors raw-data storage policy
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Disable raw-data storage, ingest the synthetic valid lock
     * transaction, and inspect the stored row.
     * @expected Persist one observation whose rawData states extraction is off.
     */
    it('honors raw-data storage policy', async () => {
      mockRpc(network);
      const scanner = await createAvalancheScanner(config, {
        ...dependencies(),
        storeRawData: false,
      });
      await scanner.update();
      const rows = await database.getRepository(ObservationEntity).find();
      expect(rows).toHaveLength(1);
      expect(rows[0].rawData).toEqual('raw-data extraction is off');
    });

    /**
     * @target createAvalancheScanner: never accepts a reverted receipt after
     * the provider changes its answer
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Return a reverted receipt once and make every later receipt
     * read fail; run the real scanner/extractor.
     * @expected Read the admitted receipt exactly once and store zero
     * observations.
     */
    it('never accepts a reverted receipt after the provider changes its answer', async () => {
      const { receipts, receipt } = mockRpc(network, 0);
      receipts
        .mockResolvedValueOnce(receipt)
        .mockRejectedValue(new Error('Receipt must not be read again'));
      const scanner = await createAvalancheScanner(config, dependencies());
      await scanner.update();
      expect(receipts).toHaveBeenCalledTimes(1);
      expect(await database.getRepository(ObservationEntity).count()).toEqual(
        0
      );
    });

    /**
     * @target createAvalancheScanner: waits for extractor registration before
     * resolving the factory
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Block registration on a deferred promise and start the factory;
     * release registration and await completion.
     * @expected The factory remains pending until registration completes.
     */
    it('waits for extractor registration before resolving the factory', async () => {
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      let entered!: () => void;
      const registering = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let resolved = false;
      const result = createAvalancheScanner(config, {
        ...dependencies(),
        createScanner: (options) => {
          const scanner = new AvalancheRpcScanner(options);
          const register = scanner.registerExtractor;
          scanner.registerExtractor = async (extractor) => {
            entered();
            await barrier;
            await register(extractor);
          };
          return scanner;
        },
      }).then((scanner) => {
        resolved = true;
        return scanner;
      });
      await registering;
      await Promise.resolve();
      expect(resolved).toEqual(false);
      release();
      await result;
      expect(resolved).toEqual(true);
    });

    /**
     * @target createAvalancheScanner: rejects a connector for a different
     * configured chain before registration
     * @dependencies Real TokenMap, scanner, extractor and SQLite repositories;
     * mocked ethers provider methods and injectable connector factory
     * @scenario Configure mainnet while injecting a Fuji connector and attempt
     * factory construction.
     * @expected Reject the chain mismatch before any safety row exists.
     */
    it('rejects a connector for a different configured chain before registration', async () => {
      let error: unknown;
      try {
        await createAvalancheScanner(
          { ...config, chainId: 43114 },
          dependencies()
        );
      } catch (caught) {
        error = caught;
      }
      expect(String(error)).toContain('does not match configured chain');
      expect(
        await database.getRepository(AvalancheSafetyState).count()
      ).toEqual(0);
    });

    describe('merged mainnet JOE configuration', () => {
      let databasePath: string;
      let rosen: RosenConfig;
      const mainnet = {
        ...config,
        chainId: 43114 as const,
        sourceId: 'fixture-mainnet-merged',
      };

      beforeEach(async () => {
        databasePath = '';
        const contractsPath = fileURLToPath(
          new URL('./data/avalanche-merged-contracts.json', import.meta.url)
        );
        const tokensPath = fileURLToPath(
          new URL('./data/avalanche-merged-tokens.json', import.meta.url)
        );
        expect(
          createHash('sha256').update(readFileSync(contractsPath)).digest('hex')
        ).toEqual(mergedContractsSha256);
        expect(
          createHash('sha256').update(readFileSync(tokensPath)).digest('hex')
        ).toEqual(mergedTokensSha256);
        const previous = Reflect.get(TokensConfig, 'instance');
        Reflect.deleteProperty(TokensConfig, 'instance');
        try {
          await TokensConfig.init(tokensPath);
          tokens = TokensConfig.getInstance().getTokenMap();
        } finally {
          Reflect.set(TokensConfig, 'instance', previous);
        }
        rosen = new RosenConfig('avalanche', contractsPath);
        await database.destroy();
        databasePath = join(
          tmpdir(),
          `rosen-avalanche-joe-${randomUUID()}.sqlite`
        );
        database = await new DataSource({
          type: 'sqlite',
          database: databasePath,
          synchronize: false,
          entities: [
            BlockEntity,
            ExtractorStatusEntity,
            ObservationEntity,
            AvalancheSafetyState,
          ],
          migrations: [
            ...scannerMigrations.sqlite,
            ...observationMigrations.sqlite,
            AvalancheSafetyState1790769600000,
          ],
        }).initialize();
        await database.runMigrations();
        network['provider'].destroy();
        network = new AvalancheRpcNetwork(mainnet.rpc.url, 43114n);
      });

      afterEach(async () => {
        if (database.isInitialized) await database.destroy();
        if (databasePath && existsSync(databasePath)) unlinkSync(databasePath);
      });

      /**
       * @target createAvalancheScanner persists mapped JOE and qualified safety across database and scanner reopen
       * @dependencies Actual TokensConfig/RosenConfig readers, scanner/extractor and migrated file SQLite; mocked ethers responses
       * @scenario Load both complete generated files, ingest a JOE transfer and reopen the database with a new scanner
       * @expected Keep exact source/counterpart IDs, shared units, observation and qualified safety across reopen
       */
      it('persists mapped JOE and qualified safety across database and scanner reopen', async () => {
        const { tx, receipts } = mockJoeRpc(network, rosen.lockAddress);
        const scanner = await createAvalancheScanner(mainnet, {
          ...dependencies(),
          rosen,
        });
        await scanner.update();
        const observations = await database
          .getRepository(ObservationEntity)
          .find();
        expect(observations).toHaveLength(1);
        expect(observations[0]).toMatchObject({
          fromChain: 'avalanche',
          toChain: 'ergo',
          sourceChainTokenId: joe,
          targetChainTokenId: joeCounterpart,
          amount: '100',
          bridgeFee: '2',
          networkFee: '3',
          sourceTxId: tx.hash,
          sourceBlockId: hash,
          height: 10,
          rawData: joeMetadata,
          extractor: 'avalanche-rpc-extractor',
        });
        const safety = await database
          .getRepository(AvalancheSafetyState)
          .findOneByOrFail({ scanner: 'avalanche' });
        expect(safety).toMatchObject({
          sourceId: mainnet.sourceId,
          chainId: '43114',
          finalizedHeight: 10,
          holdReason: null,
        });
        await scanner.assertObservation(10, hash);
        const options = database.options;
        await database.destroy();
        database = await new DataSource(options).initialize();
        const reopened = await createAvalancheScanner(mainnet, {
          ...dependencies(),
          rosen,
        });
        await reopened.assertObservation(10, hash);
        await reopened.update();
        expect(await database.getRepository(ObservationEntity).find()).toEqual(
          observations
        );
        expect(
          await database
            .getRepository(AvalancheSafetyState)
            .findOneByOrFail({ scanner: 'avalanche' })
        ).toEqual(safety);
        expect(receipts).toHaveBeenCalledTimes(1);
      });

      /**
       * @target createAvalancheScanner refuses JOE without a Transfer receipt
       * @dependencies Actual configured map/contracts, scanner/extractor and file SQLite; mocked settled receipt
       * @scenario Remove only the Transfer log from an otherwise valid JOE receipt
       * @expected Persist no observation and retain the configured qualified mainnet frontier
       */
      it('refuses JOE without a Transfer receipt', async () => {
        const { receipt } = mockJoeRpc(network, rosen.lockAddress);
        receipt.logs = [];
        const scanner = await createAvalancheScanner(mainnet, {
          ...dependencies(),
          rosen,
        });
        await scanner.update();
        expect(await database.getRepository(ObservationEntity).count()).toEqual(
          0
        );
        await scanner.assertObservation(10, hash);
      });

      /**
       * @target createAvalancheScanner refuses JOE with a conflicting Transfer amount
       * @dependencies Actual configured map/contracts, scanner/extractor and file SQLite; mocked settled receipt
       * @scenario Change only the Transfer amount word while keeping signed calldata and receipt identity
       * @expected Persist no observation and retain the configured qualified mainnet frontier
       */
      it('refuses JOE with a conflicting Transfer amount', async () => {
        const { log } = mockJoeRpc(network, rosen.lockAddress);
        log.data = '0x' + '01'.padStart(64, '0');
        const scanner = await createAvalancheScanner(mainnet, {
          ...dependencies(),
          rosen,
        });
        await scanner.update();
        expect(await database.getRepository(ObservationEntity).count()).toEqual(
          0
        );
        await scanner.assertObservation(10, hash);
      });
    });
  });
});
