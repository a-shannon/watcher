import '@rosen-bridge/extended-typeorm/bootstrap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErgoNetwork } from '../../../src/ergo/network/ergoNetwork';
import { Queue } from '../../../src/ergo/transaction/queue';
import { TxEntity, TxType } from '../../../src/database/entities/txEntity';
import { WatcherDataBase } from '../../../src/database/models/watcherModel';
import { WatcherUtils } from '../../../src/utils/watcherUtils';
import { avalancheObservationSafety } from '../../../src/utils/avalancheSafety';
import { AvalancheObservationSafety } from '../../../src/utils/avalancheSafety';
import { DataSource } from '@rosen-bridge/extended-typeorm';
import {
  BlockEntity,
  ExtractorStatusEntity,
  migrations,
} from '@rosen-bridge/abstract-scanner';
import {
  AvalancheRpcNetwork,
  AvalancheRpcScanner,
  AvalancheSafetyState,
  AvalancheSafetyState1790769600000,
} from '@rosen-bridge/evm-scanner';

import {
  createAvalancheTestTransaction,
  createAvalancheTestObservation,
} from '../../avalancheTestUtils';
const transaction = createAvalancheTestTransaction();
const observation = createAvalancheTestObservation();
describe('Queue', () => {
  describe('job', () => {
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
      vi.spyOn(network, 'getCurrentHeight').mockResolvedValue(1);
      vi.spyOn(network, 'getBlockAtHeight').mockResolvedValue({
        height: 1,
        hash: observation.block,
        parentHash: '0x' + '00'.repeat(32),
        timestamp: 1790769600,
        txCount: 0,
      });
      vi.spyOn(network, 'getBlockTxs').mockResolvedValue([]);
      scanner = new AvalancheRpcScanner({
        dataSource: database,
        network,
        sourceId: 'fixture-fuji',
        initialHeight: 0,
        blockCleanupConfig: {
          blockCleanupThresholdDuration: 86400,
          blockTrimCountInRound: 0,
        },
      });
      await scanner.update();
      safety = new AvalancheObservationSafety(
        () => 'avalanche',
        () => scanner
      );
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      network['provider'].destroy();
      await database.destroy();
    });

    /** Construct the real queue with synthetic transactions and dependency API mocks. */
    const setup = (type: TxType) => {
      const tx = Object.assign(new TxEntity(), {
        type,
        observation,
        txId: transaction.id().to_str(),
        updateBlock: 99,
        txSerialized: Buffer.from(transaction.sigma_serialize_bytes()).toString(
          'base64'
        ),
      });
      const getAllTxs = vi.fn().mockResolvedValue([tx]);
      const setTxValidStatus = vi.fn().mockResolvedValue(undefined);
      const setTxUpdateHeight = vi.fn().mockResolvedValue(undefined);
      const removeTx = vi.fn().mockResolvedValue(undefined);
      const downgradeObservationTxStatus = vi.fn().mockResolvedValue(undefined);
      const database = {
        getAllTxs,
        setTxValidStatus,
        setTxUpdateHeight,
        removeTx,
        downgradeObservationTxStatus,
      } as unknown as WatcherDataBase;
      const isObservationValid = vi.fn().mockResolvedValue(true);
      const isMergeHappened = vi.fn().mockResolvedValue(false);
      const connection = {
        isObservationValid,
        isMergeHappened,
      } as unknown as WatcherUtils;
      vi.spyOn(ErgoNetwork, 'getHeight').mockResolvedValue(100);
      vi.spyOn(ErgoNetwork, 'getConfNum').mockResolvedValue(-1);
      const send = vi
        .spyOn(ErgoNetwork, 'sendTx')
        .mockResolvedValue({ success: true });
      const gate = vi
        .spyOn(avalancheObservationSafety, 'assertObservation')
        .mockResolvedValue(undefined);
      const actionGate = vi
        .spyOn(avalancheObservationSafety, 'withObservation')
        .mockImplementation(safety.withObservation);
      return {
        queue: new Queue(database, connection),
        tx,
        gate,
        actionGate,
        send,
        isObservationValid,
        isMergeHappened,
        setTxValidStatus,
        setTxUpdateHeight,
        removeTx,
        downgradeObservationTxStatus,
      };
    };

    const literalControlCases1 = [TxType.COMMITMENT, TxType.TRIGGER];
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl1_0 = async (
      type: typeof literalControlCases1[number]
    ) => {
      const fixture = setup(type);
      await database
        .getRepository(AvalancheSafetyState)
        .update({ scanner: 'avalanche' }, { holdReason: 'fixture-hold' });
      await fixture.queue.job();
      for (const stub of [
        fixture.send,
        fixture.isObservationValid,
        fixture.isMergeHappened,
        fixture.setTxValidStatus,
        fixture.setTxUpdateHeight,
        fixture.removeTx,
        fixture.downgradeObservationTxStatus,
      ]) {
        expect(stub).not.toHaveBeenCalled();
      }
      expect(fixture.gate).not.toHaveBeenCalled();
      expect(fixture.actionGate.mock.calls[0][0]).toBe(observation);
    };
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl1_1 = async (
      type: typeof literalControlCases1[number]
    ) => {
      const fixture = setup(type);
      const verify =
        type === TxType.COMMITMENT
          ? fixture.isObservationValid
          : fixture.isMergeHappened;
      verify.mockImplementation(async () => {
        let error: unknown;
        try {
          await scanner.update();
        } catch (caught) {
          error = caught;
        }
        expect(String(error)).toContain('operation already running');
        return type !== TxType.COMMITMENT;
      });
      await fixture.queue.job();
      expect(fixture.gate).not.toHaveBeenCalled();
      expect(fixture.actionGate).toHaveBeenCalledTimes(1);
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.setTxValidStatus).toHaveBeenNthCalledWith(
        1,
        fixture.tx,
        false
      );
      expect(fixture.setTxUpdateHeight).not.toHaveBeenCalled();
      expect(fixture.removeTx).not.toHaveBeenCalled();
      await scanner.update();
    };
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl1_2 = async (
      type: typeof literalControlCases1[number]
    ) => {
      const fixture = setup(type);
      await fixture.queue.job();
      expect(fixture.gate).not.toHaveBeenCalled();
      expect(fixture.actionGate).toHaveBeenCalledTimes(1);
      expect(fixture.send).toHaveBeenCalledTimes(1);
      expect(
        fixture.actionGate.mock.invocationCallOrder[0] <
          fixture.send.mock.invocationCallOrder[0]
      ).toEqual(true);
      expect(fixture.setTxValidStatus).toHaveBeenNthCalledWith(
        1,
        fixture.tx,
        true
      );
      expect(fixture.setTxUpdateHeight).toHaveBeenNthCalledWith(
        1,
        fixture.tx,
        100
      );
    };

    /**
     * @target Queue.job: keeps held commitment queued without sending or changing status
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Persist a hold, execute the tested queue item, and inspect
     * send/verification/persistence mocks.
     * @expected Perform no send, verification or state change; pass the
     * observation to the action gate.
     */
    it('keeps held commitment queued without sending or changing status', async () =>
      await runLiteralControl1_0(literalControlCases1[0]));

    /**
     * @target Queue.job: excludes updates through false commitment verification and controlled reset
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario During the tested false verification path, attempt a scanner
     * update; run the queue and then retry after it finishes.
     * @expected Reject the concurrent update, mark the item invalid without
     * sending/removing it, and release the lease afterward.
     */
    it('excludes updates through false commitment verification and controlled reset', async () =>
      await runLiteralControl1_1(literalControlCases1[0]));

    /**
     * @target Queue.job: sends qualified commitment inside the observation lease
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Run the qualified queue item and inspect gate, send, validation
     * and persistence ordering.
     * @expected Enter the observation lease before sending, mark the exact item
     * valid, and persist height 100.
     */
    it('sends qualified commitment inside the observation lease', async () =>
      await runLiteralControl1_2(literalControlCases1[0]));

    /**
     * @target Queue.job: keeps held trigger queued without sending or changing status
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Persist a hold, execute the tested queue item, and inspect
     * send/verification/persistence mocks.
     * @expected Perform no send, verification or state change; pass the
     * observation to the action gate.
     */
    it('keeps held trigger queued without sending or changing status', async () =>
      await runLiteralControl1_0(literalControlCases1[1]));

    /**
     * @target Queue.job: excludes updates through false trigger verification and controlled reset
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario During the tested false verification path, attempt a scanner
     * update; run the queue and then retry after it finishes.
     * @expected Reject the concurrent update, mark the item invalid without
     * sending/removing it, and release the lease afterward.
     */
    it('excludes updates through false trigger verification and controlled reset', async () =>
      await runLiteralControl1_1(literalControlCases1[1]));

    /**
     * @target Queue.job: sends qualified trigger inside the observation lease
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Run the qualified queue item and inspect gate, send, validation
     * and persistence ordering.
     * @expected Enter the observation lease before sending, mark the exact item
     * valid, and persist height 100.
     */
    it('sends qualified trigger inside the observation lease', async () =>
      await runLiteralControl1_2(literalControlCases1[1]));

    const literalControlCases2 = [false, true];
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl2_0 = async (
      reset: typeof literalControlCases2[number]
    ) => {
      const fixture = setup(TxType.COMMITMENT);
      let entered!: () => void;
      const waiting = new Promise<void>((resolve) => {
        entered = resolve;
      });
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      if (reset) {
        fixture.isObservationValid.mockResolvedValue(false);
        fixture.tx.updateBlock = -1000000000;
      }
      const persistence = reset ? fixture.removeTx : fixture.setTxUpdateHeight;
      persistence.mockImplementation(async () => {
        entered();
        await barrier;
      });
      let finished = false;
      const run = fixture.queue.job().then(() => {
        finished = true;
      });
      await waiting;
      let error: unknown;
      try {
        await scanner.update();
      } catch (caught) {
        error = caught;
      }
      expect(String(error)).toContain('operation already running');
      expect(finished).toEqual(false);
      release();
      await run;
      await scanner.update();
      expect(finished).toEqual(true);
      expect(fixture.setTxValidStatus).toHaveBeenNthCalledWith(
        1,
        fixture.tx,
        !reset
      );
    };

    /**
     * @target Queue.job: retains its lease until successful status persistence completes
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Block the selected persistence/removal call, attempt an update
     * while it waits, then release it and retry.
     * @expected Reject the concurrent update, await persistence/removal before
     * returning, and release the lease afterward.
     */
    it('retains its lease until successful status persistence completes', async () =>
      await runLiteralControl2_0(literalControlCases2[0]));

    /**
     * @target Queue.job: retains its lease until invalid transaction removal completes
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Block the selected persistence/removal call, attempt an update
     * while it waits, then release it and retry.
     * @expected Reject the concurrent update, await persistence/removal before
     * returning, and release the lease afterward.
     */
    it('retains its lease until invalid transaction removal completes', async () =>
      await runLiteralControl2_0(literalControlCases2[1]));

    const literalControlCases3 = [
      'verification',
      'send',
      'validation',
      'persistence',
    ];
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl3_0 = async (
      failure: typeof literalControlCases3[number]
    ) => {
      const fixture = setup(TxType.COMMITMENT);
      const error = new Error('fixture failure');
      let updateError: unknown;
      if (failure === 'verification')
        fixture.isObservationValid.mockRejectedValue(error);
      if (failure === 'send') fixture.send.mockRejectedValue(error);
      if (failure === 'persistence')
        fixture.setTxValidStatus.mockRejectedValue(error);
      if (failure === 'validation') {
        fixture.send.mockResolvedValue({ success: false });
        vi.spyOn(ErgoNetwork, 'checkTxInputs').mockImplementation(async () => {
          try {
            await scanner.update();
          } catch (caught) {
            updateError = caught;
          }
          throw error;
        });
      }
      await fixture.queue.job();
      if (failure === 'validation')
        expect(String(updateError)).toContain('operation already running');
      await scanner.update();
      expect(fixture.removeTx).not.toHaveBeenCalled();
    };

    /**
     * @target Queue.job: releases the observation lease after verification throws
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Throw at exactly the tested
     * verification/send/validation/persistence stage, run the queue, and retry
     * a scanner update.
     * @expected Release the lease despite the failure and never remove the
     * queued item.
     */
    it('releases the observation lease after verification throws', async () =>
      await runLiteralControl3_0(literalControlCases3[0]));

    /**
     * @target Queue.job: releases the observation lease after send throws
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Throw at exactly the tested
     * verification/send/validation/persistence stage, run the queue, and retry
     * a scanner update.
     * @expected Release the lease despite the failure and never remove the
     * queued item.
     */
    it('releases the observation lease after send throws', async () =>
      await runLiteralControl3_0(literalControlCases3[1]));

    /**
     * @target Queue.job: releases the observation lease after validation throws
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Throw at exactly the tested
     * verification/send/validation/persistence stage, run the queue, and retry
     * a scanner update.
     * @expected Release the lease despite the failure and never remove the
     * queued item.
     */
    it('releases the observation lease after validation throws', async () =>
      await runLiteralControl3_0(literalControlCases3[2]));

    /**
     * @target Queue.job: releases the observation lease after persistence throws
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Throw at exactly the tested
     * verification/send/validation/persistence stage, run the queue, and retry
     * a scanner update.
     * @expected Release the lease despite the failure and never remove the
     * queued item.
     */
    it('releases the observation lease after persistence throws', async () =>
      await runLiteralControl3_0(literalControlCases3[3]));

    /**
     * @target Queue.job: holds the lease through failed-send input validation
     * and awaited reset
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Return a failed send and invalid inputs; try an update during
     * the awaited invalid-status reset.
     * @expected Reject the update during reset, mark the exact item invalid
     * once, then release the lease.
     */
    it('holds the lease through failed-send input validation and awaited reset', async () => {
      const fixture = setup(TxType.COMMITMENT);
      let error: unknown;
      fixture.send.mockResolvedValue({ success: false });
      vi.spyOn(ErgoNetwork, 'checkTxInputs').mockResolvedValue(false);
      fixture.setTxValidStatus.mockImplementation(async () => {
        try {
          await scanner.update();
        } catch (caught) {
          error = caught;
        }
      });
      await fixture.queue.job();
      expect(fixture.setTxValidStatus).toHaveBeenCalledTimes(1);
      expect(fixture.setTxValidStatus).toHaveBeenCalledWith(fixture.tx, false);
      expect(String(error)).toContain('operation already running');
      await scanner.update();
    });

    const literalControlCases4 = [
      TxType.DETACH,
      TxType.REDEEM,
      TxType.PERMIT,
      TxType.REWARD,
    ];
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl4_0 = async (
      type: typeof literalControlCases4[number]
    ) => {
      const fixture = setup(type);
      fixture.gate.mockRejectedValue(new Error('scanner held'));
      await fixture.queue.job();
      expect(fixture.gate).not.toHaveBeenCalled();
      expect(fixture.actionGate).not.toHaveBeenCalled();
      expect(fixture.send).toHaveBeenCalledTimes(1);
    };

    /**
     * @target Queue.job: keeps detach recovery behavior unchanged
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Run the tested non-observation recovery transaction while the
     * Avalanche gate would reject if called.
     * @expected Keep the recovery send path and call neither Avalanche gate.
     */
    it('keeps detach recovery behavior unchanged', async () =>
      await runLiteralControl4_0(literalControlCases4[0]));

    /**
     * @target Queue.job: keeps redeem recovery behavior unchanged
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Run the tested non-observation recovery transaction while the
     * Avalanche gate would reject if called.
     * @expected Keep the recovery send path and call neither Avalanche gate.
     */
    it('keeps redeem recovery behavior unchanged', async () =>
      await runLiteralControl4_0(literalControlCases4[1]));

    /**
     * @target Queue.job: keeps permit recovery behavior unchanged
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Run the tested non-observation recovery transaction while the
     * Avalanche gate would reject if called.
     * @expected Keep the recovery send path and call neither Avalanche gate.
     */
    it('keeps permit recovery behavior unchanged', async () =>
      await runLiteralControl4_0(literalControlCases4[2]));

    /**
     * @target Queue.job: keeps reward recovery behavior unchanged
     * @dependencies Real transaction queue and settled scanner over SQLite;
     * mocked Ergo network, observation verification and queue persistence APIs
     * @scenario Run the tested non-observation recovery transaction while the
     * Avalanche gate would reject if called.
     * @expected Keep the recovery send path and call neither Avalanche gate.
     */
    it('keeps reward recovery behavior unchanged', async () =>
      await runLiteralControl4_0(literalControlCases4[3]));
  });
});
