import { expect, vi } from 'vitest';
import {
  Block as EthersBlock,
  Interface,
  Transaction,
  TransactionReceipt,
  TransactionResponse,
  TransactionResponseParams,
} from 'ethers';
import { AvalancheRpcNetwork } from '@rosen-bridge/evm-scanner';
import {
  lockAddress,
  hash,
  rawData,
  joe,
  joeRawAmount,
  joeMetadata,
} from '../avalancheScannerTestData';
/** Mock only external ethers provider APIs with one canonical synthetic lock transaction. */
export const mockRpc = (network: AvalancheRpcNetwork, status = 1) => {
  const provider = network['provider'];
  const signed = Transaction.from({
    type: 2,
    to: lockAddress,
    data: '0x' + rawData,
    nonce: 10,
    gasLimit: 21000n,
    maxPriorityFeePerGas: 500000000n,
    maxFeePerGas: 48978500000n,
    value: 92850988521632054n,
    chainId: network.expectedChainId,
    accessList: [],
    signature: {
      r: '0x' + '01'.repeat(32),
      s: '0x' + '02'.repeat(32),
      yParity: 0,
    },
  });
  const tx = new TransactionResponse(
    signed as unknown as TransactionResponseParams,
    provider
  );
  Object.defineProperties(tx, {
    blockHash: { value: hash },
    blockNumber: { value: 10 },
    index: { value: 0 },
  });
  const block = {
    number: 10,
    hash,
    parentHash: '0x' + 'bb'.repeat(32),
    timestamp: 1790769600,
    length: 1,
    transactions: [tx.hash],
    prefetchedTransactions: [tx],
  } as unknown as EthersBlock;
  vi.spyOn(provider, 'send').mockImplementation(async (method, params) => {
    expect(method).toEqual('eth_chainId');
    expect(params).toEqual([]);
    return '0x' + network.expectedChainId.toString(16);
  });
  vi.spyOn(provider, 'getBlock').mockImplementation(async (id) => {
    if (id === 'finalized' || id === 10 || id === hash) return block;
    throw new Error(`Unexpected block request: ${id}`);
  });
  const receipt = {
    hash: tx.hash,
    blockHash: hash,
    blockNumber: 10,
    index: 0,
    status,
    to: lockAddress,
    from: tx.from,
    contractAddress: null,
    logsBloom: '0x' + '00'.repeat(256),
    gasUsed: 21000n,
    cumulativeGasUsed: 21000n,
    gasPrice: 1n,
    type: 2,
    root: null,
    logs: [],
  } as unknown as TransactionReceipt;
  const receipts = vi
    .spyOn(provider, 'getTransactionReceipt')
    .mockResolvedValue(receipt);
  return { tx, receipts, receipt };
};

/** Mock external ethers APIs with a signed mainnet JOE lock and matching Transfer movement. */
export const mockJoeRpc = (network: AvalancheRpcNetwork, custody: string) => {
  const provider = network['provider'];
  const abi = new Interface([
    'function transfer(address,uint256) returns (bool)',
    'event Transfer(address indexed from,address indexed to,uint256 value)',
  ]);
  const signed = Transaction.from({
    type: 2,
    to: joe,
    data:
      abi.encodeFunctionData('transfer', [custody, joeRawAmount]) + joeMetadata,
    nonce: 10,
    gasLimit: 50000n,
    maxPriorityFeePerGas: 500000000n,
    maxFeePerGas: 48978500000n,
    value: 0n,
    chainId: network.expectedChainId,
    accessList: [],
    signature: {
      r: '0x' + '01'.repeat(32),
      s: '0x' + '02'.repeat(32),
      yParity: 0,
    },
  });
  const tx = new TransactionResponse(
    signed as unknown as TransactionResponseParams,
    provider
  );
  Object.defineProperties(tx, {
    blockHash: { value: hash },
    blockNumber: { value: 10 },
    index: { value: 0 },
  });
  const event = abi.getEvent('Transfer');
  if (!event) throw new Error('Missing synthetic Transfer event');
  const transfer = abi.encodeEventLog(event, [tx.from, custody, joeRawAmount]);
  const log = {
    ...transfer,
    address: joe,
    transactionHash: tx.hash,
    blockHash: hash,
    blockNumber: 10,
    transactionIndex: 0,
    index: 0,
    removed: false,
  };
  const receipt = {
    hash: tx.hash,
    blockHash: hash,
    blockNumber: 10,
    index: 0,
    status: 1,
    to: joe,
    from: tx.from,
    contractAddress: null,
    logsBloom: '0x' + '00'.repeat(256),
    gasUsed: 50000n,
    cumulativeGasUsed: 50000n,
    gasPrice: 1n,
    type: 2,
    root: null,
    logs: [log],
  };
  const block = {
    number: 10,
    hash,
    parentHash: '0x' + 'bb'.repeat(32),
    timestamp: 1790769600,
    length: 1,
    transactions: [tx.hash],
    prefetchedTransactions: [tx],
  } as unknown as EthersBlock;
  vi.spyOn(provider, 'send').mockImplementation(async (method, params) => {
    expect(method).toEqual('eth_chainId');
    expect(params).toEqual([]);
    return '0xa86a';
  });
  vi.spyOn(provider, 'getBlock').mockImplementation(async (id) => {
    if (id === 'finalized' || id === 10 || id === hash) return block;
    throw new Error(`Unexpected block request: ${id}`);
  });
  const receipts = vi
    .spyOn(provider, 'getTransactionReceipt')
    .mockResolvedValue(receipt as unknown as TransactionReceipt);
  return { tx, receipt, receipts, log };
};
