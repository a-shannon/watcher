import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStartup, pendingUpdate } from './testUtils';
import { observationScanner, warnings } from './mocked/scanning.mock';
import { credentialMarker, sanitizedWarning } from './testData';

describe('scannerInit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    configureStartup();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /**
   * @target scannerInit - sanitizes Avalanche failure logs and retries the same scanner
   * @dependencies Isolated external scanner update, logger and configuration
   * @scenario Two consecutive updates reject with synthetic credential-bearing error text
   * @expected Each failure emits a fixed warning and the same scanner retries after two seconds
   */
  it('sanitizes Avalanche failure logs and retries the same scanner', async () => {
    observationScanner.update.mockRejectedValueOnce(
      new Error(credentialMarker)
    );
    observationScanner.update.mockRejectedValueOnce(
      new Error(credentialMarker)
    );
    const { scannerInit } = await import('../../src/jobs/initScanner');
    scannerInit();
    await vi.advanceTimersByTimeAsync(0);
    expect(warnings).toHaveBeenCalledTimes(1);
    expect(warnings).toHaveBeenNthCalledWith(1, sanitizedWarning);
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(credentialMarker);
    expect(observationScanner.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1999);
    expect(observationScanner.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(observationScanner.update).toHaveBeenCalledTimes(2);
    expect(warnings).toHaveBeenCalledTimes(2);
    expect(warnings).toHaveBeenNthCalledWith(2, sanitizedWarning);
    expect(JSON.stringify(warnings.mock.calls)).not.toContain(credentialMarker);
  });

  /**
   * @target scannerInit - waits for the pending Avalanche update before scheduling another
   * @dependencies Deferred external observation update and fake clock
   * @scenario An observation update remains pending for ten seconds
   * @expected No overlapping update occurs and the next scan starts two seconds after completion
   */
  it('waits for the pending Avalanche update before scheduling another', async () => {
    const pending = pendingUpdate();
    observationScanner.update.mockImplementationOnce(() => pending.promise);
    const { scannerInit } = await import('../../src/jobs/initScanner');
    scannerInit();
    await vi.advanceTimersByTimeAsync(10000);
    expect(observationScanner.update).toHaveBeenCalledTimes(1);
    expect(warnings).not.toHaveBeenCalled();
    pending.complete();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1999);
    expect(observationScanner.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(observationScanner.update).toHaveBeenCalledTimes(2);
    expect(warnings).not.toHaveBeenCalled();
  });
});
