import { beforeEach, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

import {
  AvalancheConfig,
  ConfigReader,
  getObservationValidThreshold,
} from '../../src/config/config';

describe('config/config', () => {
  const missing = Symbol('missing configuration');
  let values: Map<string, unknown>;
  let reader: ConfigReader;

  beforeEach(() => {
    values = new Map<string, unknown>([
      ['network', 'avalanche'],
      ['avalanche.type', 'rpc'],
      ['avalanche.chainId', 43113],
      ['avalanche.sourceId', 'fuji-rpc-1'],
      ['avalanche.initial.height', -1],
      ['avalanche.interval', 20],
      ['avalanche.healthCheck.blockTime', 0.5],
      ['avalanche.rpc.url', 'https://rpc.invalid/ext/bc/C/rpc'],
      ['avalanche.rpc.timeout', 10],
      ['observation.validThresholdBlocks', 150],
    ]);
    reader = {
      get: <T>(path: string): T => values.get(path) as T,
      has: (path: string) => values.has(path) && values.get(path) !== missing,
    };
  });

  describe('AvalancheConfig', () => {
    describe('constructor', () => {
      const literalControlCases1 = [43113, 43114];
      /** Runs the original control against one unchanged case-table row. */
      const runLiteralControl1_0 = (
        chainId: typeof literalControlCases1[number]
      ) => {
        values.set('avalanche.chainId', chainId);
        const result = new AvalancheConfig(reader);
        expect(result.chainId).toEqual(chainId);
        expect(result.sourceId).toEqual('fuji-rpc-1');
        expect(result.initialHeight).toEqual(-1);
        expect(result.interval).toEqual(20);
        expect(result.blockTime).toEqual(0.5);
        expect(result.rpc).toEqual({
          url: 'https://rpc.invalid/ext/bc/C/rpc',
          timeout: 10,
          authToken: undefined,
        });
      };

      /**
       * @target AvalancheConfig.constructor: loads explicit C-Chain identity 43113
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Set the tested C-Chain ID, construct AvalancheConfig using the
       * reader double, and inspect every parsed policy field.
       * @expected Return the configured chain/source/start/cadence/block-time and
       * exact RPC settings.
       */
      it('loads explicit C-Chain identity 43113', () =>
        runLiteralControl1_0(literalControlCases1[0]));

      /**
       * @target AvalancheConfig.constructor: loads explicit C-Chain identity 43114
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Set the tested C-Chain ID, construct AvalancheConfig using the
       * reader double, and inspect every parsed policy field.
       * @expected Return the configured chain/source/start/cadence/block-time and
       * exact RPC settings.
       */
      it('loads explicit C-Chain identity 43114', () =>
        runLiteralControl1_0(literalControlCases1[1]));

      const invalid: Array<[string, unknown]> = [
        ['avalanche.type', 'explorer'],
        ['avalanche.chainId', missing],
        ['avalanche.chainId', 1],
        ['avalanche.chainId', 43112],
        ['avalanche.chainId', '43113'],
        ['avalanche.chainId', 43113.5],
        ['avalanche.chainId', null],
        ['avalanche.sourceId', missing],
        ['avalanche.sourceId', ''],
        ['avalanche.sourceId', 'source with spaces'],
        ['avalanche.sourceId', '../rpc'],
        ['avalanche.sourceId', '_rpc'],
        ['avalanche.sourceId', 'r'.repeat(129)],
        ['avalanche.sourceId', 1],
        ['avalanche.rpc.url', missing],
        ['avalanche.rpc.url', ''],
        ['avalanche.rpc.url', 'https://'],
        ['avalanche.rpc.url', 'ws://rpc.invalid'],
        ['avalanche.rpc.url', ' https://rpc.invalid'],
        ['avalanche.rpc.url', 7],
        ['avalanche.rpc.authToken', 7],
        ['avalanche.initial.height', -2],
        ['avalanche.initial.height', 0.5],
        ['avalanche.initial.height', Number.MAX_SAFE_INTEGER + 1],
        ['avalanche.initial.height', '10'],
        ['avalanche.initial.height', NaN],
        ['avalanche.initial.height', Infinity],
        ['avalanche.healthCheck.blockTime', missing],
        ['avalanche.healthCheck.blockTime', 0],
        ['avalanche.healthCheck.blockTime', -1],
        ['avalanche.healthCheck.blockTime', Infinity],
        ['avalanche.healthCheck.blockTime', NaN],
        ['avalanche.healthCheck.blockTime', '0.5'],
      ];
      for (const field of ['avalanche.interval', 'avalanche.rpc.timeout']) {
        for (const value of [0, -1, Infinity, NaN, '10', 2147483.648]) {
          invalid.push([field, value]);
        }
      }
      const literalControlCases2 = invalid;
      /** Runs the original control against one unchanged case-table row. */
      const runLiteralControl2_0 = ([
        field,
        value,
      ]: typeof literalControlCases2[number]) => {
        values.set(field, value);
        expect(() => new AvalancheConfig(reader)).toThrow(field);
      };

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.type: explorer
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.type: explorer', () =>
        runLiteralControl2_0(literalControlCases2[0]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.chainId: Symbol(missing configuration)
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.chainId: Symbol(missing configuration)', () =>
        runLiteralControl2_0(literalControlCases2[1]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.chainId: 1
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.chainId: 1', () =>
        runLiteralControl2_0(literalControlCases2[2]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.chainId: 43112
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.chainId: 43112', () =>
        runLiteralControl2_0(literalControlCases2[3]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.chainId: 43113
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.chainId: 43113', () =>
        runLiteralControl2_0(literalControlCases2[4]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.chainId: 43113.5
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.chainId: 43113.5', () =>
        runLiteralControl2_0(literalControlCases2[5]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.chainId: null
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.chainId: null', () =>
        runLiteralControl2_0(literalControlCases2[6]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId: Symbol(missing configuration)
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: Symbol(missing configuration)', () =>
        runLiteralControl2_0(literalControlCases2[7]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId:
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: ', () =>
        runLiteralControl2_0(literalControlCases2[8]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId: source with spaces
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: source with spaces', () =>
        runLiteralControl2_0(literalControlCases2[9]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId: ../rpc
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: ../rpc', () =>
        runLiteralControl2_0(literalControlCases2[10]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId: _rpc
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: _rpc', () =>
        runLiteralControl2_0(literalControlCases2[11]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId: rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr', () =>
        runLiteralControl2_0(literalControlCases2[12]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.sourceId: 1
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.sourceId: 1', () =>
        runLiteralControl2_0(literalControlCases2[13]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.url: Symbol(missing configuration)
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.url: Symbol(missing configuration)', () =>
        runLiteralControl2_0(literalControlCases2[14]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.url:
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.url: ', () =>
        runLiteralControl2_0(literalControlCases2[15]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.url: https://
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.url: https://', () =>
        runLiteralControl2_0(literalControlCases2[16]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.url: ws://rpc.invalid
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.url: ws://rpc.invalid', () =>
        runLiteralControl2_0(literalControlCases2[17]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.url:  https://rpc.invalid
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.url:  https://rpc.invalid', () =>
        runLiteralControl2_0(literalControlCases2[18]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.url: 7
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.url: 7', () =>
        runLiteralControl2_0(literalControlCases2[19]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.authToken: 7
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.authToken: 7', () =>
        runLiteralControl2_0(literalControlCases2[20]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.initial.height: -2
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.initial.height: -2', () =>
        runLiteralControl2_0(literalControlCases2[21]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.initial.height: 0.5
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.initial.height: 0.5', () =>
        runLiteralControl2_0(literalControlCases2[22]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.initial.height: 9007199254740992
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.initial.height: 9007199254740992', () =>
        runLiteralControl2_0(literalControlCases2[23]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.initial.height: 10
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.initial.height: 10', () =>
        runLiteralControl2_0(literalControlCases2[24]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.initial.height: NaN
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.initial.height: NaN', () =>
        runLiteralControl2_0(literalControlCases2[25]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.initial.height: Infinity
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.initial.height: Infinity', () =>
        runLiteralControl2_0(literalControlCases2[26]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.healthCheck.blockTime: Symbol(missing configuration)
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.healthCheck.blockTime: Symbol(missing configuration)', () =>
        runLiteralControl2_0(literalControlCases2[27]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.healthCheck.blockTime: 0
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.healthCheck.blockTime: 0', () =>
        runLiteralControl2_0(literalControlCases2[28]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.healthCheck.blockTime: -1
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.healthCheck.blockTime: -1', () =>
        runLiteralControl2_0(literalControlCases2[29]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.healthCheck.blockTime: Infinity
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.healthCheck.blockTime: Infinity', () =>
        runLiteralControl2_0(literalControlCases2[30]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.healthCheck.blockTime: NaN
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.healthCheck.blockTime: NaN', () =>
        runLiteralControl2_0(literalControlCases2[31]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.healthCheck.blockTime: 0.5
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.healthCheck.blockTime: 0.5', () =>
        runLiteralControl2_0(literalControlCases2[32]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.interval: 0
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.interval: 0', () =>
        runLiteralControl2_0(literalControlCases2[33]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.interval: -1
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.interval: -1', () =>
        runLiteralControl2_0(literalControlCases2[34]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.interval: Infinity
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.interval: Infinity', () =>
        runLiteralControl2_0(literalControlCases2[35]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.interval: NaN
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.interval: NaN', () =>
        runLiteralControl2_0(literalControlCases2[36]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.interval: 10
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.interval: 10', () =>
        runLiteralControl2_0(literalControlCases2[37]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.interval: 2147483.648
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.interval: 2147483.648', () =>
        runLiteralControl2_0(literalControlCases2[38]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.timeout: 0
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.timeout: 0', () =>
        runLiteralControl2_0(literalControlCases2[39]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.timeout: -1
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.timeout: -1', () =>
        runLiteralControl2_0(literalControlCases2[40]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.timeout: Infinity
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.timeout: Infinity', () =>
        runLiteralControl2_0(literalControlCases2[41]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.timeout: NaN
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.timeout: NaN', () =>
        runLiteralControl2_0(literalControlCases2[42]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.timeout: 10
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.timeout: 10', () =>
        runLiteralControl2_0(literalControlCases2[43]));

      /**
       * @target AvalancheConfig.constructor: rejects invalid avalanche.rpc.timeout: 2147483.648
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Change exactly the named configuration field to the tested
       * invalid value, then construct AvalancheConfig.
       * @expected Throw the error identifying that field; no network connector is
       * created.
       */
      it('rejects invalid avalanche.rpc.timeout: 2147483.648', () =>
        runLiteralControl2_0(literalControlCases2[44]));

      const literalControlCases3 = [-1, 0, Number.MAX_SAFE_INTEGER];
      /** Runs the original control against one unchanged case-table row. */
      const runLiteralControl3_0 = (
        height: typeof literalControlCases3[number]
      ) => {
        values.set('avalanche.initial.height', height);
        expect(new AvalancheConfig(reader).initialHeight).toEqual(height);
      };

      /**
       * @target AvalancheConfig.constructor: accepts safe initial height -1
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Set the tested safe starting height and construct
       * AvalancheConfig.
       * @expected Return that exact height.
       */
      it('accepts safe initial height -1', () =>
        runLiteralControl3_0(literalControlCases3[0]));

      /**
       * @target AvalancheConfig.constructor: accepts safe initial height 0
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Set the tested safe starting height and construct
       * AvalancheConfig.
       * @expected Return that exact height.
       */
      it('accepts safe initial height 0', () =>
        runLiteralControl3_0(literalControlCases3[1]));

      /**
       * @target AvalancheConfig.constructor: accepts safe initial height 9007199254740991
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Set the tested safe starting height and construct
       * AvalancheConfig.
       * @expected Return that exact height.
       */
      it('accepts safe initial height 9007199254740991', () =>
        runLiteralControl3_0(literalControlCases3[2]));

      /**
       * @target AvalancheConfig.constructor: accepts bounded source identifiers
       * and subsecond durations
       * @dependencies ConfigReader API double; real config parser; synthetic
       * node-config fixture for the isolated process
       * @scenario Set a 128-character source ID and half-second cadence/timeout,
       * then construct AvalancheConfig.
       * @expected Keep the full source ID and both 0.5-second durations.
       */
      it('accepts bounded source identifiers and subsecond durations', () => {
        values.set('avalanche.sourceId', 'A'.repeat(128));
        values.set('avalanche.interval', 0.5);
        values.set('avalanche.rpc.timeout', 0.5);
        const result = new AvalancheConfig(reader);
        expect(result.sourceId).toHaveLength(128);
        expect(result.interval).toEqual(0.5);
        expect(result.rpc.timeout).toEqual(0.5);
      });
    });
  });
  describe('getObservationValidThreshold', () => {
    /**
     * @target getObservationValidThreshold: uses the explicit Avalanche
     * observation block count
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Remove the legacy seconds threshold and read the Avalanche
     * block-count threshold.
     * @expected Return 150 blocks from validThresholdBlocks.
     */
    it('uses the explicit Avalanche observation block count', () => {
      values.set('observation.validThreshold', missing);
      expect(getObservationValidThreshold('avalanche', reader)).toEqual(150);
    });

    const literalControlCases4 = [
      missing,
      0,
      -1,
      1.5,
      '150',
      null,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
    ];
    /** Runs the original control against one unchanged case-table row. */
    const runLiteralControl4_0 = (
      value: typeof literalControlCases4[number]
    ) => {
      values.set('observation.validThresholdBlocks', value);
      expect(() => getObservationValidThreshold('avalanche', reader)).toThrow(
        'observation.validThresholdBlocks'
      );
    };

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: Symbol(missing configuration)
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: Symbol(missing configuration)', () =>
      runLiteralControl4_0(literalControlCases4[0]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: 0
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: 0', () =>
      runLiteralControl4_0(literalControlCases4[1]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: -1
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: -1', () =>
      runLiteralControl4_0(literalControlCases4[2]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: 1.5
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: 1.5', () =>
      runLiteralControl4_0(literalControlCases4[3]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: 150
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: 150', () =>
      runLiteralControl4_0(literalControlCases4[4]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: null
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: null', () =>
      runLiteralControl4_0(literalControlCases4[5]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: NaN
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: NaN', () =>
      runLiteralControl4_0(literalControlCases4[6]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: Infinity
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: Infinity', () =>
      runLiteralControl4_0(literalControlCases4[7]));

    /**
     * @target getObservationValidThreshold: rejects invalid observation block count: 9007199254740992
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Set only validThresholdBlocks to the tested invalid value and
     * read the Avalanche threshold.
     * @expected Reject the invalid block count.
     */
    it('rejects invalid observation block count: 9007199254740992', () =>
      runLiteralControl4_0(literalControlCases4[8]));

    /**
     * @target getObservationValidThreshold: preserves the existing seconds
     * conversion for other networks
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Select Ergo, set its legacy seconds threshold to 600, and omit
     * Avalanche block-count policy.
     * @expected Return the existing five-block conversion.
     */
    it('preserves the existing seconds conversion for other networks', () => {
      values.set('network', 'ergo');
      values.set('observation.validThreshold', 600);
      values.set('observation.validThresholdBlocks', missing);
      expect(getObservationValidThreshold('ergo', reader)).toEqual(5);
    });
  });
  describe('getConfig', () => {
    /**
     * @target getConfig: loads an existing watcher without requiring Avalanche
     * identity
     * @dependencies ConfigReader API double; real config parser; synthetic
     * node-config fixture for the isolated process
     * @scenario Run getConfig in a fresh synthetic Ergo process with an invalid
     * unused Avalanche value.
     * @expected The process succeeds with Ergo selected and Avalanche
     * configuration absent.
     */
    it('loads an existing watcher without requiring Avalanche identity', () => {
      // A fresh process bypasses getConfig's singleton and node-config's cache.
      const result = execFileSync(
        process.execPath,
        [
          '--import',
          'tsx',
          '--input-type=module',
          '-e',
          "import { getConfig } from './src/config/config.ts'; const c = getConfig(); if (c.general.networkWatcher !== 'ergo' || c.avalanche !== undefined) process.exit(1);",
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'test',
            NODE_CONFIG: JSON.stringify({
              network: 'ergo',
              avalanche: { chainId: 'invalid' },
            }),
          },
          encoding: 'utf8',
        }
      );
      expect(result).toEqual(expect.any(String));
    });
  });
});
