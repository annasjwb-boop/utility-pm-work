// @ts-nocheck — Per-asset Grid IQ diagnostic view
'use client';

import { useState, useEffect, useCallback, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Activity, Zap, Shield, Thermometer, Eye,
  FlaskConical, FileText, ClipboardList, Building, ChevronRight,
  AlertTriangle, TrendingDown, Clock, Brain, CheckCircle,
  Users, Wrench, Calendar, BadgeCheck, RefreshCw, Sparkles,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { getSubstationAsset, synthesizeDiagnostic, synthesizeScenario, type AssetDiagnostic } from '@/lib/exelon/asset-bridge';
import { OPCOS } from '@/lib/exelon/risk-intelligence-data';
import { LoadWeatherContext } from '@/app/components/LoadWeatherContext';
import type { DemoScenario, DecisionSupport, DecisionOption } from '@/lib/demo-scenarios';

// ── Icon map (string → component) ──
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  FlaskConical, Thermometer, Activity, Zap, FileText, Eye, ClipboardList, Building,
};

// ── Agent registry (same as main grid-iq) ──
const AGENTS: Record<string, { shortName: string; icon: React.ReactNode; color: string; borderColor: string; bgColor: string; dotColor: string }> = {
  dga: { shortName: 'DGA', icon: <FlaskConical className="w-3.5 h-3.5" />, color: 'text-amber-400', borderColor: 'border-amber-500/20', bgColor: 'bg-amber-500/[0.06]', dotColor: 'rgba(251,191,36,0.5)' },
  thermal: { shortName: 'Thermal', icon: <Thermometer className="w-3.5 h-3.5" />, color: 'text-rose-400', borderColor: 'border-rose-500/20', bgColor: 'bg-rose-500/[0.06]', dotColor: 'rgba(251,113,133,0.5)' },
  load: { shortName: 'Load', icon: <Activity className="w-3.5 h-3.5" />, color: 'text-sky-400', borderColor: 'border-sky-500/20', bgColor: 'bg-sky-500/[0.06]', dotColor: 'rgba(56,189,248,0.5)' },
  fleet: { shortName: 'Fleet', icon: <Building className="w-3.5 h-3.5" />, color: 'text-blue-400', borderColor: 'border-blue-500/20', bgColor: 'bg-blue-500/[0.06]', dotColor: 'rgba(96,165,250,0.5)' },
  oem: { shortName: 'OEM', icon: <FileText className="w-3.5 h-3.5" />, color: 'text-cyan-400', borderColor: 'border-cyan-500/20', bgColor: 'bg-cyan-500/[0.06]', dotColor: 'rgba(34,211,238,0.5)' },
  electrical: { shortName: 'Elec. Test', icon: <Zap className="w-3.5 h-3.5" />, color: 'text-fuchsia-400', borderColor: 'border-fuchsia-500/20', bgColor: 'bg-fuchsia-500/[0.06]', dotColor: 'rgba(232,121,249,0.5)' },
  history: { shortName: 'History', icon: <ClipboardList className="w-3.5 h-3.5" />, color: 'text-violet-400', borderColor: 'border-violet-500/20', bgColor: 'bg-violet-500/[0.06]', dotColor: 'rgba(167,139,250,0.5)' },
  inspection: { shortName: 'Inspect', icon: <Eye className="w-3.5 h-3.5" />, color: 'text-emerald-400', borderColor: 'border-emerald-500/20', bgColor: 'bg-emerald-500/[0.06]', dotColor: 'rgba(52,211,153,0.5)' },
  condition: { shortName: 'Condition', icon: <Activity className="w-3.5 h-3.5" />, color: 'text-lime-400', borderColor: 'border-lime-500/20', bgColor: 'bg-lime-500/[0.06]', dotColor: 'rgba(163,230,53,0.5)' },
};

