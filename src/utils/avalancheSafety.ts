import { ObservationEntity } from '@rosen-bridge/abstract-observation-extractor';
import { AvalancheRpcScanner } from '@rosen-bridge/evm-scanner';
import { getConfig } from '../config/config';
import { AVALANCHE_CHAIN_NAME } from '../config/constants';
import { CreateScanner } from './scanner';

/** Bind observation actions to the single writer's persisted settlement state. */
export class AvalancheObservationSafety {
  /** Resolves the selected watcher and its current single-writer observation scanner. */
  constructor(
    private readonly getChain: () => string = () =>
      getConfig().general.networkWatcher,
    private readonly getScanner: () => unknown = () =>
      CreateScanner.getInstance().getObservationScanner()
  ) {}

  /** Selects Avalanche safety and refuses its observations on a different watcher. */
  private requiresAvalanche = (observation?: ObservationEntity): boolean => {
    if (this.getChain() === AVALANCHE_CHAIN_NAME) return true;
    if (observation?.fromChain?.toLowerCase() === AVALANCHE_CHAIN_NAME)
      throw new Error(
        'Stored Avalanche observation requires an Avalanche watcher'
      );
    return false;
  };

  /** Requires the settled scanner and matching chain, extractor and source-block provenance. */
  private qualifiedScanner = (observation?: ObservationEntity) => {
    const scanner = this.getScanner();
    if (!(scanner instanceof AvalancheRpcScanner))
      throw new Error('Avalanche observation requires its settled scanner');
    if (
      !observation ||
      observation.fromChain !== AVALANCHE_CHAIN_NAME ||
      observation.extractor !== 'avalanche-rpc-extractor' ||
      typeof observation.block !== 'string' ||
      typeof observation.sourceBlockId !== 'string' ||
      observation.block.toLowerCase() !==
        observation.sourceBlockId.toLowerCase()
    )
      throw new Error('Invalid Avalanche observation provenance');
    return { scanner, observation };
  };

  /** Early eligibility check; action-time exclusion is provided by withObservation. */
  assertObservation = async (
    observation?: ObservationEntity
  ): Promise<void> => {
    if (!this.requiresAvalanche(observation)) return;
    const qualified = this.qualifiedScanner(observation);
    await qualified.scanner.assertObservation(
      qualified.observation.height,
      qualified.observation.block
    );
  };

  /** Executes an Avalanche observation action under the scanner's settlement exclusion. */
  withObservation = async <T>(
    observation: ObservationEntity | undefined,
    action: () => T | Promise<T>
  ): Promise<T> => {
    if (!this.requiresAvalanche(observation)) return action();
    const qualified = this.qualifiedScanner(observation);
    return qualified.scanner.withObservation(
      qualified.observation.height,
      qualified.observation.block,
      action
    );
  };
}

export const avalancheObservationSafety = new AvalancheObservationSafety();
