import React from 'react';

export function SimpleBarChart({ data = [], width = 240, height = 80, colors = ['#4da6ff'] }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = data.length ? width / data.length : width;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 12);
        const x = i * barWidth + 6;
        const y = height - h - 6;
        return (
          <rect key={i} x={x} y={y} width={barWidth - 12} height={h} fill={colors[i % colors.length]} rx="4" />
        );
      })}
    </svg>
  );
}

export function SimplePieChart({ data = [], size = 120, colors = ['#4da6ff','#ffb54d','#7bd389','#ff7ab6','#9e9e9e'] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let angle = -90;
  const cx = size/2, cy = size/2, r = size/2 - 2;
  const slices = data.map((d, i) => {
    const portion = d.value / total;
    const a2 = angle + portion * 360;
    const large = portion > 0.5 ? 1 : 0;
    const rad1 = (Math.PI/180) * angle;
    const rad2 = (Math.PI/180) * a2;
    const x1 = cx + r * Math.cos(rad1);
    const y1 = cy + r * Math.sin(rad1);
    const x2 = cx + r * Math.cos(rad2);
    const y2 = cy + r * Math.sin(rad2);
    const dAttr = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle = a2;
    return { dAttr, color: colors[i % colors.length], label: d.label, value: d.value };
  });
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => (
        <path key={i} d={s.dAttr} fill={s.color} stroke="#fff" strokeWidth="1" />
      ))}
    </svg>
  );
}

export function Sparkline({ values = [], width = 200, height = 40, stroke = '#4da6ff' }) {
  if (!values || !values.length) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const step = width / (values.length - 1 || 1);
  const points = values.map((v, i) => `${i*step},${height - ((v - min) / range) * height}`).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline fill="none" stroke={stroke} strokeWidth="2" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const Charts = { SimpleBarChart, SimplePieChart, Sparkline };
export default Charts;
