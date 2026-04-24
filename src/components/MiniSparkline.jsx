import {
  GREEN, RED,
} from '../lib/theme';

export function MiniSparkline({ series, width=120, height=32 }) {
  if (!series?.length || series.length < 2) {
    return <div style={{width, height}} />;
  }
  const vals = series.map(s => s.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const positive = vals[vals.length - 1] >= vals[0];
  const color = positive ? GREEN : RED;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{display:'block'}}>
      <polyline fill="none" stroke={color} strokeWidth="1.25" points={points} />
    </svg>
  );
}

