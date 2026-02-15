// @ts-nocheck — Per-asset Grid IQ diagnostic view
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Activity, Zap, Shield, Thermometer, Eye,
  FlaskConical, FileText, ClipboardList, Building, ChevronRight,
  AlertTriangle, TrendingDown, Clock, Brain,
} from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import { getSubstationAsset, synthesizeDiagnostic, type AssetDiagnostic } from '@/lib/exelon/asset-bridge';
import { OPCOS } from '@/lib/exelon/risk-intelligence-data';

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
const ROW = { trigger: 60, agent: 195, finding: 330, deep: 475, rootCause: 625 };
const TREE_H = 720;
const STAGGER = [-25, 0, 25];
const CX = 50; // center X percent

function branchX(idx: number): number {
  return CX + (idx - 1) * 14;
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
  const [reveal, setReveal] = useState(0);

  useEffect(() => {
    if (!tag) return;
    const asset = getSubstationAsset(tag);
    if (asset) {
      setDiag(synthesizeDiagnostic(asset));
      setReveal(0);
      // Animate reveal
      const timers = [1, 2, 3, 4, 5].map((step, i) =>
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
        <div className="mx-auto" style={{ maxWidth: 900, minWidth: 700 }}>

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
            <svg className="absolute inset-0 w-full pointer-events-none" style={{ height: TREE_H, zIndex: -1 }} viewBox="0 0 900 720" preserveAspectRatio="none">
              {[0, 1, 2].map(bi => {
                const bx = branchX(bi) * 9; // percent → viewbox coords
                const st = STAGGER[bi];
                const convId = `conv-${bi}`;
                const agent = agents[bi];
                return (
                  <g key={bi}>
                    <AnimatedPath d={`M ${bx},${ROW.trigger + 14 + st} C ${bx},${ROW.trigger + 40 + st} ${bx},${ROW.agent - 35} ${bx},${ROW.agent - 16}`} visible={reveal >= 2} delay={bi * 80} color={svgC.line} width={1.5} />
                    <AnimatedPath d={`M ${bx},${ROW.agent + 28} C ${bx},${ROW.agent + 55} ${bx},${ROW.finding - 30 + st} ${bx},${ROW.finding - 10 + st}`} visible={reveal >= 3} delay={bi * 80} color={svgC.line} width={1.5} />
                    <AnimatedPath d={`M ${bx},${ROW.finding + 22 + st} L ${bx},${ROW.deep - 14 + st}`} visible={reveal >= 4} delay={bi * 100} color={agent?.dotColor || svgC.line} width={2} />
                    <AnimatedPath id={convId} d={`M ${bx},${ROW.deep + 28 + st} C ${bx},${ROW.deep + 55 + st} ${CX * 9},${ROW.rootCause - 45} ${CX * 9},${ROW.rootCause - 18}`} visible={reveal >= 5} delay={bi * 120} color={agent?.dotColor} width={2.5} />
                    {reveal >= 5 && <PulseDot pathId={convId} dur={2.5} delay={bi * 0.3} color={agent?.dotColor || 'rgba(255,255,255,0.3)'} />}
                  </g>
                );
              })}

              {/* Cross-links */}
              {diag.crossLinks.map((label, li) => {
                const x1 = branchX(0) * 9;
                const x2 = branchX(2) * 9;
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
                  <div className={`giq-node flex items-center gap-1.5 px-2.5 py-1.5 rounded border max-w-[170px] ${TRIGGER_COLORS[trigger.color]}`}>
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
                  <div className={`giq-node text-[9px] font-mono font-semibold px-2 py-1 rounded border w-[155px] leading-snug overflow-hidden ${
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
                  <div className={`giq-node w-[150px] px-2 py-1.5 rounded border overflow-hidden ${agent?.borderColor || 'border-white/10'} ${agent?.bgColor || 'bg-white/[0.03]'}`}>
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
          </div>

          {/* Action cards */}
          {reveal >= 5 && (
            <div className="mt-4 grid grid-cols-3 gap-3 transition-all duration-500">
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mb-2">Recommended Action</div>
                <p className="text-[11px] text-white/70 leading-relaxed">{a.repairWindow} — {a.failureMode.toLowerCase()} repair. Estimated duration: {a.repairDuration}.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-sky-400 mb-2">Required Resources</div>
                <div className="flex flex-wrap gap-1">
                  {[...a.materials, ...a.skills].map((item, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/50 border border-white/5">{item}</span>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Impact</div>
                <p className="text-[11px] text-white/70 leading-relaxed">
                  {a.customers.toLocaleString()} customers protected · {a.kv} kV · {a.ttf} to predicted failure
                </p>
                <Link href={`/transformer-iot?asset=${a.tag}`}
                  className="inline-flex items-center gap-1 mt-2 text-[10px] text-violet-400 hover:text-violet-300 transition-colors">
                  Open IoT Dashboard <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
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
