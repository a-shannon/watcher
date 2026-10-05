/** Synthetic C-Chain lock address. */
export const lockAddress = '0x' + '11'.repeat(20);
/** Canonical synthetic settled block hash. */
export const hash = '0x' + 'aa'.repeat(32);
/** Synthetic wrapped Ergo token ID. */
export const targetToken = '44'.repeat(32);
/** Existing synthetic native-lock payload for the public decoder fixture. */
export const rawData =
  '00000000007554fc820000000000962f582103f999da8e6e42660e4464d17d29e63bc006734a6710a24eb489b466323d3a9339';

/** Frozen mainnet JOE producer metadata; the generated nine-decimal map yields 100 shared units. */
export const joeMetadata =
  '00000000000000000200000000000000032103f999da8e6e42660e4464d17d29e63bc006734a6710a24eb489b466323d3a9339';
export const joe = '0x6e84a6216ea6dacc71ee8e6b0a5b7322eebc0fdd';
export const joeCounterpart = '0c'.repeat(32);
export const joeRawAmount = 100000000000n;

/** Complete offline merger output pins; existing chains/assets remain in the fixture. */
export const mergedContractsSha256 =
  '911236500cc3bd52a85895c1fc9ae3d04e70f52b746915933f0f19942315d280';
export const mergedTokensSha256 =
  '6c2106bfb0aef7b9f5c6ce5536338a59ece5b762b075d4c5b872cd9067ad7cfb';
