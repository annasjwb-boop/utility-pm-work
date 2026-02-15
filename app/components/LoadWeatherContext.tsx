// @ts-nocheck — Load Signal + Weather Context panel for Grid IQ views
'use client';

import { useMemo } from 'react';
import {
  Thermometer, Cloud, CloudRain, CloudSnow, CloudLightning,
  Sun, Wind, Zap, TrendingUp, TrendingDown, AlertTriangle,
  Gauge, Clock, Activity, Droplets, RotateCcw, Flame, ShieldAlert,
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

// ── Types ──
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

interface LoadStressMetrics {
  thermalCycles7d: number;
  maxSwingAmplitude: number;
  overloadEvents12mo: number;
  overloadHours12mo: number;
  lossOfLifeFactor: number;
  loadFactor: number;
  hotspotRiseC: number;
  emergencyLoadEvents: number;
}

interface EnvironmentalExposure {
  installationType: string;
  freezeThawCycles12mo: number;
  highHumidityHours12mo: number;
  extremeHeatDays12mo: number;
  lightningEvents12mo: number;
  tempSwingRange12mo: number;
  precipitationDays12mo: number;
  windLoadEvents12mo: number;
  corrosionIndex: string;
  uvExposureRating: string;
}

// ── Generators ──

function generateLoadProfile(baseLoad: number, seed: number): LoadPoint[] {
  const rng = seededRng(seed);
  const points: LoadPoint[] = [];
  for (let h = 0; h < 168; h++) {
    const dayHour = h % 24;
    const dayOfWeek = Math.floor(h / 24);
    const isWeekend = dayOfWeek >= 5;
    let diurnal = 0.6;
    if (dayHour >= 6 && dayHour < 9) diurnal = 0.6 + (dayHour - 6) * 0.1;
    else if (dayHour >= 9 && dayHour < 12) diurnal = 0.9 + rng() * 0.05;
    else if (dayHour >= 12 && dayHour < 17) diurnal = 0.95 + rng() * 0.08;
    else if (dayHour >= 17 && dayHour < 21) diurnal = 0.85 + rng() * 0.05;
    else if (dayHour >= 21) diurnal = 0.7 - (dayHour - 21) * 0.03;
    if (isWeekend) diurnal *= 0.85;
    const noise = (rng() - 0.5) * 0.06;
    const spike = rng() > 0.97 ? 0.1 + rng() * 0.08 : 0;
    const loadPct = Math.min(105, Math.max(30, baseLoad * diurnal + noise * baseLoad + spike * baseLoad));
    const isPeak = loadPct > baseLoad * 0.95;
    points.push({ hour: h, load: Math.round(loadPct * 10) / 10, peak: isPeak });
  }
  return points;
}

function generateLoadStress(loadProfile: LoadPoint[], baseLoad: number, health: number, age: number, seed: number): LoadStressMetrics {
  const rng = seededRng(seed + 3333);
  const threshold = 70;
  let cycles = 0;
  let wasAbove = loadProfile[0].load > threshold;
  for (let i = 1; i < loadProfile.length; i++) {
    const isAbove = loadProfile[i].load > threshold;
    if (isAbove && !wasAbove) cycles++;
    wasAbove = isAbove;
  }
  let maxSwing = 0;
  for (let i = 1; i < loadProfile.length; i++) {
    maxSwing = Math.max(maxSwing, Math.abs(loadProfile[i].load - loadProfile[i - 1].load));
  }
  const overloadFactor = (100 - health) / 50;
  const overloadEvents12mo = Math.floor((8 + rng() * 12) * overloadFactor);
  const overloadHours12mo = Math.floor(overloadEvents12mo * (2 + rng() * 6));
  const emergencyLoadEvents = Math.floor(overloadEvents12mo * (0.15 + rng() * 0.2));
  const avgLoad = loadProfile.reduce((s, p) => s + p.load, 0) / loadProfile.length;
  const peakLoad = Math.max(...loadProfile.map(p => p.load));
  const loadFactor = Math.round(avgLoad / peakLoad * 100) / 100;
  const hotspotRiseC = Math.round((55 * (avgLoad / 100) ** 1.6 + rng() * 5) * 10) / 10;
  const ageFactor = Math.min(2.5, 1 + (age - 25) * 0.03);
  const loadAgingFactor = avgLoad > 80 ? Math.pow(2, (hotspotRiseC - 55) / 6) : 1.0;
  const lossOfLifeFactor = Math.round(Math.max(0.5, ageFactor * loadAgingFactor) * 100) / 100;
  return { thermalCycles7d: cycles, maxSwingAmplitude: Math.round(maxSwing * 10) / 10, overloadEvents12mo, overloadHours12mo, lossOfLifeFactor, loadFactor, hotspotRiseC, emergencyLoadEvents };
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
  const idx = health < 40 ? [0, 2, 4][Math.floor(rng() * 3)] : health < 60 ? [3, 5, 1][Math.floor(rng() * 3)] : Math.floor(rng() * conditions.length);
  return conditions[idx];
}

function generateEnvironmentalExposure(seed: number, health: number, age: number, kv: string, weather: WeatherContext): EnvironmentalExposure {
  const rng = seededRng(seed + 7777);
  const kvNum = parseInt(kv) || 69;
  const installationType = kvNum >= 115 ? 'Outdoor substation' : kvNum >= 34 ? 'Pad-mount (enclosed)' : rng() > 0.5 ? 'Pad-mount (enclosed)' : 'Vault (underground)';
  const isOutdoor = installationType.includes('Outdoor');
  const isVault = installationType.includes('Vault');
  const baseFT = isOutdoor ? 45 + Math.floor(rng() * 30) : isVault ? 5 + Math.floor(rng() * 10) : 20 + Math.floor(rng() * 15);
  const freezeThawCycles12mo = Math.floor(baseFT * (1 + (age - 20) * 0.005));
  const baseHumidity = isVault ? 2800 + Math.floor(rng() * 1200) : isOutdoor ? 1200 + Math.floor(rng() * 800) : 600 + Math.floor(rng() * 500);
  const highHumidityHours12mo = Math.floor(baseHumidity * (1 + (100 - health) * 0.005));
  const extremeHeatDays12mo = isOutdoor ? 25 + Math.floor(rng() * 30) : isVault ? 5 + Math.floor(rng() * 8) : 12 + Math.floor(rng() * 15);
  const lightningBase = isOutdoor ? 3 + Math.floor(rng() * 8) : isVault ? 0 : Math.floor(rng() * 2);
  const lightningEvents12mo = weather.icon === 'storm' ? lightningBase + 2 : lightningBase;
  const tempSwingRange12mo = isOutdoor ? 95 + Math.floor(rng() * 25) : isVault ? 35 + Math.floor(rng() * 15) : 65 + Math.floor(rng() * 20);
  const precipitationDays12mo = isOutdoor ? 85 + Math.floor(rng() * 40) : isVault ? 0 : 30 + Math.floor(rng() * 20);
  const windLoadEvents12mo = isOutdoor ? 8 + Math.floor(rng() * 15) : 0;
  const corrosionScore = (highHumidityHours12mo / 4000) + (age / 80) + (isOutdoor ? 0.3 : isVault ? 0.4 : 0.1);
  const corrosionIndex = corrosionScore > 1.2 ? 'High' : corrosionScore > 0.8 ? 'Elevated' : corrosionScore > 0.4 ? 'Moderate' : 'Low';
  const uvExposureRating = !isOutdoor ? 'Minimal' : age > 35 ? 'Severe' : age > 20 ? 'High' : 'Moderate';
  return { installationType, freezeThawCycles12mo, highHumidityHours12mo, extremeHeatDays12mo, lightningEvents12mo, tempSwingRange12mo, precipitationDays12mo, windLoadEvents12mo, corrosionIndex, uvExposureRating };
}

// ── UI Helpers ──
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

function LoadSparkline({ points, width = 320, height = 48 }: { points: LoadPoint[]; width?: number; height?: number }) {
  const maxLoad = Math.max(...points.map(p => p.load));
  const minLoad = Math.min(...points.map(p => p.load));
  const range = maxLoad - minLoad || 1;
  const pathD = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.load - minLoad) / range) * (height - 4) - 2;
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const areaD = pathD + ` L ${width},${height} L 0,${height} Z`;
  const peakRects: React.ReactNode[] = [];
  let inPeak = false, peakStart = 0;
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

