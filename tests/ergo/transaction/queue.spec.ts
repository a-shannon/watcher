import '@rosen-bridge/extended-typeorm/bootstrap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as wasm from 'ergo-lib-wasm-nodejs';

import { Queue } from '../../../src/ergo/transaction/queue';
import { ErgoNetwork } from '../../../src/ergo/network/ergoNetwork';
import { TxEntity, TxType } from '../../../src/database/entities/txEntity';
import { WatcherDataBase } from '../../../src/database/models/watcherModel';
import { WatcherUtils } from '../../../src/utils/watcherUtils';
import txJson from '../dataset/tx.json' assert { type: 'json' };

describe('Queue', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('job', () => {
    const checkResetWrite = async (
      branch: 'verification' | 'rejected-send'
    ) => {
      const transaction = wasm.Transaction.from_json(JSON.stringify(txJson));
      const tx = Object.assign(new TxEntity(), {
        type: branch === 'verification' ? TxType.COMMITMENT : TxType.PERMIT,
        txId: transaction.id().to_str(),
        txSerialized: Buffer.from(transaction.sigma_serialize_bytes()).toString(
          'base64'
        ),
        updateBlock: 100,
        observation: undefined,
      });
      let release!: () => void;
      let entered!: () => void;
      const started = new Promise<void>((resolve) => {
        entered = resolve;
      });
      const blocked = new Promise<void>((resolve) => {
        release = resolve;
      });
      const setTxValidStatus = vi.fn().mockImplementation(async () => {
        entered();
        await blocked;
      });
      const setTxUpdateHeight = vi.fn();
      const removeTx = vi.fn();
      const db = {
        getAllTxs: vi.fn().mockResolvedValue([tx]),
        setTxValidStatus,
        setTxUpdateHeight,
        removeTx,
      } as unknown as WatcherDataBase;
      const connection = {
        isObservationValid: vi.fn().mockResolvedValue(false),
      } as unknown as WatcherUtils;
      vi.spyOn(ErgoNetwork, 'getHeight').mockResolvedValue(100);
      vi.spyOn(ErgoNetwork, 'getConfNum').mockResolvedValue(-1);
      vi.spyOn(ErgoNetwork, 'checkTxInputs').mockResolvedValue(false);
      const send = vi
        .spyOn(ErgoNetwork, 'sendTx')
        .mockResolvedValue({ success: false });
      let completed = false;
      const result = new Queue(db, connection).job().then(() => {
        completed = true;
      });
      await started;
      await new Promise<void>((resolve) => setImmediate(resolve));
      try {
        expect(completed).toEqual(false);
        expect(setTxValidStatus).toHaveBeenCalledExactlyOnceWith(tx, false);
        expect(send).toHaveBeenCalledTimes(branch === 'verification' ? 0 : 1);
      } finally {
        release();
      }
      await result;
      expect(completed).toEqual(true);
      expect(setTxUpdateHeight).not.toHaveBeenCalled();
      expect(removeTx).not.toHaveBeenCalled();
    };

    /**
     * @target Queue.job: waits for the reset write after verification
     * @dependencies Real queue and WASM transaction; mocked Ergo network,
     * observation verification and controlled persistence APIs
     * @scenario Refuse commitment verification, hold the invalid-status write
     * across a complete event-loop turn, then release it.
     * @expected The job waits for the write, performs no send and never marks
     * the transaction valid or updates its successful-send height.
     */
    it('waits for the reset write after verification', async () => {
      await checkResetWrite('verification');
    });

    /**
     * @target Queue.job: waits for the reset write after rejected-send
     * @dependencies Real queue and WASM transaction; mocked Ergo network,
     * input availability and controlled persistence APIs
     * @scenario Reject the send and mark its inputs spent, hold the invalid
     * write across a complete event-loop turn, then release it.
     * @expected The job waits for the write, attempts one send and never marks
     * the transaction valid or updates its successful-send height.
     */
    it('waits for the reset write after rejected-send', async () => {
      await checkResetWrite('rejected-send');
    });
  });
});
