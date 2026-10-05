import { DummyLogger } from '@rosen-bridge/abstract-logger';
import { vi } from 'vitest';

/** Logger dependency shared by the imported startup module across cases. */
export const logger = new DummyLogger();
/** Observe only warnings emitted by the actual startup loop. */
export const warnings = vi.spyOn(logger, 'warn');
/** External Ergo scanner update dependency for startup composition. */
export const ergoScanner = {
  update: vi.fn(async (): Promise<void> => undefined),
  /** Supplies the external Ergo scanner's stable diagnostic name. */
  name: () => 'ergo-fixture',
};
/** External observation scanner update dependency for retry and pending controls. */
export const observationScanner = {
  update: vi.fn(async (): Promise<void> => undefined),
  /** Supplies the external observation scanner's stable diagnostic name. */
  name: () => 'avalanche-fixture',
};
