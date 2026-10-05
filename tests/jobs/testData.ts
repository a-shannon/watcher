/** Synthetic observation retry period in seconds. */
export const observationInterval = 2;
/** Separate Ergo retry period keeps its timer outside observation assertions. */
export const ergoInterval = 60;
/** Marker carried by a synthetic exception to detect raw failure text in logs. */
export const credentialMarker = 'fixture-private-rpc-material';
/** Fixed operational message for an Avalanche scan failure. */
export const sanitizedWarning =
  'Avalanche scanner update failed; inspect persisted safety state.';
