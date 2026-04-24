import React, { useContext, useState } from 'react';

import { PANEL_2, BORDER, TEXT_DIM } from '../lib/theme';
import { CMC_GIF, CMC_IMG } from '../lib/api/coinmarketcap';
import { TokenImageContext } from '../contexts';

export const TokenIcon = ({ ticker, name, size = 20 }) => {
  const ctx = useContext(TokenImageContext) || {};
  const crMap = ctx.crMap || {};
  const cmcIdMap = ctx.cmcIdMap || {};
  const symbol = (ticker || '').trim();
  const symbolLower = symbol.toLowerCase();
  const symbolUpper = symbol.toUpperCase();
  const cmcId = cmcIdMap[symbolUpper];
  const crImage = crMap[symbolUpper];
  const sources = [];
  if (cmcId) sources.push(CMC_GIF(cmcId));  // primary: CoinMarketCap animated (if available)
  if (cmcId) sources.push(CMC_IMG(cmcId));  // secondary: CoinMarketCap static PNG
  if (crImage) sources.push(crImage);        // tertiary: CryptoRank image
  if (symbolLower) sources.push(`https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@master/svg/color/${symbolLower}.svg`);
  const [stage, setStage] = useState(0);
  // Reset the image-fallback chain when the ticker / id changes, without
  // waiting a render. setState-during-render is React's recommended pattern
  // for resetting state keyed on props.
  const sourceKey = `${symbolUpper}|${cmcId}|${crImage}`;
  const [_prevSourceKey, _setPrevSourceKey] = useState(sourceKey);
  if (sourceKey !== _prevSourceKey) {
    _setPrevSourceKey(sourceKey);
    setStage(0);
  }
  const src = sources[stage];
  if (!symbol || !src) {
    const letter = ((ticker || name || '?').trim().charAt(0) || '?').toUpperCase();
    return (
      <div style={{
        width: size, height: size, borderRadius: size/2,
        backgroundColor: PANEL_2, color: TEXT_DIM,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.max(9, Math.round(size * 0.5)), fontWeight: 600,
        border: `1px solid ${BORDER}`,
        flexShrink: 0,
      }}>{letter}</div>
    );
  }
  return (
    <img
      src={src}
      width={size} height={size}
      alt={ticker || name || ''}
      decoding="async"
      onError={() => setStage(stage + 1)}
      style={{ borderRadius: size/2, flexShrink: 0, backgroundColor: 'transparent', objectFit: 'cover' }}
    />
  );
};