const TRIGGER_COLORS: Record<string, string> = {
  amber: 'text-amber-400 border-amber-500/20 bg-amber-500/[0.06]',
  rose: 'text-rose-400 border-rose-500/20 bg-rose-500/[0.06]',
  blue: 'text-blue-400 border-blue-500/20 bg-blue-500/[0.06]',
  cyan: 'text-cyan-400 border-cyan-500/20 bg-cyan-500/[0.06]',
  violet: 'text-violet-400 border-violet-500/20 bg-violet-500/[0.06]',
  emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/[0.06]',
  sky: 'text-sky-400 border-sky-500/20 bg-sky-500/[0.06]',
  fuchsia: 'text-fuchsia-400 border-fuchsia-500/20 bg-fuchsia-500/[0.06]',
  lime: 'text-lime-400 border-lime-500/20 bg-lime-500/[0.06]',
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  aging_asset: { label: 'Aging Asset', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30' },
  dga_alert: { label: 'DGA Alert', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  avoided_outage: { label: 'Outage Prevention', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
};

// ── SVG helpers ──
function AnimatedPath({ d, id, visible, color = 'rgba(255,255,255,0.12)', width = 1.5, delay = 0, dash = false }: {
  d: string; id?: string; visible: boolean; color?: string; width?: number; delay?: number; dash?: boolean;
}) {
  return (
    <path id={id} d={d} fill="none" stroke={color} strokeWidth={width}
      strokeDasharray={dash ? '6,4' : 'none'}
      style={{ opacity: visible ? 1 : 0, transition: `opacity 600ms ease ${delay}ms` }} />
  );
}

function PulseDot({ pathId, dur = 3, delay = 0, color = 'rgba(255,255,255,0.4)' }: {
  pathId: string; dur?: number; delay?: number; color?: string;
}) {
  return (
    <circle r="3.5" fill={color}>
      <animateMotion dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" rotate="auto">
        <mpath href={`#${pathId}`} />
      </animateMotion>
    </circle>
  );
}

// ── Layout ──
const ROW = { trigger: 60, agent: 195, finding: 330, deep: 475, rootCause: 625, scenario: 780 };
const TREE_H = 870;
const STAGGER = [-30, 0, 30];
const CX = 50; // center X percent

function branchX(idx: number): number {
  return CX + (idx - 1) * 22;
}

// ══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

function AssetGridIQ() {
  const searchParams = useSearchParams();
  const tag = searchParams.get('tag') || '';
  const router = useRouter();
  const { isDark } = useTheme();

  const [diag, setDiag] = useState<AssetDiagnostic | null>(null);
  const [scenario, setScenario] = useState<DemoScenario | null>(null);
  const [reveal, setReveal] = useState(0);
  const [decision, setDecision] = useState<'pending' | 'approved' | 'deferred'>('pending');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!tag) return;
    const asset = getSubstationAsset(tag);
    if (asset) {
      const d = synthesizeDiagnostic(asset);
      setDiag(d);
      setScenario(synthesizeScenario(asset, d));
      setReveal(0);
      setDecision('pending');
      setExpanded(false);
      // Animate reveal: 5 tree rows + scenario card
      const timers = [1, 2, 3, 4, 5, 6].map((step, i) =>
        setTimeout(() => setReveal(step), 400 + i * 500)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [tag]);

  const svgC = isDark
    ? { line: 'rgba(255,255,255,0.12)', lineStrong: 'rgba(255,255,255,0.25)', dash: 'rgba(255,255,255,0.08)', label: 'rgba(255,255,255,0.25)' }
    : { line: 'rgba(30,27,75,0.12)', lineStrong: 'rgba(30,27,75,0.2)', dash: 'rgba(30,27,75,0.08)', label: 'rgba(30,27,75,0.2)' };

  if (!tag) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white/50">No asset tag specified</div>;
  }

  if (!diag) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Brain className="w-8 h-8 text-violet-400 mx-auto mb-3 animate-pulse" />
          <p className="text-white/50 text-sm">Loading diagnostic for {tag}…</p>
        </div>
      </div>
    );
  }

  const a = diag.asset;
  const opco = OPCOS.find(o => o.id === a.opco);
  const agents = diag.agentIds.map(id => AGENTS[id]);
  const catConfig = CATEGORY_CONFIG[diag.scenarioCategory] || CATEGORY_CONFIG.aging_asset;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/90 backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-2.5">
          <div className="flex items-center gap-3">
            <Link href="/risk-intelligence" className="text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold text-white/90">Grid IQ Diagnostic</h1>
                <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${catConfig.color} ${catConfig.bg} ${catConfig.border} border`}>
                  {catConfig.label}
                </span>
              </div>
              <p className="text-[10px] text-white/40 mt-0.5">
                {a.name} · {a.tag} · {opco?.territory || a.opco}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/transformer-iot?asset=${a.tag}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors text-[10px] text-white/60 hover:text-white/80">
              <Activity className="w-3 h-3" />
              Asset IoT View
            </Link>
            <ThemeToggle />
          </div>
        </div>

        {/* Asset summary bar */}
        <div className="flex items-center gap-6 px-5 py-2 border-t border-white/5 bg-white/[0.01]">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Health</span>
            <span className={`text-sm font-bold font-mono ${a.health < 30 ? 'text-rose-400' : a.health < 50 ? 'text-amber-400' : 'text-emerald-400'}`}>{a.health}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Age</span>
            <span className="text-sm font-mono text-white/70">{a.age} yr</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Load</span>
            <span className="text-sm font-mono text-white/70">{a.load}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Voltage</span>
            <span className="text-sm font-mono text-white/70">{a.kv} kV</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Customers</span>
            <span className="text-sm font-mono text-white/70">{a.customers.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Failure Mode</span>
            <span className="text-xs font-medium text-rose-400">{a.failureMode}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">TTF</span>
            <span className={`text-sm font-bold font-mono ${a.riskTrend === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>{a.ttf}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-white/35 uppercase">Confidence</span>
            <span className="text-sm font-bold font-mono text-violet-400">{diag.crossVal.confidence}%</span>
          </div>
        </div>
      </header>

      {/* Diagnostic Tree */}
      <div className="overflow-x-auto px-5 py-6">
        <div className="mx-auto" style={{ maxWidth: 1100, minWidth: 800 }}>

          {/* Load & Weather Context */}
          <LoadWeatherContext assetTag={a.tag} baseLoad={a.load} health={a.health} />

          {/* Row labels */}
          <div className="relative isolate" style={{ height: TREE_H }}>
            <div className="absolute left-0 top-0 w-[70px] h-full pointer-events-none z-20">
              {[
                { y: ROW.trigger, label: 'TRIGGERS', rev: 1 },
                { y: ROW.agent, label: 'AGENTS', rev: 2 },
                { y: ROW.finding, label: 'FINDINGS', rev: 3 },
                { y: ROW.deep, label: 'DEEP ANALYSIS', rev: 4 },
                { y: ROW.rootCause, label: 'ROOT CAUSE', rev: 5 },
              ].map((r, i) => (
                <div key={i} className={`absolute text-[9px] font-bold uppercase tracking-widest text-white/35 transition-opacity duration-500 ${reveal >= r.rev ? 'opacity-100' : 'opacity-0'}`}
                  style={{ top: r.y - 2, left: 0, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                  {r.label}
                </div>
              ))}
            </div>

            {/* SVG connections */}
            <svg className="absolute inset-0 w-full pointer-events-none" style={{ height: TREE_H, zIndex: -1 }} viewBox="0 0 1100 870" preserveAspectRatio="none">
              {[0, 1, 2].map(bi => {
                const bx = branchX(bi) * 11; // percent → viewbox coords
                const st = STAGGER[bi];
                const convId = `conv-${bi}`;
                const agent = agents[bi];
                return (
                  <g key={bi}>
                    <AnimatedPath d={`M ${bx},${ROW.trigger + 14 + st} C ${bx},${ROW.trigger + 40 + st} ${bx},${ROW.agent - 35} ${bx},${ROW.agent - 16}`} visible={reveal >= 2} delay={bi * 80} color={svgC.line} width={1.5} />
                    <AnimatedPath d={`M ${bx},${ROW.agent + 28} C ${bx},${ROW.agent + 55} ${bx},${ROW.finding - 30 + st} ${bx},${ROW.finding - 10 + st}`} visible={reveal >= 3} delay={bi * 80} color={svgC.line} width={1.5} />
                    <AnimatedPath d={`M ${bx},${ROW.finding + 22 + st} L ${bx},${ROW.deep - 14 + st}`} visible={reveal >= 4} delay={bi * 100} color={agent?.dotColor || svgC.line} width={2} />
                    <AnimatedPath id={convId} d={`M ${bx},${ROW.deep + 28 + st} C ${bx},${ROW.deep + 55 + st} ${CX * 11},${ROW.rootCause - 45} ${CX * 11},${ROW.rootCause - 18}`} visible={reveal >= 5} delay={bi * 120} color={agent?.dotColor} width={2.5} />
                    {reveal >= 5 && <PulseDot pathId={convId} dur={2.5} delay={bi * 0.3} color={agent?.dotColor || 'rgba(255,255,255,0.3)'} />}
                  </g>
                );
              })}

              {/* Cross-links */}
              {diag.crossLinks.map((label, li) => {
                const x1 = branchX(0) * 11;
                const x2 = branchX(2) * 11;
                const midX = (x1 + x2) / 2;
                const midY = ROW.deep + 6 - 40;
                const pathId = `xlink-${li}`;
                return (
                  <g key={pathId}>
                    <AnimatedPath id={pathId}
                      d={`M ${x1},${ROW.deep + 6 + STAGGER[0]} C ${midX},${midY} ${midX},${midY} ${x2},${ROW.deep + 6 + STAGGER[2]}`}
                      visible={reveal >= 5} delay={600 + li * 300} color={svgC.dash} width={1.5} dash />
                    <text x={midX} y={midY + 12} fill={svgC.label} fontSize="9" textAnchor="middle" fontFamily="monospace"
                      className={`transition-opacity duration-500 ${reveal >= 5 ? 'opacity-100' : 'opacity-0'}`}
                      style={{ transitionDelay: `${900 + li * 300}ms` }}>
                      {label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* TRIGGERS */}
            {diag.triggers.map((trigger, ti) => {
              const x = branchX(ti);
              const st = STAGGER[ti];
              const TIcon = ICON_MAP[trigger.iconName] || Activity;
              return (
                <div key={`t-${ti}`}
                  className={`absolute -translate-x-1/2 z-10 transition-all duration-500 ${reveal >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                  style={{ left: `${x}%`, top: ROW.trigger - 18 + st, transitionDelay: `${ti * 100}ms` }}>
                  <div className={`giq-node flex items-center gap-1.5 px-2.5 py-1.5 rounded border max-w-[200px] ${TRIGGER_COLORS[trigger.color]}`}>
                    <TIcon className="w-3 h-3 flex-shrink-0" />
                    <div className="min-w-0 overflow-hidden">
                      <div className="text-[10px] font-bold leading-tight truncate">{trigger.label}</div>
                      <div className="text-[9px] text-white/55 truncate">{trigger.detail}</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* AGENTS */}
            {diag.agentIds.map((agentId, ai) => {
              const agent = AGENTS[agentId];
              if (!agent) return null;
              const x = branchX(ai);
              return (
                <div key={`a-${ai}`}
                  className={`absolute -translate-x-1/2 z-10 transition-all duration-500 ${reveal >= 2 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
                  style={{ left: `${x}%`, top: ROW.agent - 16, transitionDelay: `${ai * 100}ms` }}>
                  <div className={`giq-node flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded border ${agent.borderColor} ${agent.bgColor}`}>
                    <span className={agent.color}>{agent.icon}</span>
                    <span className={`text-[10px] font-bold ${agent.color}`}>{agent.shortName}</span>
                    <span className={`text-[8px] font-mono transition-colors duration-500 ${reveal >= 3 ? 'text-emerald-400' : 'text-white/30'}`}>
                      {reveal >= 3 ? '✓ done' : '⟳'}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* FINDINGS */}
            {diag.findings.map((finding, fi) => {
              const x = branchX(fi);
              const st = STAGGER[fi];
              const isCrit = finding.sev === 'critical';
              return (
                <div key={`f-${fi}`}
                  className={`absolute -translate-x-1/2 z-10 transition-all duration-400 ${reveal >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                  style={{ left: `${x}%`, top: ROW.finding - 10 + st, transitionDelay: `${fi * 120}ms` }}>
                  <div className={`giq-node text-[9px] font-mono font-semibold px-2 py-1 rounded border w-[180px] leading-snug overflow-hidden ${
                    isCrit ? 'border-rose-500/30 bg-rose-500/[0.10] text-rose-300' : 'border-amber-500/30 bg-amber-500/[0.10] text-amber-300'
                  }`}>
                    <span className="line-clamp-2">{finding.text}</span>
                  </div>
                </div>
              );
            })}

            {/* DEEP ANALYSIS */}
            {diag.deepAnalysis.map((da, di) => {
              const x = branchX(di);
              const st = STAGGER[di];
              const agent = AGENTS[diag.agentIds[di]];
              return (
                <div key={`d-${di}`}
                  className={`absolute -translate-x-1/2 z-10 transition-all duration-500 ${reveal >= 4 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                  style={{ left: `${x}%`, top: ROW.deep - 14 + st, transitionDelay: `${di * 140}ms` }}>
                  <div className={`giq-node w-[180px] px-2 py-1.5 rounded border overflow-hidden ${agent?.borderColor || 'border-white/10'} ${agent?.bgColor || 'bg-white/[0.03]'}`}>
                    <div className={`text-[8px] font-bold uppercase tracking-wider ${agent?.color || 'text-white/50'} mb-0.5 truncate`}>{da.method}</div>
                    <div className="text-[9px] text-white/70 leading-snug line-clamp-2">{da.text}</div>
                  </div>
                </div>
              );
            })}

            {/* ROOT CAUSE */}
            <div className={`absolute -translate-x-1/2 z-10 transition-all duration-500 ${reveal >= 5 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
              style={{ left: `${CX}%`, top: ROW.rootCause - 18 }}>
              <div className="giq-node flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 max-w-[260px] border-rose-500/25 bg-rose-500/[0.08]">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-rose-400">✓ Root Cause</span>
                  <span className="text-[10px] font-mono font-bold text-rose-400">{diag.crossVal.confidence}%</span>
                </div>
                <span className="text-[12px] font-bold text-white/90 text-center leading-tight">{diag.crossVal.label}</span>
                <span className="text-[9px] text-white/55 text-center leading-snug">{diag.crossVal.detail}</span>
              </div>
            </div>

            {/* SVG connector: root cause → scenario */}
            <svg className="absolute inset-0 w-full pointer-events-none" style={{ height: TREE_H, zIndex: -1 }} viewBox="0 0 1100 870" preserveAspectRatio="none">
              <AnimatedPath
                d={`M ${CX * 11},${ROW.rootCause + 30} L ${CX * 11},${ROW.scenario - 25}`}
                visible={reveal >= 6} color={svgC.lineStrong} width={2.5} />
            </svg>

            {/* SCENARIO CARD */}
            {scenario && (
              <div className={`absolute -translate-x-1/2 z-10 transition-all duration-500 ${reveal >= 6 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
                style={{ left: `${CX}%`, top: ROW.scenario - 25 }}>
                <button
                  onClick={() => { setExpanded(!expanded); setDecision('pending'); }}
                  className={`giq-node flex flex-col items-center gap-1 px-4 py-3 rounded-lg border-2 transition-all cursor-pointer max-w-[220px] ${
                    expanded
                      ? `${catConfig.border} ${catConfig.bg} ring-1 ring-white/10 shadow-lg shadow-white/5`
                      : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15'
                  }`}>
                  <span className={`text-[9px] uppercase tracking-wider font-bold ${catConfig.color}`}>{catConfig.label}</span>
                  <span className="text-[11px] font-bold text-white/90 text-center leading-tight">{scenario.title}</span>
                  <div className="flex items-center gap-1.5 text-[9px] text-white/50">
                    <span>{scenario.outcome.customersProtected.toLocaleString()} cust.</span>
                    <span>·</span>
                    <span>{scenario.outcome.costAvoided} at risk</span>
                  </div>
                  <span className={`text-[9px] font-medium ${expanded ? 'text-amber-400' : 'text-white/35'}`}>
                    {expanded ? '▼ Expanded' : '▶ Investigate'}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ═══ SCENARIO EXPANSION (below tree) ═══ */}
          {expanded && scenario && (
            <div className="max-w-3xl mx-auto pb-12 animate-in fade-in slide-in-from-top-2 duration-300">
              {/* Connector line from tree */}
              <div className="flex justify-center py-2">
                <div className="w-px h-6 bg-white/10" />
              </div>

              {/* Scenario brief card */}
              <div className={`rounded-xl border ${catConfig.border} bg-white/[0.02] p-5 mb-4`}>
                <div className="flex items-start gap-3">
                  <Brain className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">{scenario.title}</h3>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${catConfig.bg} ${catConfig.color}`}>{scenario.severity}</span>
                    </div>
                    <p className="text-xs text-white/50 leading-relaxed">{scenario.description}</p>
                  </div>
                </div>

                {/* Impact metrics strip */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10 p-2.5 text-center">
                    <div className="text-[9px] text-white/35">Cost Avoided</div>
                    <div className="text-sm font-bold text-emerald-400">{scenario.outcome.costAvoided}</div>
                  </div>
                  <div className="rounded-lg bg-blue-500/[0.04] border border-blue-500/10 p-2.5 text-center">
                    <div className="text-[9px] text-white/35">Customers</div>
                    <div className="text-sm font-bold text-blue-400">{scenario.outcome.customersProtected.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/10 p-2.5 text-center">
                    <div className="text-[9px] text-white/35">Hours Saved</div>
                    <div className="text-sm font-bold text-amber-400">{scenario.outcome.outageHoursAvoided}h</div>
                  </div>
                </div>
              </div>

              {/* Decision (pending) */}
              {decision === 'pending' && (
                <>
                  <div className="flex justify-center py-1"><div className="w-px h-4 bg-white/10" /></div>
                  <AssetDecisionPanel
                    decisionSupport={scenario.decisionSupport}
                    onApprove={() => setDecision('approved')}
                    onDefer={() => setDecision('deferred')}
                  />
                </>
              )}

              {/* Dispatch (approved) */}
              {decision === 'approved' && (
                <>
                  <div className="flex justify-center py-1"><div className="w-px h-4 bg-emerald-500/20" /></div>
                  <AssetInlineDispatch scenario={scenario} onReset={() => { setExpanded(false); setDecision('pending'); }} />
                </>
              )}

              {/* Deferred */}
              {decision === 'deferred' && (
                <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-5 text-center mt-4">
                  <Clock className="w-6 h-6 text-amber-400 mx-auto mb-2" />
                  <h4 className="text-sm font-semibold text-amber-400 mb-1">Deferred to Watch List</h4>
                  <p className="text-xs text-white/40 mb-3">Asset will be re-evaluated at next monitoring cycle. TTF: {a.ttf}.</p>
                  <button onClick={() => { setExpanded(false); setDecision('pending'); }} className="text-xs text-white/40 hover:text-white/60 transition-colors">← Back to analysis</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DECISION PANEL
// ════════════════════════════════════════════════════════════════

function AssetDecisionPanel({ decisionSupport, onApprove, onDefer }: {
  decisionSupport: DecisionSupport;
  onApprove: () => void;
  onDefer: () => void;
}) {
  const [selectedTab, setSelectedTab] = useState<'approve' | 'defer'>('approve');
  const option = selectedTab === 'approve' ? decisionSupport.approveOption : decisionSupport.deferOption;

  const urgencyLabels: Record<string, { text: string; color: string }> = {
    immediate: { text: 'Immediate', color: 'text-rose-400/70 bg-rose-500/10 border-rose-500/15' },
    within_24h: { text: 'Within 24 hours', color: 'text-amber-400/70 bg-amber-500/10 border-amber-500/15' },
    within_week: { text: 'Within 1 week', color: 'text-yellow-400/60 bg-yellow-500/10 border-yellow-500/15' },
    within_month: { text: 'Within 1 month', color: 'text-cyan-400/60 bg-cyan-500/10 border-cyan-500/15' },
  };

  const riskColors: Record<string, string> = {
    low: 'text-emerald-400/60 bg-emerald-500/10',
    medium: 'text-amber-400/60 bg-amber-500/10',
    high: 'text-orange-400/60 bg-orange-500/10',
    critical: 'text-rose-400/60 bg-rose-500/10',
  };

  const urg = urgencyLabels[decisionSupport.urgency] || urgencyLabels.within_week;

  return (
    <div className="rounded-xl bg-white/[0.03] border border-amber-500/15 overflow-hidden animate-in fade-in duration-500">
      <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber-400/50" />
            <span className="text-sm font-semibold text-amber-400/60">Operator Decision Required</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${urg.color}`}>{urg.text}</span>
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <Brain className="w-3 h-3" /> {decisionSupport.confidenceScore}%
            </span>
          </div>
        </div>
        <p className="text-xs text-white/50 leading-relaxed">{decisionSupport.summary}</p>
      </div>

      <div className="px-4 py-2.5 bg-rose-500/[0.03] border-b border-white/[0.06]">
        <div className="text-[10px] font-semibold text-rose-400/50 uppercase tracking-wider mb-1">Key Risks</div>
        <div className="space-y-1">
          {decisionSupport.keyRisks.map((risk, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[11px] text-white/45">
              <AlertTriangle className="w-3 h-3 text-rose-400/40 flex-shrink-0 mt-0.5" />
              {risk}
            </div>
          ))}
        </div>
      </div>

      <div className="flex border-b border-white/[0.06]">
        <button onClick={() => setSelectedTab('approve')} className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
          selectedTab === 'approve' ? 'text-emerald-400/70 border-b-2 border-emerald-400/50 bg-emerald-500/[0.04]' : 'text-white/35 hover:text-white/50'
        }`}>
          <span className="flex items-center justify-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Approve</span>
        </button>
        <button onClick={() => setSelectedTab('defer')} className={`flex-1 px-3 py-2 text-xs font-medium transition-all ${
          selectedTab === 'defer' ? 'text-amber-400/70 border-b-2 border-amber-400/50 bg-amber-500/[0.04]' : 'text-white/35 hover:text-white/50'
        }`}>
          <span className="flex items-center justify-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Defer</span>
        </button>
      </div>

      <div className="px-4 py-4 space-y-3">
        <p className="text-xs text-white/50">{option.description}</p>

        <div className="grid grid-cols-3 gap-2">
          <div className={`p-2.5 rounded-lg text-center ${
            option.financialImpact.trend === 'positive' ? 'bg-emerald-500/[0.06] border border-emerald-500/10' : 'bg-rose-500/[0.06] border border-rose-500/10'
          }`}>
            <div className="text-[10px] text-white/35">{option.financialImpact.label}</div>
            <div className={`text-sm font-bold ${option.financialImpact.trend === 'positive' ? 'text-emerald-400/70' : 'text-rose-400/70'}`}>{option.financialImpact.value}</div>
          </div>
          <div className={`p-2.5 rounded-lg text-center ${riskColors[option.riskLevel]}`}>
            <div className="text-[10px] text-white/35">Risk Level</div>
            <div className="text-sm font-bold capitalize">{option.riskLevel}</div>
          </div>
          <div className="p-2.5 rounded-lg text-center bg-white/[0.03] border border-white/[0.06]">
            <div className="text-[10px] text-white/35">Timeline</div>
            <div className="text-[10px] font-medium text-white/60 leading-tight">{option.timeline}</div>
          </div>
        </div>

        <div className="p-2.5 rounded-lg bg-blue-500/[0.04] border border-blue-500/10 flex items-start gap-2">
          <Users className="w-3.5 h-3.5 text-blue-400/50 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] text-blue-400/50 font-medium">Customer Impact</div>
            <div className="text-xs text-white/50">{option.customerImpact}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-[10px] font-semibold text-emerald-400/50 uppercase tracking-wider mb-1.5">Value</div>
            {option.pros.map((p, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-white/45 mb-1">
                <CheckCircle className="w-3 h-3 text-emerald-400/40 flex-shrink-0 mt-0.5" /> {p}
              </div>
            ))}
          </div>
          <div>
            <div className="text-[10px] font-semibold text-rose-400/50 uppercase tracking-wider mb-1.5">Risks</div>
            {option.cons.map((c, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-white/45 mb-1">
                <AlertTriangle className="w-3 h-3 text-rose-400/40 flex-shrink-0 mt-0.5" /> {c}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-white/[0.06]">
          <button onClick={onApprove} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-violet-700 to-purple-800 font-medium text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2" style={{ color: "#fff" }}>
            <CheckCircle className="w-4 h-4" /> Approve & Execute
          </button>
          <button onClick={onDefer} className="flex-1 py-2.5 rounded-lg border border-white/10 text-white/60 font-medium text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2">
            <Clock className="w-4 h-4" /> Defer
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INLINE DISPATCH
// ════════════════════════════════════════════════════════════════

function AssetInlineDispatch({ scenario, onReset }: { scenario: DemoScenario; onReset: () => void }) {
  const [steps, setSteps] = useState([
    { id: 'wo', label: 'Generate Work Order', detail: `WO-${scenario.assetTag.replace(/-/g, '').slice(-6)}-GIQ`, status: 'pending' as const, icon: ClipboardList },
    { id: 'crew', label: 'Dispatch Crew Notification', detail: `${scenario.opCo} field operations notified`, status: 'pending' as const, icon: Users },
    { id: 'scada', label: 'SCADA Switching Order', detail: 'Automated load transfer prepared', status: 'pending' as const, icon: Zap },
    { id: 'parts', label: 'Parts Reserved', detail: 'Spare components from inventory', status: 'pending' as const, icon: Wrench },
    { id: 'schedule', label: 'Schedule Updated', detail: 'Gantt chart adjusted, stakeholders notified', status: 'pending' as const, icon: Calendar },
  ]);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    steps.forEach((_, idx) => {
      setTimeout(() => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'running' as const } : s)), idx * 800);
      setTimeout(() => setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status: 'done' as const } : s)), idx * 800 + 600);
    });
    setTimeout(() => setAllDone(true), steps.length * 800 + 600);
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-cyan-400" />
        <span className="text-xs font-semibold text-white">Dispatch & Execution</span>
        <span className="text-[10px] text-white/30">— {scenario.title}</span>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          return (
            <div key={step.id} className={`flex items-center gap-3 px-4 py-3 ${idx < steps.length - 1 ? 'border-b border-white/5' : ''} ${
              step.status === 'running' ? 'bg-cyan-500/[0.04]' : step.status === 'done' ? 'bg-emerald-500/[0.02]' : ''
            } transition-all duration-500`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                step.status === 'done' ? 'bg-emerald-500/20' : step.status === 'running' ? 'bg-cyan-500/20' : 'bg-white/5'
              }`}>
                {step.status === 'done' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> :
                 step.status === 'running' ? <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" /> :
                 <StepIcon className="w-3.5 h-3.5 text-white/30" />}
              </div>
              <div className="flex-1">
                <div className="text-xs font-medium text-white">{step.label}</div>
                <div className="text-[10px] text-white/40">{step.detail}</div>
              </div>
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                step.status === 'done' ? 'bg-emerald-500/15 text-emerald-400' :
                step.status === 'running' ? 'bg-cyan-500/15 text-cyan-400' :
                'bg-white/5 text-white/30'
              }`}>
                {step.status === 'done' ? '✓' : step.status === 'running' ? '⟳' : '○'}
              </span>
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center animate-in zoom-in-95 duration-300">
          <BadgeCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-emerald-400 mb-1">Dispatch Complete</h4>
          <p className="text-xs text-white/40 mb-3">All systems updated. Crews notified. SCADA orders queued.</p>
          <div className="grid grid-cols-3 gap-3 mb-4 max-w-sm mx-auto">
            <div>
              <div className="text-[10px] text-white/35">Cost Avoided</div>
              <div className="text-sm font-bold text-emerald-400">{scenario.outcome.costAvoided}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/35">Customers</div>
              <div className="text-sm font-bold text-blue-400">{scenario.outcome.customersProtected.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-white/35">Hours Saved</div>
              <div className="text-sm font-bold text-amber-400">{scenario.outcome.outageHoursAvoided}h</div>
            </div>
          </div>
          <button onClick={onReset} className="px-5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors">
            ← Back to Analysis
          </button>
        </div>
      )}
    </div>
  );
}

export default function AssetGridIQPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center">
      <Brain className="w-8 h-8 text-violet-400 animate-pulse" />
    </div>}>
      <AssetGridIQ />
    </Suspense>
  );
}
