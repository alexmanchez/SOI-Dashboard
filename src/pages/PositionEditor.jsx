import {
  useState,
} from 'react';
import {
  Check,
} from 'lucide-react';

import {
  BG, BORDER, TEXT_DIM, TEXT_MUTE, ACCENT,
} from '../lib/theme';
import { getSectors } from '../lib/sectors';
import { liquidityOverrideOf } from '../lib/snapshots';
import { parseNum } from '../lib/parsing';
import {
  Field, TextInput, Select, Modal,
} from '../components/ui';

export function PositionEditor({ mode, position, onCancel, onSave }) {
  const [form, setForm] = useState(() => ({
    id: position?.id || null,
    positionName: position?.positionName || '',
    ticker: position?.ticker || '',
    assetType: position?.assetType || 'Liquid Token',
    sectorId: position?.sectorId || 'infrastructure',
    quantity: position?.quantity ?? '',
    soiPrice: position?.soiPrice ?? '',
    soiMarketValue: position?.soiMarketValue ?? '',
    costBasis: position?.costBasis ?? '',
    acquisitionDate: position?.acquisitionDate || '',
    liquidityOverride: liquidityOverrideOf(position || {}),
    cgTokenId: position?.cgTokenId || '',
    notes: position?.notes || '',
  }));

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canSave = form.positionName && form.soiMarketValue !== '' && parseNum(form.soiMarketValue) != null;

  const handleSave = () => {
    const qty = parseNum(form.quantity);
    const price = parseNum(form.soiPrice);
    let mv = parseNum(form.soiMarketValue);
    if ((mv == null || mv === 0) && qty != null && price != null) mv = qty * price;
    const payload = {
      id: form.id || undefined,
      positionName: form.positionName.trim(),
      ticker: form.ticker.trim(),
      assetType: form.assetType,
      sectorId: form.sectorId,
      quantity: qty,
      soiPrice: price,
      soiMarketValue: mv || 0,
      costBasis: parseNum(form.costBasis),
      acquisitionDate: form.acquisitionDate || null,
      liquidityOverride: form.liquidityOverride,
      cgTokenId: form.cgTokenId.trim() || null,
      chain: null, address: null,
      notes: form.notes,
    };
    onSave(payload);
  };

  return (
    <Modal title={mode === 'edit' ? `Edit: ${position?.positionName || 'Position'}` : 'Add position'} onClose={onCancel}>
      <div className="p-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Position Name *">
            <TextInput value={form.positionName} onChange={v=>set('positionName', v)} placeholder="e.g., Ethereum" />
          </Field>
          <Field label="Ticker / Symbol">
            <TextInput value={form.ticker} onChange={v=>set('ticker', v.toUpperCase())} placeholder="e.g., ETH" />
          </Field>
          <Field label="Asset Type">
            <Select value={form.assetType} onChange={v=>set('assetType', v)} options={[
              {value: 'Liquid Token', label: 'Liquid Token'},
              {value: 'SAFT', label: 'SAFT (pre-TGE)'},
              {value: 'SAFE', label: 'SAFE (equity)'},
              {value: 'Warrant', label: 'Warrant'},
              {value: 'LP Token', label: 'LP Token'},
              {value: 'Stablecoin', label: 'Stablecoin / Cash'},
              {value: 'Unclassified', label: 'Unclassified'},
            ]} />
          </Field>
          <Field label="Sector">
            <Select value={form.sectorId} onChange={v=>set('sectorId', v)} options={[
              ...getSectors().map(s => ({value: s.id, label: s.label})),
              {value: 'unclassified', label: 'Unclassified'},
            ]} />
          </Field>
          <Field label="Quantity">
            <TextInput value={form.quantity} onChange={v=>set('quantity', v)} placeholder="e.g., 1000000" align="right" />
          </Field>
          <Field label="Price at snapshot (per unit)">
            <TextInput value={form.soiPrice} onChange={v=>set('soiPrice', v)} placeholder="e.g., 2200" align="right" />
          </Field>
          <Field label="Market Value at snapshot *">
            <TextInput value={form.soiMarketValue} onChange={v=>set('soiMarketValue', v)} placeholder="e.g., 2200000" align="right" />
          </Field>
          <Field label="Cost Basis ($)">
            <TextInput value={form.costBasis} onChange={v=>set('costBasis', v)} placeholder="e.g., 1500000" align="right" />
          </Field>
          <Field label="Acquisition Date">
            <TextInput type="date" value={form.acquisitionDate} onChange={v=>set('acquisitionDate', v)} />
          </Field>
          <Field label="Liquidity">
            <Select value={form.liquidityOverride} onChange={v=>set('liquidityOverride', v)} options={[
              {value: 'auto', label: 'Auto (based on asset type)'},
              {value: 'liquid', label: 'Force liquid'},
              {value: 'illiquid', label: 'Force illiquid'},
            ]} />
          </Field>
          <Field label="CoinGecko Token ID (for live prices)" full>
            <TextInput value={form.cgTokenId} onChange={v=>set('cgTokenId', v)} placeholder="e.g., ethereum, hyperliquid, ondo-finance" />
            <div className="text-[10px] mt-1" style={{color:TEXT_MUTE}}>
              Find this in the URL on coingecko.com (e.g., coingecko.com/en/coins/<strong style={{color:TEXT_DIM}}>ethereum</strong>)
            </div>
          </Field>
          <Field label="Notes" full>
            <TextInput value={form.notes} onChange={v=>set('notes', v)} placeholder="Optional — e.g., locked until 2027, side letter terms" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-3" style={{borderTop: `1px solid ${BORDER}`}}>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 rounded"
            style={{color:TEXT_DIM, border:`1px solid ${BORDER}`}}>Cancel</button>
          <button onClick={handleSave} disabled={!canSave}
            className="text-xs px-4 py-1.5 rounded font-medium flex items-center gap-1"
            style={{backgroundColor: ACCENT, color: BG, opacity: canSave?1:0.4}}>
            <Check size={12}/> {mode === 'edit' ? 'Save changes' : 'Add position'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

