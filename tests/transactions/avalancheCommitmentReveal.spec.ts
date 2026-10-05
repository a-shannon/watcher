import '@rosen-bridge/extended-typeorm/bootstrap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as wasm from 'ergo-lib-wasm-nodejs';

import { ErgoUtils } from '../../src/ergo/utils';
import { ErgoNetwork } from '../../src/ergo/network/ergoNetwork';

import { WatcherUtils } from '../../src/utils/watcherUtils';
import { avalancheObservationSafety } from '../../src/utils/avalancheSafety';

import { CommitmentReveal } from '../../src/transactions/commitmentReveal';
import { Boxes } from '../../src/ergo/boxes';
import { TransactionUtils } from '../../src/utils/watcherUtils';
import { TokensConfig } from '../../src/config/tokensConfig';

import { permitJson, repoConfigJson, widJson } from '../avalancheTestData';
import {
  createAvalancheTestTransaction,
  createAvalancheTestObservation,
} from '../avalancheTestUtils';
const transaction = createAvalancheTestTransaction();
const observation = createAvalancheTestObservation();
describe('CommitmentReveal', () => {
  describe('triggerEventCreationTx', () => {
    afterEach(() => vi.restoreAllMocks());
    const kind = 'trigger';
    /**
     * @target CommitmentReveal.triggerEventCreationTx: passes the trigger observation into the action wrapper before submitting
     * @dependencies Real WASM boxes and transaction producer; mocked box
     * builder, Ergo network, signing dependency, token config and observation
     * action gate
     * @scenario Create the tested producer with synthetic boxes/network/token
     * responses, capture its signing wrapper, and reject the observation action
     * gate.
     * @expected Pass the identical observation to the gate and never submit a
     * transaction.
     */
    it('passes the trigger observation into the action wrapper before submitting', async () => {
      const permit = wasm.ErgoBox.from_json(JSON.stringify(permitJson));
      const config = wasm.ErgoBox.from_json(JSON.stringify(repoConfigJson));
      const wid = wasm.ErgoBox.from_json(JSON.stringify(widJson));
      const candidate = {} as wasm.ErgoBoxCandidate;
      const boxes = {
        getRepoConfigBox: vi.fn().mockResolvedValue(config),
        createCommitment: vi.fn().mockReturnValue(candidate),
        createPermit: vi.fn().mockReturnValue(candidate),
        createTriggerEvent: vi.fn().mockResolvedValue(candidate),
        RWTTokenId: permit.tokens().get(0).id(),
      } as unknown as Boxes;
      const submit = vi.fn().mockResolvedValue(undefined);
      const txUtils = {
        submitTransaction: submit,
      } as unknown as TransactionUtils;
      const watcher = {} as WatcherUtils;
      vi.spyOn(ErgoNetwork, 'getMaxHeight').mockResolvedValue(100);
      vi.spyOn(ErgoUtils, 'getExtraTokenCount').mockReturnValue(0);
      vi.spyOn(TokensConfig, 'getInstance').mockReturnValue({
        getTokenMap: () => ({ unwrapAmount: () => ({ amount: 1n }) }),
      } as unknown as TokensConfig);
      const actionGate = vi
        .spyOn(avalancheObservationSafety, 'withObservation')
        .mockRejectedValue(new Error('scanner held'));
      const create = vi
        .spyOn(ErgoUtils, 'createAndSignTx')
        .mockImplementation(
          async (
            _secret,
            _boxes,
            _candidates,
            _height,
            _data,
            _change,
            wrapper
          ) => {
            expect(wrapper).toEqual(expect.any(Function));
            if (!wrapper) throw new Error('Signing wrapper missing');
            return wrapper(() => transaction);
          }
        );
      {
        await new CommitmentReveal(
          watcher,
          txUtils,
          boxes
        ).triggerEventCreationTx([permit], wid, config, observation, [], []);
      }
      expect(create).toHaveBeenCalledTimes(1);
      expect(actionGate).toHaveBeenCalledTimes(1);
      expect(actionGate.mock.calls[0][0]).toBe(observation);
      expect(submit).not.toHaveBeenCalled();
    });
  });
});
