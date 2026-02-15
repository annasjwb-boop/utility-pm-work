// @ts-nocheck — Load Signal + Weather Context panel for Grid IQ views
'use client';

import { useMemo } from 'react';
import {
  Thermometer, Cloud, CloudRain, CloudSnow, CloudLightning,
  Sun, Wind, Zap, TrendingUp, TrendingDown, AlertTriangle,
  Gauge, Clock, Activity,
} from 'lucide-react';

// ── Seeded RNG ──
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function tagToSeed(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// ── Load Profile Generator ──
interface LoadPoint { hour: number; load: number; peak: boolean; }
interface WeatherContext {
  condition: string;
  icon: 'sun' | 'cloud' | 'rain' | 'storm' | 'snow' | 'wind';
  tempF: number;
  humidity: number;
  forecast: string;
  riskFactor: string;
  riskLevel: 'low' | 'medium' | 'high';
}

function generateLoadProfile(baseLoad: number, seed: number): LoadPoint[] {
  const rng = seededRng(seed);
  const points: LoadPoint[] = [];
  // 7-day hourly profile (168 hours)
  for (let h = 0; h < 168; h++) {
    const dayHour = h % 24;
    const dayOfWeek = Math.floor(h / 24);
    const isWeekend = dayOfWeek >= 5;

    // Diurnal pattern: low overnight, morning ramp, afternoon peak, evening decline
    let diurnal = 0.6;
    if (dayHour >= 6 && dayHour < 9) diurnal = 0.6 + (dayHour - 6) * 0.1; // morning ramp
    else if (dayHour >= 9 && dayHour < 12) diurnal = 0.9 + rng() * 0.05;
    else if (dayHour >= 12 && dayHour < 17) diurnal = 0.95 + rng() * 0.08; // afternoon peak
    else if (dayHour >= 17 && dayHour < 21) diurnal = 0.85 + rng() * 0.05; // evening
    else if (dayHour >= 21) diurnal = 0.7 - (dayHour - 21) * 0.03;

    if (isWeekend) diurnal *= 0.85;

    // Random noise + occasional spikes
    const noise = (rng() - 0.5) * 0.06;
    const spike = rng() > 0.97 ? 0.1 + rng() * 0.08 : 0;
    const loadPct = Math.min(105, Math.max(30, baseLoad * diurnal + noise * baseLoad + spike * baseLoad));
    const isPeak = loadPct > baseLoad * 0.95;

    points.push({ hour: h, load: Math.round(loadPct * 10) / 10, peak: isPeak });
  }
  return points;
}

function generateWeather(seed: number, health: number): WeatherContext {
  const rng = seededRng(seed + 5555);
  const conditions: WeatherContext[] = [
    { condition: 'Clear & Hot', icon: 'sun', tempF: 92 + Math.floor(rng() * 10), humidity: 55 + Math.floor(rng() * 20), forecast: 'Heat advisory through Thursday. Peak demand expected 2–6 PM.', riskFactor: 'Heat stress on cooling', riskLevel: 'high' },
    { condition: 'Partly Cloudy', icon: 'cloud', tempF: 78 + Math.floor(rng() * 8), humidity: 50 + Math.floor(rng() * 15), forecast: 'Mild conditions. No severe weather expected 72h.', riskFactor: 'Normal operating conditions', riskLevel: 'low' },
    { condition: 'Thunderstorms', icon: 'storm', tempF: 82 + Math.floor(rng() * 6), humidity: 75 + Math.floor(rng() * 15), forecast: 'Severe thunderstorm watch until 9 PM. Lightning risk elevated.', riskFactor: 'Lightning / surge risk', riskLevel: 'high' },
    { condition: 'Rain', icon: 'rain', tempF: 65 + Math.floor(rng() * 10), humidity: 80 + Math.floor(rng() * 15), forecast: 'Steady rain through tomorrow. Flooding possible in low areas.', riskFactor: 'Moisture ingress risk', riskLevel: 'medium' },
    { condition: 'Cold Snap', icon: 'snow', tempF: 18 + Math.floor(rng() * 12), humidity: 40 + Math.floor(rng() * 20), forecast: 'Arctic front arriving overnight. Wind chill advisory.', riskFactor: 'Cold load pickup / ice', riskLevel: 'high' },
    { condition: 'Windy', icon: 'wind', tempF: 55 + Math.floor(rng() * 15), humidity: 45 + Math.floor(rng() * 15), forecast: 'Sustained winds 25–35 mph. Gusts to 50 mph possible.', riskFactor: 'Vegetation contact risk', riskLevel: 'medium' },
  ];

  // Bias toward worse weather for worse health
  const idx = health < 40
    ? [0, 2, 4][Math.floor(rng() * 3)]  // heat, storms, cold for critical
    : health < 60
      ? [3, 5, 1][Math.floor(rng() * 3)] // rain, wind, cloudy for degraded
      : Math.floor(rng() * conditions.length);

  return conditions[idx];
}

// ── Weather Icon Component ──
const WEATHER_ICONS: Record<string, React.ReactNode> = {
  sun: <Sun className="w-4 h-4" />,
  cloud: <Cloud className="w-4 h-4" />,
  rain: <CloudRain className="w-4 h-4" />,
  storm: <CloudLightning className="w-4 h-4" />,
  snow: <CloudSnow className="w-4 h-4" />,
  wind: <Wind className="w-4 h-4" />,
};

const RISK_COLORS = {
  low: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  medium: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  high: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
};

// ── Sparkline SVG ──
function LoadSparkline({ points, width = 320, height = 48 }: { points: LoadPoint[]; width?: number; height?: number }) {
  const maxLoad = Math.max(...points.map(p => p.load));
  const minLoad = Math.min(...points.map(p => p.load));
  const range = maxLoad - minLoad || 1;

  const pathD = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.load - minLoad) / range) * (height - 4) - 2;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Area fill
  const areaD = pathD + ` L ${width},${height} L 0,${height} Z`;

  // Peak zones
  const peakRects = [];
  let inPeak = false;
  let peakStart = 0;
  points.forEach((p, i) => {
    if (p.peak && !inPeak) { inPeak = true; peakStart = i; }
    if (!p.peak && inPeak) {
      inPeak = false;
      const x1 = (peakStart / (points.length - 1)) * width;
      const x2 = (i / (points.length - 1)) * width;
      peakRects.push(<rect key={`p-${peakStart}`} x={x1} y={0} width={x2 - x1} height={height} fill="rgba(244,63,94,0.08)" />);
    }
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      {peakRects}
      <path d={areaD} fill="url(#loadGrad)" opacity="0.3" />
      <path d={pathD} fill="none" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" />
      <defs>
        <linearGradient id="loadGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(139,92,246,0.3)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
// EXPORTED COMPONENT
// ══════════════════════════════════════════════════════════════

interface ContextPanelProps {
  assetTag?: string;
  baseLoad?: number;
  health?: number;
}

export function LoadWeatherContext({ assetTag = 'default', baseLoad = 75, health = 50 }: ContextPanelProps) {
  const seed = tagToSeed(assetTag);

  const loadProfile = useMemo(() => generateLoadProfile(baseLoad, seed), [baseLoad, seed]);
  const weather = useMemo(() => generateWeather(seed, health), [seed, health]);
  const riskStyle = RISK_COLORS[weather.riskLevel];

  // Summary stats
  const last24h = loadProfile.slice(-24);
  const currentLoad = last24h[last24h.length - 1].load;
  const avgLoad = Math.round(last24h.reduce((s, p) => s + p.load, 0) / last24h.length * 10) / 10;
  const peakLoad = Math.round(Math.max(...last24h.map(p => p.load)) * 10) / 10;
  const peakHours = last24h.filter(p => p.peak).length;

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.015] mb-4 overflow-hidden">
      <div className="grid grid-cols-[1fr_auto] divide-x divide-white/5">

        {/* Load Signal */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Load Signal — 7 Day</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-white/30">Now: <span className="text-white/70 font-mono font-medium">{currentLoad}%</span></span>
              <span className="text-white/30">24h Avg: <span className="text-white/70 font-mono">{avgLoad}%</span></span>
              <span className="text-white/30">24h Peak: <span className={`font-mono font-medium ${peakLoad > 90 ? 'text-rose-400' : peakLoad > 80 ? 'text-amber-400' : 'text-white/70'}`}>{peakLoad}%</span></span>
              {peakHours > 0 && <span className="text-rose-400/60 text-[9px]">⚠ {peakHours}h at peak</span>}
            </div>
          </div>
          <div className="rounded overflow-hidden bg-white/[0.02]">
            <LoadSparkline points={loadProfile} width={800} height={44} />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-white/20 font-mono px-0.5">
            <span>7d ago</span>
            <span>5d</span>
            <span>3d</span>
            <span>Yesterday</span>
            <span>Now</span>
          </div>
        </div>

        {/* Weather & Context */}
        <div className="p-3 w-[280px] flex flex-col gap-2">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Thermometer className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Weather / Context</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-white/[0.04] text-sky-400 flex-shrink-0">
              {WEATHER_ICONS[weather.icon]}
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-white/80">{weather.condition}</div>
              <div className="text-[10px] text-white/40 font-mono">{weather.tempF}°F · {weather.humidity}% RH</div>
            </div>
          </div>

          <p className="text-[9px] text-white/40 leading-relaxed">{weather.forecast}</p>

          <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-medium ${riskStyle.text} ${riskStyle.bg} ${riskStyle.border}`}>
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span>{weather.riskFactor}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
