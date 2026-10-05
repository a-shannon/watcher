import '@rosen-bridge/extended-typeorm/bootstrap';
import { beforeAll } from 'vitest';
import { DefaultLogger, DummyLogger } from '@rosen-bridge/abstract-logger';
import nock from 'nock';

DefaultLogger.init(new DummyLogger());
nock.disableNetConnect();

const { getConfig } = await import('../src/config/config');
const { TokensConfig } = await import('../src/config/tokensConfig');

beforeAll(async () => {
  await TokensConfig.init(getConfig().general.rosenTokensPath);
});
