import * as wasm from 'ergo-lib-wasm-nodejs';
import { ObservationEntity } from '@rosen-bridge/abstract-observation-extractor';
import { txJson } from './avalancheTestData';
/** Decode a synthetic transaction fixture without constructing a wallet or submitting it. */
export const createAvalancheTestTransaction = () =>
  wasm.Transaction.from_json(JSON.stringify(txJson));
/** Build a synthetic observation bound to completed Avalanche block one. */
export const createAvalancheTestObservation = () =>
  Object.assign(new ObservationEntity(), {
    extractor: 'avalanche-rpc-extractor',
    fromChain: 'avalanche',
    height: 1,
    block: '0x' + '11'.repeat(32),
    sourceBlockId: '0x' + '11'.repeat(32),
  });
