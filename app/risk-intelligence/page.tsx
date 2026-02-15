// @ts-nocheck — Risk Intelligence Map: EAGLE-I + NOAA + Fleet Analytics
'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, Zap, Activity, Users, Shield,
  Layers, Map as MapIcon, Cloud, CloudSnow, CloudLightning,
  Wind, Sun, Thermometer, Radio, BarChart3, Clock, TrendingUp,
  TrendingDown, ChevronRight, Eye, Target, Gauge, Moon, SunMedium,
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/lib/theme-context';
import {
  OPCOS, WEATHER_EVENTS, OUTAGE_TREND, IMPACT_CAUSES, FAILURE_MODES,
  generateFleet, generateHeatData, computeAgeDist,
  type SubstationAsset, type WeatherEvent, type OpCo,
} from '@/lib/exelon/risk-intelligence-data';

// ════════════════════════════════════════════════════════════════
// THEME SYSTEM
// ════════════════════════════════════════════════════════════════

type Theme = 'dark' | 'light';

const TILES = {
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
};

const T = (theme: Theme) => {
  const d = theme === 'dark';
  return {
    bg: d ? '#000' : '#f8f9fb', surface: d ? '#0a0a0a' : '#ffffff', headerBg: d ? '#09090b' : '#ffffff',
    card: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    border: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    borderS: d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
    t1: d ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.88)',
    t2: d ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    t3: d ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.45)',
    t4: d ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.3)',
    t5: d ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)',
    popBg: d ? 'rgba(10,10,10,0.95)' : 'rgba(255,255,255,0.97)',
    popBorder: d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    popTitle: d ? '#fff' : '#111', popSub: d ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    popKey: d ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)',
    popVal: d ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
    popDivider: d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    legendBg: d ? 'rgba(10,10,10,0.92)' : 'rgba(255,255,255,0.95)',
    mapBg: d ? '#0a0a0a' : '#f0f0f0',
    accent: d ? 'rgb(34,211,238)' : 'rgb(109,40,217)',
    accentBg: d ? 'rgba(6,182,212,0.1)' : 'rgba(109,40,217,0.08)',
    accentBorder: d ? 'rgba(6,182,212,0.2)' : 'rgba(109,40,217,0.2)',
    hover: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
    activeBtn: d ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    activeBorder: d ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
    barBg: d ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    barTrack: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
    statBg: d ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
    statBorder: d ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)',
    markerText: d ? '#fff' : '#111',
    markerShadow: d ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.15)',
    zoomBg: d ? '#1a1a1a' : '#ffffff', zoomColor: d ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    zoomBorder: d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    zoomHoverBg: d ? '#222' : '#f0f0f0', zoomHoverColor: d ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)',
    scrollThumb: d ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)',
    popShadowAlpha: d ? '0.5' : '0.12',
  };
};

// ════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════

const SEV_COLORS = { severe: 'rgba(244,63,94,0.85)', moderate: 'rgba(245,158,11,0.8)', minor: 'rgba(56,189,248,0.7)' };
const LAYER_IDS = ['outages', 'weather', 'assets', 'load', 'territory'] as const;
type LayerId = typeof LAYER_IDS[number];

const WEATHER_SVG: Record<string, string> = {
  derecho: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>',
  ice: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M20 17.58A5 5 0 0018 8h-1.26A8 8 0 104 16.25"/><line x1="8" y1="16" x2="8.01" y2="16"/><line x1="8" y1="20" x2="8.01" y2="20"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
  hurricane: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2a8 8 0 018 8c0 3.36-2.07 6.24-5 7.42V22l-3-3-3 3v-4.58C6.07 16.24 4 13.36 4 10a8 8 0 018-8z"/></svg>',
  heat: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg>',
  wind: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2"/></svg>',
  tornado: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M21 4H3"/><path d="M18 8H6"/><path d="M19 12H9"/><path d="M16 16H11"/><path d="M13 20h-1"/></svg>',
  thunder: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
};

