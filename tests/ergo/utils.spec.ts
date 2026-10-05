import '@rosen-bridge/extended-typeorm/bootstrap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as wasm from 'ergo-lib-wasm-nodejs';

import { ErgoUtils } from '../../src/ergo/utils';
import { ErgoNetwork } from '../../src/ergo/network/ergoNetwork';

import permitJson from '../ergoUtils/dataset/permitBox.json' assert { type: 'json' };
import txJson from './dataset/tx.json' assert { type: 'json' };
const transaction = wasm.Transaction.from_json(JSON.stringify(txJson));
describe('ErgoUtils', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('buildTxAndSign', () => {
    const checkSigning = async (held: boolean) => {
      const order: string[] = [];
      let release!: () => void;
      const context = new Promise<wasm.ErgoStateContext>((resolve) => {
        release = () => {
          order.push('context');
          resolve({} as wasm.ErgoStateContext);
        };
      });
      vi.spyOn(ErgoNetwork, 'getErgoStateContext').mockReturnValue(context);
      const sign = vi
        .spyOn(wasm.Wallet.prototype, 'sign_transaction')
        .mockImplementation(() => {
          order.push('sign');
          return transaction;
        });
      const builder = {
        build: () => ({ id: () => transaction.id(), to_json: () => '{}' }),
      } as unknown as wasm.TxBuilder;
      const check = vi
        .fn()
        .mockImplementation(async (sign: () => wasm.Transaction) => {
          order.push('gate');
          if (held) throw new Error('signing refused');
          return sign();
        });
      const result = ErgoUtils.buildTxAndSign(
        builder,
        wasm.SecretKey.random_dlog(),
        wasm.ErgoBoxes.from_boxes_json([]),
        undefined,
        check
      );
      expect(check).not.toHaveBeenCalled();
      expect(sign).not.toHaveBeenCalled();
      release();
      let error: unknown;
      try {
        await result;
      } catch (caught) {
        error = caught;
      }
      expect(order).toEqual(
        held ? ['context', 'gate'] : ['context', 'gate', 'sign']
      );
      expect(sign).toHaveBeenCalledTimes(held ? 0 : 1);
      if (held) expect(String(error)).toContain('signing refused');
      else expect(error).toEqual(undefined);
    };

    /**
     * @target ErgoUtils.buildTxAndSign: checks safety after context acquisition and allows wallet signing
     * @dependencies Real WASM transaction/boxes; mocked context acquisition,
     * wallet signing and construction dependencies
     * @scenario Hold context acquisition, complete it and apply the action
     * wrapper before wallet signing.
     * @expected Context resolves before the wrapper; wallet signing occurs
     * exactly once when allowed.
     */
    it('checks safety after context acquisition and allows wallet signing', async () => {
      await checkSigning(false);
    });

    /**
     * @target ErgoUtils.buildTxAndSign: checks safety after context acquisition and blocks wallet signing
     * @dependencies Real WASM transaction/boxes; mocked context acquisition,
     * wallet signing and construction dependencies
     * @scenario Hold context acquisition, complete it and apply the action
     * wrapper before wallet signing.
     * @expected Context resolves before the wrapper; wallet signing occurs
     * exactly zero times when refused.
     */
    it('checks safety after context acquisition and blocks wallet signing', async () => {
      await checkSigning(true);
    });
  });

  describe('createAndSignTx', () => {
    /**
     * @target ErgoUtils.createAndSignTx: forwards the action wrapper through
     * transaction construction to signing
     * @dependencies Real WASM transaction/boxes; mocked context acquisition,
     * wallet signing and construction dependencies
     * @scenario Build a real transaction candidate with synthetic boxes; mock
     * the signing dependency and capture its action wrapper.
     * @expected Pass the identical wrapper through construction, invoke it
     * once, and return the identical synthetic transaction.
     */
    it('forwards the action wrapper through transaction construction to signing', async () => {
      const secret = wasm.SecretKey.random_dlog();
      const box = wasm.ErgoBox.from_json(JSON.stringify(permitJson));
      const inputs = new wasm.ErgoBoxes(box);
      const candidate = new wasm.ErgoBoxCandidateBuilder(
        wasm.BoxValue.from_i64(wasm.I64.from_str('1000000')),
        wasm.Contract.pay_to_address(secret.get_address()),
        1
      ).build();
      vi.spyOn(ErgoUtils, 'createChangeBox').mockReturnValue(null);
      const wrapper = vi
        .fn()
        .mockImplementation(async (sign: () => wasm.Transaction) => sign());
      const build = vi
        .spyOn(ErgoUtils, 'buildTxAndSign')
        .mockImplementation(
          async (_builder, _secret, _inputs, _data, withSigning) => {
            expect(withSigning).toEqual(wrapper);
            if (!withSigning) throw new Error('Signing wrapper missing');
            return withSigning(() => transaction);
          }
        );
      expect(
        await ErgoUtils.createAndSignTx(
          secret,
          inputs,
          [candidate],
          1,
          undefined,
          undefined,
          wrapper
        )
      ).toEqual(transaction);
      expect(build).toHaveBeenCalledTimes(1);
      expect(wrapper).toHaveBeenCalledTimes(1);
    });
  });
});
