import { createContext } from 'react';

// { crMap, cmcIdMap } — ticker -> logo URL lookups used by TokenIcon.
export const TokenImageContext = createContext({ crMap: {}, cmcIdMap: {} });

// Setter for the shared token detail drawer; any list/table can open it.
export const OpenTokenDetailContext = createContext(() => {});
