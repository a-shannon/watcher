import type { AbstractLogger } from '@rosen-bridge/abstract-logger';
import type { BlockCleanupConfig } from '@rosen-bridge/abstract-scanner/dist/scanner/interfaces';
import type { DataSource } from '@rosen-bridge/extended-typeorm';
import type { TokenMap } from '@rosen-bridge/tokens';
import {
  AvalancheRpcNetwork,
  AvalancheRpcScanner,
} from '@rosen-bridge/evm-scanner';
import { AvalancheRpcObservationExtractor } from '@rosen-bridge/evm-observation-extractor';
import type { AvalancheConfig, RosenConfig } from '../config/config';

interface AvalancheScannerDependencies {
  dataSource: DataSource;
  tokens: TokenMap;
  rosen: Pick<RosenConfig, 'lockAddress'>;
  storeRawData: boolean;
  blockCleanupConfig: BlockCleanupConfig;
  logger?: AbstractLogger;
  extractorLogger?: AbstractLogger;
  createNetwork?: (
    ...args: ConstructorParameters<typeof AvalancheRpcNetwork>
  ) => AvalancheRpcNetwork;
  createScanner?: (
    config: ConstructorParameters<typeof AvalancheRpcScanner>[0]
  ) => AvalancheRpcScanner;
}

/** Builds the settled source and awaits registration before exposing its scanner. */
export const createAvalancheScanner = async (
  config: AvalancheConfig,
  dependencies: AvalancheScannerDependencies
): Promise<AvalancheRpcScanner> => {
  const network = (
    dependencies.createNetwork ??
    ((...args) => new AvalancheRpcNetwork(...args))
  )(
    config.rpc.url,
    BigInt(config.chainId),
    config.rpc.timeout * 1000,
    config.rpc.authToken
  );
  if (network.expectedChainId !== BigInt(config.chainId)) {
    throw new Error(
      'Avalanche scanner network does not match configured chain'
    );
  }
  const scanner = (
    dependencies.createScanner ??
    ((options) => new AvalancheRpcScanner(options))
  )({
    dataSource: dependencies.dataSource,
    network,
    initialHeight: config.initialHeight,
    sourceId: config.sourceId,
    logger: dependencies.logger,
    blockCleanupConfig: dependencies.blockCleanupConfig,
  });
  await scanner.registerExtractor(
    new AvalancheRpcObservationExtractor(
      dependencies.rosen.lockAddress,
      dependencies.dataSource,
      dependencies.tokens,
      dependencies.extractorLogger,
      dependencies.storeRawData
    )
  );
  return scanner;
};