const WEATHER_ICONS_REACT: Record<string, React.ReactNode> = {
  derecho: <Wind className="w-4 h-4" />, ice: <CloudSnow className="w-4 h-4" />,
  hurricane: <Cloud className="w-4 h-4" />, heat: <Sun className="w-4 h-4" />,
  wind: <Wind className="w-4 h-4" />, tornado: <Activity className="w-4 h-4" />,
  thunder: <CloudLightning className="w-4 h-4" />,
};

// ════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ════════════════════════════════════════════════════════════════

export default function RiskIntelligencePage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const layerGroupsRef = useRef<Record<string, any>>({});
  const [mapReady, setMapReady] = useState(false);
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(new Set(['outages', 'assets']));
  const { theme, isDark, toggle: toggleTheme } = useTheme();

  const c = T(theme);

  const { assets, stats } = useMemo(() => generateFleet(), []);
  const heatData = useMemo(() => generateHeatData(assets), [assets]);
  const ageDist = useMemo(() => computeAgeDist(assets), [assets]);
  const maxOutage = Math.max(...OUTAGE_TREND.map(d => d.count));
  const maxImpact = Math.max(...IMPACT_CAUSES.map(d => d.hours));
  const maxAge = Math.max(...ageDist.map(d => d.count));

  const opcoAssetCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    assets.forEach(a => { counts[a.opco] = (counts[a.opco] || 0) + 1; });
    return counts;
  }, [assets]);

  const loadSparklines = useMemo(() => {
    const rng = (() => { let s = 99; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
    return OPCOS.map(o => {
      const pts = Array.from({ length: 24 }, (_, i) => {
        const base = o.peakMW * 0.55;
        const peak = i >= 14 && i <= 19 ? 1 : i >= 8 && i <= 13 ? 0.85 : 0.6;
        return base + (o.peakMW - base) * peak * (0.9 + rng() * 0.1);
      });
      const max = Math.max(...pts); const min = Math.min(...pts);
      const path = pts.map((p, i) => `${(i / 23) * 100},${100 - ((p - min) / (max - min)) * 100}`).join(' ');
      return { opco: o, path };
    });
  }, []);

  // ─── Helper: rebuild all asset markers with current theme ───
  const rebuildAssets = useCallback((Leaf: any, map: any, groups: any, currentC: ReturnType<typeof T>) => {
    groups.assets.clearLayers();
    const z = map.getZoom();
    const minKv = z < 7 ? 138 : z < 9 ? 34.5 : 0;
    const filtered = assets.filter(a => parseFloat(a.kv) >= minKv);

    filtered.forEach(a => {
      const col = a.health > 75 ? 'rgb(52,211,153)' : a.health > 50 ? 'rgb(251,191,36)' : 'rgb(251,113,133)';
      const bg = a.health > 75 ? 'rgba(52,211,153,0.25)' : a.health > 50 ? 'rgba(245,158,11,0.25)' : 'rgba(244,63,94,0.25)';
      const bdr = a.health > 75 ? 'rgba(52,211,153,0.6)' : a.health > 50 ? 'rgba(245,158,11,0.6)' : 'rgba(244,63,94,0.6)';
      const kvNum = parseFloat(a.kv);
      const baseSize = kvNum >= 345 ? 20 : kvNum >= 138 ? 16 : kvNum >= 69 ? 14 : 12;
      const size = z >= 11 ? baseSize + 4 : z >= 9 ? baseSize + 2 : baseSize;
      const showLabel = z >= 10;

      const icon = Leaf.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2px solid ${bdr};background:${bg};display:flex;align-items:center;justify-content:center;font-size:${size < 14 ? 6 : 8}px;font-weight:700;font-family:monospace;color:${currentC.markerText};box-shadow:0 2px 8px ${currentC.markerShadow};cursor:pointer">${showLabel ? a.health : ''}</div>`,
        iconSize: [size, size], iconAnchor: [size / 2, size / 2],
      });
      const opcoObj = OPCOS.find(o => o.id === a.opco);
      const failureCost = ((a.customers * 0.012 * a.load / 100 * (100 - a.health) / 100) * 100).toFixed(0);
      const m = Leaf.marker([a.lat, a.lng], { icon }).bindPopup(`
        <div style="font-family:'DM Sans',sans-serif">
          <div style="font-size:12px;font-weight:600;color:${currentC.popTitle};margin-bottom:4px">${a.name}</div>
          <div style="font-size:10px;color:${currentC.popSub};margin-bottom:6px">${a.tag} · ${a.opco} · ${opcoObj?.territory || ''}</div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${currentC.popDivider}"><span style="font-size:10px;color:${currentC.popKey}">Health Index</span><span style="font-size:10px;color:${col};font-family:monospace">${a.health}%</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${currentC.popDivider}"><span style="font-size:10px;color:${currentC.popKey}">Age</span><span style="font-size:10px;color:${currentC.popVal};font-family:monospace">${a.age} years</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${currentC.popDivider}"><span style="font-size:10px;color:${currentC.popKey}">Load Factor</span><span style="font-size:10px;color:${currentC.popVal};font-family:monospace">${a.load}%</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${currentC.popDivider}"><span style="font-size:10px;color:${currentC.popKey}">Voltage Class</span><span style="font-size:10px;color:${currentC.popVal};font-family:monospace">${a.kv} kV</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${currentC.popDivider}"><span style="font-size:10px;color:${currentC.popKey}">Customers Served</span><span style="font-size:10px;color:${currentC.popVal};font-family:monospace">${a.customers.toLocaleString()}</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:10px;color:${currentC.popKey}">Failure Impact</span><span style="font-size:10px;color:${a.health < 50 ? 'rgb(251,113,133)' : a.load > 80 ? 'rgb(251,191,36)' : currentC.popVal};font-family:monospace">$${failureCost}K/hr</span></div>
        </div>
      `, { maxWidth: 260 });
      groups.assets.addLayer(m);
    });
  }, [assets]);

  // ─── Helper: rebuild weather popups with current theme ───
  const rebuildWeatherPopups = useCallback((groups: any, currentC: ReturnType<typeof T>) => {
    groups.weather.eachLayer((m: any) => {
      if (!m._evData) return;
      const ev = m._evData;
      m.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif">
          <div style="font-size:12px;font-weight:600;color:${currentC.popTitle};margin-bottom:4px">${ev.title}</div>
          <div style="font-size:10px;color:${currentC.popSub};margin-bottom:6px">${ev.date} · ${ev.opcos.join(', ')}</div>
          <div style="font-size:10px;color:${currentC.popSub};margin-bottom:6px">${ev.desc}</div>
          <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${currentC.popDivider}"><span style="font-size:10px;color:${currentC.popKey}">Customers Affected</span><span style="font-size:10px;color:${currentC.popVal};font-family:monospace">${(ev.outages / 1000).toFixed(0)}K</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:10px;color:${currentC.popKey}">Severity</span><span style="font-size:10px;color:${SEV_COLORS[ev.type]};font-family:monospace">${ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}</span></div>
        </div>
      `, { maxWidth: 280 });
    });
  }, []);

  // ─── Initialize Map ───
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const initC = T('dark');

    const initMap = async () => {
      const L = await import('leaflet');
      leafletRef.current = L.default || L;
      const Leaf = leafletRef.current;

      const container = mapRef.current as HTMLElement & { _leaflet_id?: string };
      if (container?._leaflet_id) { container._leaflet_id = undefined; }

      const map = Leaf.map(mapRef.current, {
        center: [39.3, -76.6], zoom: 10, zoomControl: true, attributionControl: false,
      });

      tileLayerRef.current = Leaf.tileLayer(TILES.dark, { maxZoom: 19 }).addTo(map);
      mapInstanceRef.current = map;

      const groups: Record<string, any> = {};
      LAYER_IDS.forEach(id => { groups[id] = Leaf.layerGroup(); });
      layerGroupsRef.current = groups;

      // Load leaflet.heat
      await new Promise<void>((resolve) => {
        if ((window as any).L?.heatLayer) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
        script.onload = () => resolve(); script.onerror = () => resolve();
        document.head.appendChild(script);
      });

      if ((window as any).L?.heatLayer) {
        const heat = (window as any).L.heatLayer(
          heatData.map((d: number[]) => [d[0], d[1], d[2]]),
          { radius: 30, blur: 22, maxZoom: 11, max: 1.0, minOpacity: 0.15,
            gradient: { 0.15: '#1a1a2e', 0.3: '#3b0764', 0.5: '#7c2d12', 0.7: '#dc2626', 0.9: '#fbbf24' } }
        );
        groups.outages.addLayer(heat);
      }

      // Weather markers
      WEATHER_EVENTS.forEach(ev => {
        const icon = Leaf.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${SEV_COLORS[ev.type]};box-shadow:0 2px 12px rgba(0,0,0,0.5)">${WEATHER_SVG[ev.icon] || WEATHER_SVG.thunder}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        });
        const m = Leaf.marker([ev.lat, ev.lng], { icon });
        m._evData = ev;
        m.bindPopup(`
          <div style="font-family:'DM Sans',sans-serif">
            <div style="font-size:12px;font-weight:600;color:${initC.popTitle};margin-bottom:4px">${ev.title}</div>
            <div style="font-size:10px;color:${initC.popSub};margin-bottom:6px">${ev.date} · ${ev.opcos.join(', ')}</div>
            <div style="font-size:10px;color:${initC.popSub};margin-bottom:6px">${ev.desc}</div>
            <div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid ${initC.popDivider}"><span style="font-size:10px;color:${initC.popKey}">Customers Affected</span><span style="font-size:10px;color:${initC.popVal};font-family:monospace">${(ev.outages / 1000).toFixed(0)}K</span></div>
            <div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:10px;color:${initC.popKey}">Severity</span><span style="font-size:10px;color:${SEV_COLORS[ev.type]};font-family:monospace">${ev.type.charAt(0).toUpperCase() + ev.type.slice(1)}</span></div>
          </div>
        `, { maxWidth: 280 });
        groups.weather.addLayer(m);
      });

      // Initial asset render + zoom handler
      const onZoom = () => { rebuildAssets(Leaf, map, groups, T(theme)); };
      map.on('zoomend', onZoom);
      rebuildAssets(Leaf, map, groups, initC);

      if (activeLayers.has('outages')) groups.outages.addTo(map);
      if (activeLayers.has('assets')) groups.assets.addTo(map);

      setMapReady(true);
    };

    initMap();
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, []);

  // ─── Theme change: swap tiles, re-render assets, rebind popups ───
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current || !leafletRef.current) return;
    const Leaf = leafletRef.current;
    const map = mapInstanceRef.current;
    const groups = layerGroupsRef.current;
    const currentC = T(theme);

    map.removeLayer(tileLayerRef.current);
    tileLayerRef.current = Leaf.tileLayer(TILES[theme], { maxZoom: 19 }).addTo(map);

    rebuildAssets(Leaf, map, groups, currentC);
    rebuildWeatherPopups(groups, currentC);
  }, [theme, rebuildAssets, rebuildWeatherPopups]);

  const toggleLayer = useCallback((id: LayerId) => {
    const map = mapInstanceRef.current;
    const groups = layerGroupsRef.current;
    if (!map || !groups[id]) return;
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); map.removeLayer(groups[id]); }
      else { next.add(id); groups[id].addTo(map); }
      return next;
    });
  }, []);

  const flyTo = useCallback((lat: number, lng: number, zoom = 10) => {
    mapInstanceRef.current?.setView([lat, lng], zoom);
  }, []);

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════

  return (
    <div className="h-screen flex flex-col overflow-hidden transition-colors duration-300"
      style={{ background: c.bg, color: c.t1, fontFamily: "'DM Sans', -apple-system, sans-serif" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 flex-shrink-0 z-50 transition-colors duration-300"
        style={{ borderBottom: `1px solid ${c.border}`, background: c.headerBg }}>
        <div className="flex items-center gap-3">
          <Link href="/" style={{ color: c.t4 }}><ArrowLeft className="w-4 h-4" /></Link>
          <span style={{ color: c.borderS }}>|</span>
          <h1 className="text-sm font-semibold" style={{ color: c.t2 }}>Risk Intelligence Map</h1>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold"
            style={{ background: c.accentBg, color: c.accent, border: `1px solid ${c.accentBorder}` }}>
            EAGLE-I + NOAA
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-[9px] px-2 py-1 rounded flex items-center gap-1"
            style={{ color: c.t4, border: `1px solid ${c.border}` }}>
            <BarChart3 className="w-2.5 h-2.5" />ORNL EAGLE-I 2014–2024
          </span>

          {/* Theme Toggle */}
          <button onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-300"
            style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(139,92,246,0.2)'}`,
              color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(109,40,217,0.8)',
            }}>
            {isDark ? <SunMedium className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
            {isDark ? 'Light' : 'Dark'}
          </button>

          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
            <span className="text-[10px]" style={{ color: c.t4 }}>SCADA Live</span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ─── Left Panel ─── */}
        <div className="w-[340px] flex flex-col flex-shrink-0 overflow-hidden transition-colors duration-300"
          style={{ borderRight: `1px solid ${c.border}`, background: c.surface }}>
          <div className="flex-1 overflow-y-auto scrollbar-thin">

            <Section c={c} icon={<AlertTriangle className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Risk Summary" right="2014–2024">
              <div className="grid grid-cols-2 gap-2">
                <StatCard c={c} label="Fleet Size" value={stats.totalReal.toLocaleString()} color="rgb(34,211,238)" sub={`${stats.total} shown (${stats.sampleRatio})`} />
                <StatCard c={c} label="Avg Age" value={`${stats.avgAge}yr`} color="rgb(251,191,36)" sub={`range: 1–${Math.max(...assets.map(a => a.age))} years`} />
                <StatCard c={c} label="Avg Health Idx" value={`${stats.avgHealth}%`} color={stats.avgHealth > 65 ? 'rgb(52,211,153)' : 'rgb(251,191,36)'} sub="fleet-wide average" />
                <StatCard c={c} label="Poor / V. Poor" value={`${stats.pctPoor}%`} color="rgb(251,113,133)" sub={`${assets.filter(a => a.health < 40).length} units flagged`} />
                <StatCard c={c} label="Total Outages" value="14,283" color="rgb(251,113,133)" sub="↑ 12% vs 2019–2022" subUp />
                <StatCard c={c} label="Weather-Driven" value="68%" color="rgb(56,189,248)" sub="↑ 5pp since 2020" subUp />
                <StatCard c={c} label="Avg Restoration" value="4.2h" color="rgb(251,191,36)" sub="↓ 28% since 2017" subDown />
                <StatCard c={c} label=">40 Years Old" value={`${stats.pctOver40}%`} color="rgb(251,146,60)" sub="per ICC filing: 35%" />
              </div>
            </Section>

            <Section c={c} icon={<Layers className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Map Layers">
              <div className="flex flex-col gap-1">
                <LayerBtn c={c} icon={<Zap className="w-3.5 h-3.5" />} iconBg="rgba(244,63,94,0.15)" iconColor="rgb(251,113,133)"
                  name="Historical Outages" desc="EAGLE-I county-level 15-min intervals" active={activeLayers.has('outages')} onClick={() => toggleLayer('outages')} />
                <LayerBtn c={c} icon={<Cloud className="w-3.5 h-3.5" />} iconBg="rgba(14,165,233,0.12)" iconColor="rgb(56,189,248)"
                  name="Weather Events" desc="NOAA storms, derechos, ice storms" active={activeLayers.has('weather')} onClick={() => toggleLayer('weather')} />
                <LayerBtn c={c} icon={<Sun className="w-3.5 h-3.5" />} iconBg="rgba(245,158,11,0.15)" iconColor="rgb(251,191,36)"
                  name="Transformer Assets" desc="Age, health index, load factor" active={activeLayers.has('assets')} onClick={() => toggleLayer('assets')} />
              </div>
            </Section>

            <Section c={c} icon={<Users className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="OpCo Risk Ranking">
              <div className="flex flex-col gap-0.5">
                {OPCOS.map(o => (
                  <button key={o.id} onClick={() => flyTo(o.center[0], o.center[1], o.id === 'ComEd' ? 9 : 10)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-colors w-full text-left group"
                    onMouseEnter={e => (e.currentTarget.style.background = c.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: o.color }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[11px]" style={{ color: c.t2 }}>{o.name}</span>
                      <span className="text-[9px] ml-1" style={{ color: c.t4 }}>{opcoAssetCounts[o.id] || 0} subs</span>
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: c.t4 }}>{(o.customers / 1e6).toFixed(1)}M</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold" style={{ background: o.riskBg, color: o.riskColor }}>{o.riskLabel}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section c={c} icon={<CloudSnow className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Major Weather Events" right="Last 10 yrs">
              <div className="flex flex-col gap-1.5">
                {WEATHER_EVENTS.slice(0, 8).map(ev => (
                  <button key={ev.id} onClick={() => flyTo(ev.lat, ev.lng, 10)}
                    className="flex gap-2 px-2 py-1.5 rounded-md transition-colors w-full text-left"
                    style={{ borderLeft: `2px solid ${ev.type === 'severe' ? 'rgb(251,113,133)' : ev.type === 'moderate' ? 'rgb(251,191,36)' : 'rgb(56,189,248)'}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = c.hover)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <div className="flex-shrink-0 mt-0.5" style={{ color: ev.type === 'severe' ? 'rgb(251,113,133)' : ev.type === 'moderate' ? 'rgb(251,191,36)' : 'rgb(56,189,248)' }}>
                      {WEATHER_ICONS_REACT[ev.icon] || <CloudLightning className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium" style={{ color: c.t2 }}>{ev.title}</div>
                      <div className="text-[9px] mt-0.5" style={{ color: c.t4 }}>{ev.date} · {ev.opcos.join(', ')}</div>
                      <div className="text-[9px] font-medium mt-0.5" style={{ color: ev.type === 'severe' ? 'rgba(251,113,133,0.7)' : ev.type === 'moderate' ? 'rgba(251,191,36,0.6)' : 'rgba(56,189,248,0.6)' }}>
                        {(ev.outages / 1000).toFixed(0)}K customers affected
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Section>
          </div>
        </div>

        {/* ─── Map ─── */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          <div className="absolute bottom-5 left-5 z-[1000] rounded-lg p-3 backdrop-blur-xl transition-colors duration-300"
            style={{ background: c.legendBg, border: `1px solid ${c.border}` }}>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: c.t3 }}>Outage Density (events/yr)</h4>
            <div className="w-32 h-2 rounded" style={{ background: 'linear-gradient(to right,#1a1a2e,#3b0764,#7c2d12,#dc2626,#fbbf24)' }} />
            <div className="flex justify-between mt-1"><span className="text-[10px]" style={{ color: c.t3 }}>Low</span><span className="text-[10px]" style={{ color: c.t3 }}>Critical</span></div>
            <div className="mt-2.5">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: c.t3 }}>Substation Health (n={stats.total})</h4>
              <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-400" /><span className="text-[10px]" style={{ color: c.t3 }}>Good (&gt;75%)</span></div>
              <div className="flex items-center gap-2 mb-1"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="text-[10px]" style={{ color: c.t3 }}>Fair (50–75%)</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-rose-400" /><span className="text-[10px]" style={{ color: c.t3 }}>Critical (&lt;50%)</span></div>
              <p className="text-[8px] mt-1.5 leading-relaxed" style={{ color: c.t5 }}>Fleet: 6,230 transformers · Showing 1:10.5 sample<br/>Marker size ∝ voltage class · Labels at zoom ≥10</p>
            </div>
          </div>
        </div>

        {/* ─── Right Panel ─── */}
        <div className="w-[320px] flex flex-col flex-shrink-0 overflow-hidden transition-colors duration-300"
          style={{ borderLeft: `1px solid ${c.border}`, background: c.surface }}>
          <div className="flex-1 overflow-y-auto scrollbar-thin">

            <Section c={c} icon={<Activity className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Outage Trend" right="Annual">
              <div className="flex items-end gap-0.5 h-12">
                {OUTAGE_TREND.map(d => (
                  <div key={d.yr} className="flex-1 rounded-t relative group cursor-pointer" style={{ height: `${(d.count / maxOutage) * 100}%`, background: c.barBg }}>
                    <div className="absolute bottom-0 w-full rounded-t" style={{ height: `${(d.weather / d.count) * 100}%`, background: 'rgba(244,63,94,0.35)' }} />
                    <div className="hidden group-hover:block absolute bottom-[calc(100%+4px)] left-1/2 -translate-x-1/2 rounded px-1.5 py-1 text-[9px] whitespace-nowrap z-10"
                      style={{ background: c.surface, border: `1px solid ${c.border}`, color: c.t2 }}>
                      {d.yr}: {d.count.toLocaleString()} total · {d.weather.toLocaleString()} weather
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                {['2014','2016','2018','2020','2022','2024'].map(y => <span key={y} className="text-[8px]" style={{ color: c.t5 }}>{y}</span>)}
              </div>
            </Section>

            <Section c={c} icon={<BarChart3 className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Impact by Cause">
              <div className="flex flex-col gap-1.5">
                {IMPACT_CAUSES.map(d => (
                  <div key={d.cause} className="flex items-center gap-2">
                    <span className="text-[10px] w-[72px] text-right flex-shrink-0" style={{ color: c.t3 }}>{d.cause}</span>
                    <div className="flex-1 h-4 rounded overflow-hidden" style={{ background: c.barTrack }}>
                      <div className="h-full rounded flex items-center justify-end pr-1.5 transition-all duration-700"
                        style={{ width: `${(d.hours / maxImpact) * 100}%`, background: d.color }}>
                        <span className="text-[9px] font-mono text-white/90">{(d.hours / 1e6).toFixed(1)}M</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section c={c} icon={<Target className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Failure Modes">
              <div className="flex flex-col gap-1">
                {FAILURE_MODES.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[10px] flex-1" style={{ color: c.t3 }}>{d.name}</span>
                    <span className="text-[10px] font-mono" style={{ color: c.t2 }}>{d.pct}%</span>
                    <div className="w-12 h-1 rounded overflow-hidden" style={{ background: c.barTrack }}>
                      <div className="h-full rounded" style={{ width: `${(d.pct / 28) * 100}%`, background: d.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section c={c} icon={<Clock className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Asset Age Distribution">
              <div className="flex flex-col gap-1">
                {ageDist.map(d => (
                  <div key={d.range} className="flex items-center gap-1.5">
                    <span className="text-[9px] w-14 text-right flex-shrink-0" style={{ color: c.t4 }}>{d.range}</span>
                    <div className="flex-1 h-2.5 rounded overflow-hidden" style={{ background: c.barTrack }}>
                      <div className="h-full rounded" style={{ width: `${(d.count / maxAge) * 100}%`, background: d.color }} />
                    </div>
                    <span className="text-[9px] font-mono w-6" style={{ color: c.t4 }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </Section>

            <Section c={c} icon={<Gauge className="w-3.5 h-3.5" style={{ color: c.t3 }} />} title="Peak Load by OpCo" right="MW">
              <div className="flex flex-col gap-1.5">
                {loadSparklines.map(({ opco, path }) => (
                  <div key={opco.id} className="flex items-center gap-2">
                    <span className="text-[10px] w-[50px] flex-shrink-0" style={{ color: opco.color }}>{opco.id}</span>
                    <svg className="flex-1 h-5" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline points={path} fill="none" stroke={opco.color} strokeWidth="2" opacity="0.6" />
                    </svg>
                    <span className="text-[10px] font-mono w-11 text-right" style={{ color: c.t2 }}>{(opco.peakMW / 1000).toFixed(1)}GW</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* Dynamic styles */}
      <style jsx global>{`
        .leaflet-container { background: ${c.mapBg} !important; }
        .leaflet-control-zoom a { background: ${c.zoomBg} !important; color: ${c.zoomColor} !important; border-color: ${c.zoomBorder} !important; }
        .leaflet-control-zoom a:hover { background: ${c.zoomHoverBg} !important; color: ${c.zoomHoverColor} !important; }
        .leaflet-control-attribution { display: none !important; }
        .leaflet-popup-content-wrapper { background: ${c.popBg} !important; border: 1px solid ${c.popBorder} !important; border-radius: 8px !important; color: ${c.t1} !important; box-shadow: 0 8px 32px rgba(0,0,0,${c.popShadowAlpha}) !important; }
        .leaflet-popup-tip { background: ${c.popBg} !important; border: 1px solid ${c.popBorder} !important; }
        .leaflet-popup-content { margin: 12px 14px !important; font-size: 11px !important; line-height: 1.5 !important; }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: ${c.scrollThumb}; border-radius: 2px; }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

function Section({ c, icon, title, right, children }: { c: ReturnType<typeof T>; icon: React.ReactNode; title: string; right?: string; children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: `1px solid ${c.borderS}` }}>
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5" style={{ color: c.t2 }}>{icon}{title}</h3>
        {right && <span className="text-[10px]" style={{ color: c.t4 }}>{right}</span>}
      </div>
      <div className="px-3.5 pb-3">{children}</div>
    </div>
  );
}

function StatCard({ c, label, value, color, sub, subUp, subDown }: { c: ReturnType<typeof T>; label: string; value: string; color: string; sub: string; subUp?: boolean; subDown?: boolean }) {
  return (
    <div className="rounded-md p-2.5 transition-colors duration-300" style={{ background: c.statBg, border: `1px solid ${c.statBorder}` }}>
      <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: c.t4 }}>{label}</div>
      <div className="text-lg font-semibold font-mono" style={{ color }}>{value}</div>
      <div className="text-[9px] mt-0.5 flex items-center gap-1" style={{ color: subUp ? 'rgba(251,113,133,0.7)' : subDown ? 'rgba(52,211,153,0.7)' : c.t4 }}>{sub}</div>
    </div>
  );
}

function LayerBtn({ c, icon, iconBg, iconColor, name, desc, active, onClick }: {
  c: ReturnType<typeof T>; icon: React.ReactNode; iconBg: string; iconColor: string; name: string; desc: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all w-full text-left"
      style={{ background: active ? c.activeBtn : 'transparent', border: `1px solid ${active ? c.activeBorder : 'transparent'}` }}>
      <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-medium" style={{ color: c.t2 }}>{name}</div>
        <div className="text-[9px]" style={{ color: c.t4 }}>{desc}</div>
      </div>
      <div className="w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 transition-all"
        style={{ border: `1.5px solid ${active ? c.accent : c.t4}`, background: active ? c.accentBg : 'transparent' }}>
        {active && <span className="text-[9px]" style={{ color: c.accent }}>✓</span>}
      </div>
    </button>
  );
}