/** Stacked label/value stat — label on top, value below. Works at any container width. */
function WarnStat({ label, value, unit, threshold, above = true }: { label: string; value: number; unit?: string; threshold: number; above?: boolean }) {
  const isWarn = above ? value >= threshold : value <= threshold;
  const display = typeof value === 'number' && value >= 1000 ? value.toLocaleString() : value;
  return (
    <div className="min-w-0">
      <div className="text-[7px] text-white/25 uppercase tracking-wide leading-tight truncate">{label}</div>
      <div className={`text-[10px] font-mono font-medium leading-tight ${isWarn ? 'text-rose-400' : 'text-white/55'}`}>{display}{unit || ''}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// EXPORTED COMPONENT
// ══════════════════════════════════════════════════════════════

interface ContextPanelProps {
  assetTag?: string;
  baseLoad?: number;
  health?: number;
  age?: number;
  kv?: string;
}

export function LoadWeatherContext({ assetTag = 'default', baseLoad = 75, health = 50, age = 30, kv = '138' }: ContextPanelProps) {
  const seed = tagToSeed(assetTag);

  const loadProfile = useMemo(() => generateLoadProfile(baseLoad, seed), [baseLoad, seed]);
  const weather = useMemo(() => generateWeather(seed, health), [seed, health]);
  const loadStress = useMemo(() => generateLoadStress(loadProfile, baseLoad, health, age, seed), [loadProfile, baseLoad, health, age, seed]);
  const envExposure = useMemo(() => generateEnvironmentalExposure(seed, health, age, kv, weather), [seed, health, age, kv, weather]);
  const riskStyle = RISK_COLORS[weather.riskLevel];

  const last24h = loadProfile.slice(-24);
  const currentLoad = last24h[last24h.length - 1].load;
  const avgLoad = Math.round(last24h.reduce((s, p) => s + p.load, 0) / last24h.length * 10) / 10;
  const peakLoad = Math.round(Math.max(...last24h.map(p => p.load)) * 10) / 10;
  const peakHours = last24h.filter(p => p.peak).length;

  const corrosionColors: Record<string, string> = { Low: 'text-emerald-400', Moderate: 'text-white/55', Elevated: 'text-amber-400', High: 'text-rose-400' };
  const uvColors: Record<string, string> = { Minimal: 'text-emerald-400', Moderate: 'text-white/55', High: 'text-amber-400', Severe: 'text-rose-400' };

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.015] mb-4 overflow-hidden">
      {/* ═══ Top row: sparkline + weather ═══ */}
      <div className="grid grid-cols-[1fr_auto] divide-x divide-white/5">

        {/* Load Signal */}
        <div className="p-3 pb-2">
          <div className="flex items-center gap-1.5 mb-2">
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Load Signal — 7 Day</span>
          </div>
          <div className="rounded overflow-hidden bg-white/[0.02]">
            <LoadSparkline points={loadProfile} width={800} height={44} />
          </div>
          <div className="flex justify-between mt-1 text-[8px] text-white/20 font-mono px-0.5">
            <span>7d ago</span><span>5d</span><span>3d</span><span>Yesterday</span><span>Now</span>
          </div>
        </div>

        {/* Weather */}
        <div className="p-3 pb-2 w-[260px] flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Thermometer className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Weather / Context</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-white/[0.04] text-sky-400 flex-shrink-0">
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

      {/* ═══ Stats strip — full width ═══ */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t border-white/[0.04] text-[10px]">
        <span className="text-white/30">Now: <span className="text-white/70 font-mono font-medium">{currentLoad}%</span></span>
        <span className="text-white/30">24h Avg: <span className="text-white/70 font-mono">{avgLoad}%</span></span>
        <span className="text-white/30">24h Peak: <span className={`font-mono font-medium ${peakLoad > 90 ? 'text-rose-400' : peakLoad > 80 ? 'text-amber-400' : 'text-white/70'}`}>{peakLoad}%</span></span>
        {peakHours > 0 && <span className="text-rose-400/60 text-[9px]">⚠ {peakHours}h at peak</span>}
      </div>

      {/* ═══ Bottom row: stress metrics + exposure ═══ */}
      <div className="grid grid-cols-[1fr_auto] divide-x divide-white/5 border-t border-white/[0.04]">

        {/* Load Stress */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-1 mb-1.5">
            <Gauge className="w-3 h-3 text-violet-400/50" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/25">Lifetime Load Stress</span>
          </div>
          <div className="grid grid-cols-4 gap-x-3 gap-y-1.5">
            <WarnStat label="Thermal cycles (7d)" value={loadStress.thermalCycles7d} threshold={14} />
            <WarnStat label="Max swing" value={loadStress.maxSwingAmplitude} unit="%" threshold={15} />
            <WarnStat label="Load factor" value={loadStress.loadFactor} threshold={0.6} above={false} />
            <WarnStat label="Hotspot rise" value={loadStress.hotspotRiseC} unit="°C" threshold={55} />
            <WarnStat label="Overloads (12 mo)" value={loadStress.overloadEvents12mo} threshold={12} />
            <WarnStat label="Overload hours" value={loadStress.overloadHours12mo} unit="h" threshold={40} />
            <WarnStat label="Emergency loads" value={loadStress.emergencyLoadEvents} threshold={3} />
            <div className="min-w-0">
              <div className="text-[7px] text-white/25 uppercase tracking-wide leading-tight">IEEE aging</div>
              <div className={`text-[10px] font-mono font-bold leading-tight ${
                loadStress.lossOfLifeFactor > 2 ? 'text-rose-400' : loadStress.lossOfLifeFactor > 1.5 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{loadStress.lossOfLifeFactor}×</div>
            </div>
          </div>
        </div>

        {/* Environmental Exposure */}
        <div className="px-3 py-2 w-[260px]">
          <div className="flex items-center gap-1 mb-1.5">
            <ShieldAlert className="w-3 h-3 text-sky-400/50" />
            <span className="text-[8px] font-bold uppercase tracking-widest text-white/25">12-Month Exposure</span>
          </div>
          <div className="flex items-center gap-1 mb-1.5">
            <span className="text-[7px] text-white/25 uppercase tracking-wide">Install</span>
            <span className="text-[9px] font-medium text-white/60">{envExposure.installationType}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <WarnStat label="Freeze-thaw" value={envExposure.freezeThawCycles12mo} unit=" cyc" threshold={60} />
            <WarnStat label="Temp range" value={envExposure.tempSwingRange12mo} unit="°F" threshold={100} />
            <WarnStat label="High RH hrs" value={envExposure.highHumidityHours12mo} unit="h" threshold={2000} />
            <WarnStat label="Extreme heat" value={envExposure.extremeHeatDays12mo} unit="d" threshold={35} />
            <WarnStat label="Lightning" value={envExposure.lightningEvents12mo} unit=" events" threshold={5} />
            <WarnStat label="Precip days" value={envExposure.precipitationDays12mo} unit="d" threshold={100} />
            <WarnStat label="Wind loads" value={envExposure.windLoadEvents12mo} unit=" events" threshold={12} />
            <div className="min-w-0">
              <div className="text-[7px] text-white/25 uppercase tracking-wide leading-tight">Corrosion</div>
              <div className={`text-[10px] font-mono font-medium leading-tight ${corrosionColors[envExposure.corrosionIndex] || 'text-white/55'}`}>{envExposure.corrosionIndex}</div>
            </div>
          </div>
          <div className="mt-1.5">
            <div className="text-[7px] text-white/25 uppercase tracking-wide leading-tight">UV exposure</div>
            <div className={`text-[10px] font-mono font-medium leading-tight ${uvColors[envExposure.uvExposureRating] || 'text-white/55'}`}>{envExposure.uvExposureRating}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
