// @ts-nocheck — Dispatch: Today's Operations + AI Re-Planning
'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, AlertTriangle, Zap, Calendar, Clock, CheckCircle,
  ChevronDown, ChevronUp, RefreshCw, Users, Wrench, Activity,
  ShieldAlert, Truck, CloudSnow, Package, TrendingUp, TrendingDown,
  Filter, ArrowUpDown, Brain, Sparkles, ChevronRight, Play,
  Settings, Plus, Search, X, ExternalLink, Radio, Eye,
  BarChart3, Target, Timer, MapPin, DollarSign, Shield,
} from 'lucide-react';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import {
  DISPATCH_STATS, DISPATCH_WORK_ORDERS, DISRUPTIONS, GANTT_SCENARIOS,
  CREW_LEADS,
  type DispatchWorkOrder, type WOPriority, type WOStatus, type Disruption,
  type GanttTask, type ScheduleScenario, type DispatchStats,
} from '@/lib/exelon/dispatch-data';

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

const PRIORITY_CONFIG: Record<WOPriority, { label: string; color: string; bg: string; border: string; sortOrder: number }> = {
  P1: { label: 'P1', color: 'text-rose-400', bg: 'bg-rose-500/15', border: 'border-rose-500/30', sortOrder: 0 },
  P2: { label: 'P2', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', sortOrder: 1 },
  P3: { label: 'P3', color: 'text-sky-400', bg: 'bg-sky-500/15', border: 'border-sky-500/30', sortOrder: 2 },
  Routine: { label: 'Routine', color: 'text-white/40', bg: 'bg-white/[0.06]', border: 'border-white/10', sortOrder: 3 },
};

const STATUS_CONFIG: Record<WOStatus, { label: string; color: string; dot: string }> = {
  in_progress: { label: 'In Progress', color: 'text-emerald-400', dot: 'bg-emerald-400' },
  dispatched: { label: 'Dispatched', color: 'text-sky-400', dot: 'bg-sky-400' },
  en_route: { label: 'En Route', color: 'text-cyan-400', dot: 'bg-cyan-400' },
  on_hold: { label: 'On Hold', color: 'text-amber-400', dot: 'bg-amber-400' },
  completed: { label: 'Completed', color: 'text-white/30', dot: 'bg-white/30' },
  deferred: { label: 'Deferred', color: 'text-white/20', dot: 'bg-white/20' },
};

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// ════════════════════════════════════════════════════════════════
// SUB-VIEWS
// ════════════════════════════════════════════════════════════════

type SubView = 'today' | 'replan';

// ════════════════════════════════════════════════════════════════
// EVENT FEED TICKER
// ════════════════════════════════════════════════════════════════

function EventFeedTicker() {
  const events = [
    { severity: 'critical' as const, text: <><strong>DGA Condition 4 at Westport 230kV</strong> — 72K customers at risk · 5:22 AM</> },
    { severity: 'critical' as const, text: <><strong>Cooling failure at Calvert Cliffs 500kV</strong> — all fans offline · 6:45 AM</> },
    { severity: 'warning' as const, text: <><strong>2 technicians called out</strong> — 6 tasks affected · 6:15 AM</> },
    { severity: 'warning' as const, text: <><strong>Ice storm warning</strong> — Delmarva substations at risk · Yesterday 10:45 PM</> },
    { severity: 'warning' as const, text: <><strong>ABB bushing backordered</strong> — 3 ComEd tasks may slip · Yesterday 4:30 PM</> },
    { severity: 'positive' as const, text: <><strong>Canton ground test early</strong> — crew reassigned to Cardiff · 11:15 AM</> },
  ];

  const severityIcon = (s: string) => {
    if (s === 'critical') return <AlertTriangle className="w-3 h-3 text-rose-400/70 flex-shrink-0" />;
    if (s === 'warning') return <ShieldAlert className="w-3 h-3 text-amber-400/70 flex-shrink-0" />;
    return <Zap className="w-3 h-3 text-emerald-400/70 flex-shrink-0" />;
  };

  const severityColor = (s: string) => {
    if (s === 'critical') return 'text-rose-300/60';
    if (s === 'warning') return 'text-amber-300/50';
    return 'text-emerald-300/50';
  };

  const allEvents = [...events, ...events];

  return (
    <div className="flex-1 overflow-hidden relative h-6 ml-4" style={{ maskImage: 'linear-gradient(to right, transparent, black 40px, black calc(100% - 60px), transparent)' }}>
      <div className="flex items-center gap-6 animate-ticker whitespace-nowrap">
        {allEvents.map((e, i) => (
          <span key={i} className="inline-flex items-center gap-0">
            {severityIcon(e.severity)}
            <span className={`text-[11px] ml-1.5 ${severityColor(e.severity)}`}>{e.text}</span>
            {i < allEvents.length - 1 && <span className="text-white/10 mx-4">|</span>}
          </span>
        ))}
      </div>
      <style jsx>{`
        @keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-ticker { animation: ticker 60s linear infinite; }
        .animate-ticker:hover { animation-play-state: paused; }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// STAT CARDS
// ════════════════════════════════════════════════════════════════

function StatCards({ stats }: { stats: DispatchStats }) {
  const { completedToday } = stats;
  const progressBars = [
    { label: 'P1', ...completedToday.p1, color: 'bg-rose-500/60' },
    { label: 'P2', ...completedToday.p2, color: 'bg-amber-500/50' },
    { label: 'P3', ...completedToday.p3, color: 'bg-sky-500/40' },
    { label: 'Rtn', ...completedToday.routine, color: 'bg-white/20' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 px-5 pb-4">
      {/* Grid Reliability */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Grid Reliability</div>
        <div className="text-2xl font-semibold text-white/90 tabular-nums">{stats.gridReliability.currentPct}%</div>
        <div className="flex items-center gap-1 mt-0.5">
          {stats.gridReliability.trendDirection === 'up'
            ? <TrendingUp className="w-3 h-3 text-emerald-400/60" />
            : <TrendingDown className="w-3 h-3 text-rose-400/60" />}
          <span className={`text-[10px] ${stats.gridReliability.trendDirection === 'up' ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
            {stats.gridReliability.trend} vs yesterday
          </span>
        </div>
      </div>

      {/* Open Work Orders */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Open Work Orders</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-white/90 tabular-nums">{stats.openWorkOrders.total}</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] px-1 py-0.5 rounded bg-rose-500/15 text-rose-400/70">{stats.openWorkOrders.p1}</span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-400/70">{stats.openWorkOrders.p2}</span>
            <span className="text-[9px] px-1 py-0.5 rounded bg-sky-500/15 text-sky-400/60">{stats.openWorkOrders.p3}</span>
          </div>
        </div>
        <div className="text-[10px] text-white/30 mt-0.5">{stats.openWorkOrders.closedToday} closed today</div>
      </div>

      {/* At-Risk Assets */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">At-Risk Assets</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-white/90 tabular-nums">{stats.atRiskAssets.count}</span>
          <span className="text-[10px] text-white/25">assets</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <TrendingDown className="w-3 h-3 text-emerald-400/60" />
          <span className="text-[10px] text-emerald-400/60">{stats.atRiskAssets.trend} vs last week</span>
        </div>
      </div>

      {/* Cost Avoidance MTD */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Cost Avoidance MTD</div>
        <div className="text-2xl font-semibold text-white/90 tabular-nums">{formatCurrency(stats.costAvoidanceMTD.amount)}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <TrendingUp className="w-3 h-3 text-emerald-400/60" />
          <span className="text-[10px] text-emerald-400/60">{stats.costAvoidanceMTD.trend} vs last month</span>
        </div>
      </div>

      {/* Completed Today */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3">
        <div className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Completed Today</div>
        <div className="space-y-1.5">
          {progressBars.map(b => {
            const pct = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
            return (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-[9px] text-white/35 w-5 text-right font-medium">{b.label}</span>
                <div className="flex-1 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${b.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[9px] text-white/30 tabular-nums w-7">{b.completed}/{b.total}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// TASK TABLE
// ════════════════════════════════════════════════════════════════

type SortField = 'priority' | 'id' | 'title' | 'assetName' | 'crewLead' | 'worker' | 'status' | 'costIfDelayed' | 'costIfEscalated' | 'timeSlot';

function TaskTable({
  workOrders,
  onSelectWO,
}: {
  workOrders: DispatchWorkOrder[];
  onSelectWO: (wo: DispatchWorkOrder) => void;
}) {
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterPriority, setFilterPriority] = useState<WOPriority | 'all'>('all');
  const [filterOpCo, setFilterOpCo] = useState('all');
  const [filterCrewLead, setFilterCrewLead] = useState('all');
  const [filterStatus, setFilterStatus] = useState<WOStatus | 'all'>('all');
  const [searchText, setSearchText] = useState('');
  const [showDeferred, setShowDeferred] = useState(true);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = useMemo(() => {
    let list = [...workOrders];
    if (filterPriority !== 'all') list = list.filter(wo => wo.priority === filterPriority);
    if (filterOpCo !== 'all') list = list.filter(wo => wo.opCo === filterOpCo);
    if (filterCrewLead !== 'all') list = list.filter(wo => wo.crewLead === filterCrewLead);
    if (filterStatus !== 'all') list = list.filter(wo => wo.status === filterStatus);
    if (!showDeferred) list = list.filter(wo => wo.status !== 'deferred');
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter(wo =>
        wo.assetName.toLowerCase().includes(q) ||
        wo.id.toLowerCase().includes(q) ||
        wo.title.toLowerCase().includes(q) ||
        wo.substationName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [workOrders, filterPriority, filterOpCo, filterCrewLead, filterStatus, showDeferred, searchText]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      switch (sortField) {
        case 'priority': return dir * (PRIORITY_CONFIG[a.priority].sortOrder - PRIORITY_CONFIG[b.priority].sortOrder);
        case 'costIfDelayed': return dir * (a.costIfDelayed - b.costIfDelayed) * -1;
        case 'costIfEscalated': return dir * ((a.costIfEscalated ?? 0) - (b.costIfEscalated ?? 0)) * -1;
        case 'status': return dir * a.status.localeCompare(b.status);
        default: {
          const av = String(a[sortField] ?? '');
          const bv = String(b[sortField] ?? '');
          return dir * av.localeCompare(bv);
        }
      }
    });
  }, [filtered, sortField, sortAsc]);

  const opCos = useMemo(() => [...new Set(workOrders.map(w => w.opCo))].sort(), [workOrders]);
  const crewLeads = useMemo(() => [...new Set(workOrders.map(w => w.crewLead))].sort(), [workOrders]);

  const SortHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <button
      onClick={() => handleSort(field)}
      className={`flex items-center gap-0.5 text-[10px] uppercase tracking-wider font-medium text-white/30 hover:text-white/50 transition-colors ${className}`}
    >
      {children}
      {sortField === field && (sortAsc ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />)}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filters */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-b border-white/[0.04] flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-white/25">Priority</label>
          <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}
            className="text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/60 rounded px-1.5 py-1 outline-none focus:border-white/20">
            <option value="all">All</option>
            <option value="P1">P1</option><option value="P2">P2</option>
            <option value="P3">P3</option><option value="Routine">Routine</option>
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-white/25">OpCo</label>
          <select value={filterOpCo} onChange={e => setFilterOpCo(e.target.value)}
            className="text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/60 rounded px-1.5 py-1 outline-none focus:border-white/20">
            <option value="all">All</option>
            {opCos.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-white/25">Crew Lead</label>
          <select value={filterCrewLead} onChange={e => setFilterCrewLead(e.target.value)}
            className="text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/60 rounded px-1.5 py-1 outline-none focus:border-white/20">
            <option value="all">All</option>
            {crewLeads.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[10px] text-white/25">Status</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/60 rounded px-1.5 py-1 outline-none focus:border-white/20">
            <option value="all">All</option>
            <option value="in_progress">In Progress</option><option value="dispatched">Dispatched</option>
            <option value="en_route">En Route</option><option value="on_hold">On Hold</option>
            <option value="completed">Completed</option><option value="deferred">Deferred</option>
          </select>
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
          <input value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search asset or WO..."
            className="text-[11px] bg-white/[0.04] border border-white/[0.08] text-white/60 rounded pl-6 pr-2 py-1 w-44 outline-none focus:border-white/20 placeholder:text-white/15" />
        </div>
        <label className="flex items-center gap-1.5 text-[10px] text-white/30 cursor-pointer">
          <input type="checkbox" checked={showDeferred} onChange={e => setShowDeferred(e.target.checked)}
            className="w-3 h-3 accent-cyan-500 rounded" />
          Show Deferred
        </label>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="grid grid-cols-[56px_80px_1fr_160px_120px_120px_90px_90px_80px_70px] gap-0 px-5 py-2 border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10">
          <SortHeader field="priority">Pri</SortHeader>
          <SortHeader field="id">ID</SortHeader>
          <SortHeader field="title">Task</SortHeader>
          <SortHeader field="assetName">Asset</SortHeader>
          <SortHeader field="crewLead">Crew Lead</SortHeader>
          <SortHeader field="worker">Worker</SortHeader>
          <SortHeader field="status">Status</SortHeader>
          <SortHeader field="costIfDelayed">Cost</SortHeader>
          <SortHeader field="costIfEscalated">Escalated</SortHeader>
          <SortHeader field="timeSlot">Time</SortHeader>
        </div>

        {/* Rows */}
        {sorted.map(wo => {
          const pri = PRIORITY_CONFIG[wo.priority];
          const st = STATUS_CONFIG[wo.status];
          const isCompleted = wo.status === 'completed';
          const isDeferred = wo.status === 'deferred';
          const rowOpacity = isCompleted || isDeferred ? 'opacity-40' : '';

          return (
            <div
              key={wo.id}
              onClick={() => onSelectWO(wo)}
              className={`grid grid-cols-[56px_80px_1fr_160px_120px_120px_90px_90px_80px_70px] gap-0 px-5 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.03] cursor-pointer transition-colors ${rowOpacity} ${wo.isPlanChange ? 'border-l-2 border-l-cyan-500/40' : ''}`}
            >
              <div>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pri.bg} ${pri.color} border ${pri.border}`}>
                  {pri.label}
                </span>
              </div>
              <div className="text-[11px] text-white/40 tabular-nums">{wo.id.replace('WO-2026-', '')}</div>
              <div className="text-[11px] text-white/70 truncate pr-3">{wo.title}</div>
              <div className="text-[11px] text-white/50 truncate">{wo.assetName.split(' ').slice(0, 2).join(' ')}</div>
              <div className="text-[11px] text-white/40 truncate">{wo.crewLead.split(' ')[1]}</div>
              <div className="text-[11px] text-white/40 truncate">{wo.worker.split(' ').slice(-1)[0]}</div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                <span className={`text-[10px] ${st.color}`}>{st.label}</span>
              </div>
              <div className="text-[11px] text-white/50 tabular-nums">{formatCurrency(wo.costIfDelayed)}</div>
              <div className="text-[11px] text-white/30 tabular-nums">
                {wo.costIfEscalated != null ? formatCurrency(wo.costIfEscalated) : '—'}
                {wo.daysToEscalation != null && (
                  <span className="text-[9px] text-amber-400/40 ml-0.5">{wo.daysToEscalation}d</span>
                )}
              </div>
              <div className="text-[10px] text-white/30 tabular-nums">{wo.timeSlot.split('–')[0] || wo.timeSlot}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// GANTT RE-PLANNING VIEW
// ════════════════════════════════════════════════════════════════

const GANTT_HOURS = Array.from({ length: 13 }, (_, i) => i + 6);
const CREW_COLORS: Record<string, string> = {
  'Marcus Johnson': 'bg-sky-500/60 border-sky-400/40',
  'Patricia Williams': 'bg-violet-500/50 border-violet-400/40',
  'Raymond Scott': 'bg-emerald-500/50 border-emerald-400/40',
  'Thomas Anderson': 'bg-amber-500/50 border-amber-400/40',
};

function GanttView() {
  const [activeScenario, setActiveScenario] = useState<'legacy' | 'ai_optimized'>('ai_optimized');
  const [showChangesOnly, setShowChangesOnly] = useState(false);
  const [isReplanning, setIsReplanning] = useState(false);

  const scenario = GANTT_SCENARIOS.find(s => s.id === activeScenario)!;
  const legacy = GANTT_SCENARIOS.find(s => s.id === 'legacy')!;
  const ai = GANTT_SCENARIOS.find(s => s.id === 'ai_optimized')!;

  const tasks = showChangesOnly ? scenario.tasks.filter(t => t.isChanged) : scenario.tasks;

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.crewLead !== b.crewLead) return a.crewLead.localeCompare(b.crewLead);
    return a.startHour - b.startHour;
  });

  const handleReplan = () => {
    setIsReplanning(true);
    setTimeout(() => {
      setActiveScenario('ai_optimized');
      setIsReplanning(false);
    }, 2000);
  };

  const kpiDelta = (field: keyof typeof ai.kpis) => {
    return Number(ai.kpis[field]) - Number(legacy.kpis[field]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* KPI Comparison Bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.04] flex-shrink-0">
        <div className="flex items-center gap-2 mr-4">
          <button
            onClick={() => setActiveScenario('legacy')}
            className={`text-[11px] px-2.5 py-1 rounded transition-all ${activeScenario === 'legacy' ? 'bg-white/[0.08] text-white/80' : 'text-white/30 hover:text-white/50'}`}
          >Original</button>
          <button
            onClick={() => setActiveScenario('ai_optimized')}
            className={`text-[11px] px-2.5 py-1 rounded transition-all flex items-center gap-1 ${activeScenario === 'ai_optimized' ? 'bg-cyan-500/10 text-cyan-400/80 border border-cyan-500/20' : 'text-white/30 hover:text-white/50'}`}
          >
            <Sparkles className="w-3 h-3" />AI Optimized
          </button>
        </div>

        {[
          { label: 'Tasks', value: scenario.kpis.tasksCompleted + '/' + scenario.kpis.tasksTotal, delta: kpiDelta('tasksCompleted'), unit: '' },
          { label: 'P1 Complete', value: scenario.kpis.p1Completion + '%', delta: kpiDelta('p1Completion'), unit: 'pp' },
          { label: 'Travel', value: scenario.kpis.travelTimeMins + ' min', delta: kpiDelta('travelTimeMins'), unit: ' min', inverted: true },
          { label: 'Customers', value: formatNumber(scenario.kpis.customersProtected), delta: kpiDelta('customersProtected'), unit: '' },
          { label: 'Cost Avoided', value: formatCurrency(scenario.kpis.costAvoidance), delta: kpiDelta('costAvoidance'), unit: '' },
          { label: 'Utilization', value: scenario.kpis.crewUtilization + '%', delta: kpiDelta('crewUtilization'), unit: 'pp' },
        ].map(kpi => {
          const isPositive = kpi.inverted ? kpi.delta < 0 : kpi.delta > 0;
          const showDelta = activeScenario === 'ai_optimized' && kpi.delta !== 0;
          return (
            <div key={kpi.label} className="flex flex-col items-center min-w-0">
              <span className="text-[9px] text-white/25 uppercase tracking-wider">{kpi.label}</span>
              <span className="text-[13px] font-medium text-white/70 tabular-nums">{kpi.value}</span>
              {showDelta && (
                <span className={`text-[9px] tabular-nums ${isPositive ? 'text-emerald-400/60' : 'text-rose-400/60'}`}>
                  {kpi.delta > 0 ? '+' : ''}{kpi.inverted ? kpi.delta : kpi.delta}{kpi.unit}
                </span>
              )}
            </div>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-white/30 cursor-pointer">
            <input type="checkbox" checked={showChangesOnly} onChange={e => setShowChangesOnly(e.target.checked)}
              className="w-3 h-3 accent-cyan-500 rounded" />
            Changes only
          </label>
          <button
            onClick={handleReplan}
            disabled={isReplanning}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400/80 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all disabled:opacity-40"
          >
            {isReplanning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
            {isReplanning ? 'Re-planning...' : 'Re-plan'}
          </button>
        </div>
      </div>

      {/* Crew Legend */}
      <div className="flex items-center gap-4 px-5 py-1.5 border-b border-white/[0.03] flex-shrink-0">
        {CREW_LEADS.map(cl => (
          <div key={cl.id} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-sm ${CREW_COLORS[cl.name]?.split(' ')[0] || 'bg-white/20'}`} />
            <span className="text-[10px] text-white/35">{cl.name.split(' ')[1]} ({cl.opCo})</span>
          </div>
        ))}
      </div>

      {/* Gantt Chart */}
      <div className="flex-1 overflow-auto">
        {/* Time Header */}
        <div className="flex sticky top-0 z-10 bg-black border-b border-white/[0.06]">
          <div className="w-48 flex-shrink-0 px-3 py-1.5 text-[9px] text-white/20 uppercase tracking-wider">Worker</div>
          <div className="flex-1 flex">
            {GANTT_HOURS.map(h => (
              <div key={h} className="flex-1 text-center text-[9px] text-white/20 py-1.5 border-l border-white/[0.04]">
                {h <= 12 ? `${h} AM` : `${h - 12} PM`}
              </div>
            ))}
          </div>
        </div>

        {/* Task Rows */}
        {sortedTasks.map((task) => {
          const left = ((task.startHour - 6) / 12) * 100;
          const width = (task.durationHours / 12) * 100;
          const pri = PRIORITY_CONFIG[task.priority];
          const crewColor = CREW_COLORS[task.crewLead] || 'bg-white/20 border-white/10';

          return (
            <div key={task.id} className="flex border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group">
              <div className="w-48 flex-shrink-0 px-3 py-2 flex flex-col justify-center">
                <span className="text-[11px] text-white/60 truncate">{task.worker}</span>
                <span className="text-[9px] text-white/20 truncate">{task.crewLead.split(' ')[1]} · {task.assetName}</span>
              </div>
              <div className="flex-1 relative py-1.5">
                {GANTT_HOURS.map(h => (
                  <div key={h} className="absolute top-0 bottom-0 border-l border-white/[0.03]" style={{ left: `${((h - 6) / 12) * 100}%` }} />
                ))}
                {/* Now line (2 PM) */}
                <div className="absolute top-0 bottom-0 w-px bg-cyan-500/30 z-10" style={{ left: `${((14 - 6) / 12) * 100}%` }} />

                {/* Task Bar */}
                <div
                  className={`absolute top-1 bottom-1 rounded border ${crewColor} flex items-center px-2 gap-1 overflow-hidden cursor-pointer transition-all ${task.status === 'deferred' ? 'opacity-30 border-dashed' : ''} ${task.isChanged ? 'ring-1 ring-cyan-400/30' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%`, minWidth: '40px' }}
                  title={task.changeReason || task.assetName}
                >
                  <span className={`text-[9px] font-semibold ${pri.color} flex-shrink-0`}>{pri.label}</span>
                  <span className="text-[9px] text-white/70 truncate">{task.assetName}</span>
                  {task.isChanged && <Sparkles className="w-2.5 h-2.5 text-cyan-400/60 flex-shrink-0 ml-auto" />}
                </div>

                {/* Change reason tooltip on hover */}
                {task.isChanged && task.changeReason && (
                  <div className="absolute left-0 top-full mt-0.5 z-20 hidden group-hover:block">
                    <div className="bg-[#111] border border-cyan-500/20 rounded px-2 py-1 text-[9px] text-cyan-400/60 whitespace-nowrap shadow-lg ml-48">
                      <Sparkles className="w-2.5 h-2.5 inline mr-1" />{task.changeReason}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DISRUPTIONS SIDEBAR
// ════════════════════════════════════════════════════════════════

function DisruptionsSidebar() {
  const iconMap: Record<string, React.ReactNode> = {
    alert: <AlertTriangle className="w-3.5 h-3.5" />,
    weather: <CloudSnow className="w-3.5 h-3.5" />,
    crew: <Users className="w-3.5 h-3.5" />,
    vehicle: <Truck className="w-3.5 h-3.5" />,
    parts: <Package className="w-3.5 h-3.5" />,
    success: <Zap className="w-3.5 h-3.5" />,
  };

  const severityColor: Record<string, string> = {
    critical: 'text-rose-400/70',
    warning: 'text-amber-400/70',
    info: 'text-white/40',
    positive: 'text-emerald-400/70',
  };

  return (
    <div className="w-80 border-l border-white/[0.06] bg-[#0a0a0a] flex flex-col flex-shrink-0 overflow-hidden">
      <div className="p-3 border-b border-white/[0.04]">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-white/60 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400/50" />
            Disruptions
          </h3>
          <span className="text-[10px] text-white/25">{DISRUPTIONS.length} active</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {DISRUPTIONS.map(d => (
          <div key={d.id} className="p-3 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                <input type="checkbox" defaultChecked className="w-3 h-3 accent-cyan-500 rounded" />
                <span className={severityColor[d.severity]}>{iconMap[d.icon]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-white/70">{d.title}</span>
                </div>
                <p className="text-[10px] text-white/30 mt-0.5">{d.impact}</p>
                <p className="text-[10px] text-cyan-400/40 mt-1">{d.action}</p>
                <span className="text-[9px] text-white/15 mt-1 inline-block">{d.reportedAt}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// WORK ORDER DETAIL MODAL
// ════════════════════════════════════════════════════════════════

function WODetailModal({ wo, onClose }: { wo: DispatchWorkOrder; onClose: () => void }) {
  const pri = PRIORITY_CONFIG[wo.priority];
  const st = STATUS_CONFIG[wo.status];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0c0c0c] border border-white/[0.08] rounded-xl w-[560px] max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/[0.06]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${pri.bg} ${pri.color} border ${pri.border}`}>{pri.label}</span>
              <span className="text-[11px] text-white/30 tabular-nums">{wo.id}</span>
              <span className="text-[10px] text-white/15">·</span>
              <span className="text-[10px] text-white/25">{wo.opCo}</span>
            </div>
            <h3 className="text-sm font-medium text-white/85">{wo.title}</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-white/50 leading-relaxed">{wo.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3">
              <div className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Asset</div>
              <div className="text-[12px] text-white/70">{wo.assetName}</div>
              <div className="text-[10px] text-white/30">{wo.substationName}</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3">
              <div className="text-[9px] text-white/25 uppercase tracking-wider mb-1">Assignment</div>
              <div className="text-[12px] text-white/70">{wo.worker}</div>
              <div className="text-[10px] text-white/30">Lead: {wo.crewLead}</div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-[9px] text-white/25 uppercase mb-1">Status</div>
              <div className="flex items-center justify-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                <span className={`text-[11px] ${st.color}`}>{st.label}</span>
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-[9px] text-white/25 uppercase mb-1">Cost at Risk</div>
              <div className="text-[13px] font-medium text-white/80 tabular-nums">{formatCurrency(wo.costIfDelayed)}</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-[9px] text-white/25 uppercase mb-1">Escalated</div>
              <div className="text-[13px] font-medium text-white/80 tabular-nums">{wo.costIfEscalated ? formatCurrency(wo.costIfEscalated) : '—'}</div>
              {wo.daysToEscalation != null && <div className="text-[9px] text-amber-400/50">{wo.daysToEscalation} days</div>}
            </div>
            <div className="bg-white/[0.03] rounded-lg p-3 text-center">
              <div className="text-[9px] text-white/25 uppercase mb-1">Customers</div>
              <div className="text-[13px] font-medium text-white/80 tabular-nums">{formatNumber(wo.customersAtRisk)}</div>
            </div>
          </div>

          {wo.partsRequired.length > 0 && (
            <div>
              <div className="text-[10px] text-white/25 uppercase tracking-wider mb-1.5">Parts Required</div>
              <div className="flex flex-wrap gap-1.5">
                {wo.partsRequired.map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white/45">{p}</span>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
            <div className="text-[10px] text-white/25 flex items-center gap-1">
              <Clock className="w-3 h-3" />{wo.timeSlot}
            </div>
            <div className="text-[10px] text-white/25 flex items-center gap-1">
              <Timer className="w-3 h-3" />~{wo.estimatedHours}h
            </div>
            <div className="text-[10px] text-white/25 flex items-center gap-1">
              <Wrench className="w-3 h-3" />{wo.taskType}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-white/[0.06]">
          <Link href={`/transformer-iot?asset=${wo.assetTag}`}
            className="text-[11px] px-3 py-1.5 rounded bg-white/[0.06] text-cyan-400/70 hover:bg-cyan-500/10 transition-all flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />Asset Detail
          </Link>
          <button onClick={onClose} className="text-[11px] px-3 py-1.5 rounded bg-white/[0.06] text-white/50 hover:bg-white/[0.10] transition-all">Close</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PAGE
// ════════════════════════════════════════════════════════════════

export default function DispatchPage() {
  const router = useRouter();
  const [subView, setSubView] = useState<SubView>('today');
  const [selectedWO, setSelectedWO] = useState<DispatchWorkOrder | null>(null);

  const displayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="h-screen bg-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-white/[0.06] flex-shrink-0 bg-[#09090b]">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/30 hover:text-white/60 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <img src="/IFS%20NB.png" alt="IFS" className="h-5 opacity-60" />
          <span className="text-white/10">|</span>
          <h1 className="text-sm font-semibold text-white/80">Dispatch</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60 animate-pulse" />
          <span className="text-[10px] text-white/25">SCADA Live</span>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className="flex items-center gap-0 px-5 border-b border-white/[0.06] flex-shrink-0">
        {([
          { id: 'today', label: 'Today', icon: Clock },
          { id: 'replan', label: 'Re-Planning', icon: Calendar },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setSubView(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all ${
              subView === tab.id
                ? 'border-cyan-500/60 text-white/80'
                : 'border-transparent text-white/30 hover:text-white/50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* View Header + Event Ticker */}
      <div className="flex items-center px-5 py-3 border-b border-white/[0.06] flex-shrink-0">
        <h2 className="text-base font-semibold text-white/90 whitespace-nowrap">{displayDate}</h2>
        <EventFeedTicker />
      </div>

      {/* Stat Cards (Today view) */}
      {subView === 'today' && <StatCards stats={DISPATCH_STATS} />}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {subView === 'today' ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-2 border-b border-white/[0.04] flex-shrink-0">
              <h3 className="text-xs font-medium text-white/40 uppercase tracking-wider">Today&apos;s Work Orders</h3>
            </div>
            <TaskTable workOrders={DISPATCH_WORK_ORDERS} onSelectWO={setSelectedWO} />
          </div>
        ) : (
          <GanttView />
        )}

        {subView === 'replan' && <DisruptionsSidebar />}
      </div>

      {selectedWO && <WODetailModal wo={selectedWO} onClose={() => setSelectedWO(null)} />}
    </div>
  );
}
