import { DefaultLogger } from '@rosen-bridge/abstract-logger';
import { vi } from 'vitest';
import * as configModule from '../../src/config/config';
import { AVALANCHE_CHAIN_NAME } from '../../src/config/constants';
import { CreateScanner } from '../../src/utils/scanner';
import { ergoInterval, observationInterval } from './testData';
import {
  ergoScanner,
  logger,
  observationScanner,
} from './mocked/scanning.mock';

/** Compose the actual startup entry with isolated config, logger and scanner dependencies. */
export const configureStartup = () => {
  const current = configModule.getConfig();
  vi.spyOn(configModule, 'getConfig').mockReturnValue({
    ...current,
    general: {
      ...current.general,
      networkWatcher: AVALANCHE_CHAIN_NAME,
      ergoInterval,
    },
    avalanche: {
      type: 'rpc',
      chainId: 43113,
      sourceId: 'fixture-startup-fuji',
      initialHeight: 0,
      interval: observationInterval,
      blockTime: 1.25,
      rpc: { url: 'http://127.0.0.1:1', timeout: 1 },
    },
  });
  vi.spyOn(logger, 'child').mockReturnValue(logger);
  vi.spyOn(DefaultLogger, 'getInstance').mockReturnValue(logger);
  vi.spyOn(CreateScanner, 'getInstance').mockReturnValue({
    /** Returns the isolated external Ergo update dependency. */
    getErgoScanner: () => ergoScanner,
    /** Returns the isolated external observation update dependency. */
    getObservationScanner: () => observationScanner,
  } as unknown as CreateScanner);
};

/** Hold one external update pending until the test explicitly completes it. */
export const pendingUpdate = () => {
  /** Receives the deferred promise resolver before the fixture is returned. */
  let complete: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return {
    promise,
    /** Completes the held external update without advancing the fake clock. */
    complete: () => complete(),
  };
};
