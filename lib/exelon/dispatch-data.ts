/**
 * Exelon GridIQ Dispatch Data
 *
 * Utility-specific operational data for the dispatch/orchestration view.
 * Modeled after the Uptime Optimizer oil-field template but adapted
 * for transmission & distribution transformer maintenance operations.
 */

// ─── Types ─────────────────────────────────────────────────────────
export type WOPriority = 'P1' | 'P2' | 'P3' | 'Routine';
export type WOStatus = 'in_progress' | 'dispatched' | 'en_route' | 'on_hold' | 'completed' | 'deferred';
export type DisruptionSeverity = 'critical' | 'warning' | 'info' | 'positive';

export interface CrewLead {
  id: string;
  name: string;
  opCo: string;
  region: string;
  workers: CrewMember[];
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  certifications: string[];
  available: boolean;
  currentTaskId?: string;
}

export interface DispatchWorkOrder {
  id: string;
  priority: WOPriority;
  title: string;
  description: string;
  assetTag: string;
  assetName: string;
  substationName: string;
  opCo: string;
  crewLead: string;
  worker: string;
  status: WOStatus;
  detectedAt: string;
  detectedDaysAgo: number;
  timeSlot: string;
  isPlanChange: boolean;
  daysToEscalation: number | null;
  costIfDelayed: number;
  costIfEscalated: number | null;
  customersAtRisk: number;
  productionLossPerDay: number;
  taskType: string;
  partsRequired: string[];
  estimatedHours: number;
}

export interface Disruption {
  id: string;
  severity: DisruptionSeverity;
  title: string;
  impact: string;
  action: string;
  reportedAt: string;
  tasksAffected: number;
  icon: 'alert' | 'weather' | 'crew' | 'vehicle' | 'parts' | 'success';
}

export interface ScheduleScenario {
  id: string;
  label: string;
  tasks: GanttTask[];
  kpis: ScenarioKPIs;
}

export interface GanttTask {
  id: string;
  workOrderId: string;
  assetName: string;
  worker: string;
  crewLead: string;
  priority: WOPriority;
  startHour: number; // 0-24
  durationHours: number;
  status: WOStatus;
  isChanged?: boolean;
  changeReason?: string;
}

export interface ScenarioKPIs {
  tasksCompleted: number;
  tasksTotal: number;
  p1Completion: number;
  travelTimeMins: number;
  customersProtected: number;
  costAvoidance: number;
  crewUtilization: number;
}

export interface DispatchStats {
  gridReliability: { currentPct: number; previousPct: number; trend: string; trendDirection: 'up' | 'down' };
  openWorkOrders: { total: number; p1: number; p2: number; p3: number; routine: number; closedToday: number; trend: number };
  atRiskAssets: { count: number; previousCount: number; trend: string; trendDirection: 'up' | 'down'; customersExposed: number };
  costAvoidanceMTD: { amount: number; trend: string; trendDirection: 'up' | 'down' };
  completedToday: {
    p1: { completed: number; total: number };
    p2: { completed: number; total: number };
    p3: { completed: number; total: number };
    routine: { completed: number; total: number };
  };
  scheduleProgress: { completed: number; total: number; pct: number };
  escalationEconomics: { p2ToP1Multiplier: number; avgP1Cost: number; avgP2Cost: number; avgEscalationWindowDays: number };
}

// ─── Data ──────────────────────────────────────────────────────────

export const DISPATCH_STATS: DispatchStats = {
  gridReliability: { currentPct: 99.4, previousPct: 99.1, trend: '+0.3', trendDirection: 'up' },
  openWorkOrders: { total: 24, p1: 3, p2: 7, p3: 9, routine: 5, closedToday: 16, trend: -4 },
  atRiskAssets: { count: 6, previousCount: 9, trend: '-3', trendDirection: 'down', customersExposed: 356000 },
  costAvoidanceMTD: { amount: 2_840_000, trend: '+18%', trendDirection: 'up' },
  completedToday: {
    p1: { completed: 2, total: 3 },
    p2: { completed: 5, total: 7 },
    p3: { completed: 7, total: 9 },
    routine: { completed: 4, total: 5 },
  },
  scheduleProgress: { completed: 18, total: 24, pct: 75 },
  escalationEconomics: { p2ToP1Multiplier: 3.2, avgP1Cost: 285_000, avgP2Cost: 89_000, avgEscalationWindowDays: 5.6 },
};

export const CREW_LEADS: CrewLead[] = [
  {
    id: 'CL-001', name: 'Marcus Johnson', opCo: 'BGE', region: 'Central Maryland',
    workers: [
      { id: 'W-001', name: 'David Chen', role: 'Sr. Transformer Tech', certifications: ['DGA', 'HV Switching', 'LOTO'], available: true },
      { id: 'W-002', name: 'Sarah Mitchell', role: 'Substation Electrician', certifications: ['HV Switching', 'Relay Testing', 'LOTO'], available: true, currentTaskId: 'WO-2026-003' },
      { id: 'W-003', name: 'James Parker', role: 'Field Technician', certifications: ['Oil Sampling', 'Thermal Scan'], available: true },
      { id: 'W-004', name: 'Maria Rodriguez', role: 'Apprentice Lineworker', certifications: ['LOTO'], available: false },
    ],
  },
  {
    id: 'CL-002', name: 'Patricia Williams', opCo: 'ComEd', region: 'Northern Illinois',
    workers: [
      { id: 'W-005', name: 'Robert Kim', role: 'Sr. Transformer Tech', certifications: ['DGA', 'HV Switching', 'LOTO', 'Bushing Replacement'], available: true },
      { id: 'W-006', name: 'Angela Foster', role: 'Relay Protection Tech', certifications: ['Relay Testing', 'SCADA', 'HV Switching'], available: true, currentTaskId: 'WO-2026-006' },
      { id: 'W-007', name: 'Michael Torres', role: 'Substation Electrician', certifications: ['HV Switching', 'Tap Changer', 'LOTO'], available: true },
      { id: 'W-008', name: 'Kevin Washington', role: 'Field Technician', certifications: ['Oil Sampling', 'Thermal Scan'], available: true },
    ],
  },
  {
    id: 'CL-003', name: 'Raymond Scott', opCo: 'Pepco', region: 'DC Metro',
    workers: [
      { id: 'W-009', name: 'Lisa Chang', role: 'Sr. Transformer Tech', certifications: ['DGA', 'HV Switching', 'LOTO', 'Underground'], available: true, currentTaskId: 'WO-2026-001' },
      { id: 'W-010', name: 'William Harris', role: 'Substation Electrician', certifications: ['HV Switching', 'Cable Testing'], available: true },
      { id: 'W-011', name: 'Jennifer White', role: 'Field Technician', certifications: ['Oil Sampling', 'Thermal Scan', 'LOTO'], available: false },
    ],
  },
  {
    id: 'CL-004', name: 'Thomas Anderson', opCo: 'PECO', region: 'SE Pennsylvania',
    workers: [
      { id: 'W-012', name: 'Christopher Lee', role: 'Sr. Transformer Tech', certifications: ['DGA', 'HV Switching', 'LOTO', 'Bushing Replacement'], available: true },
      { id: 'W-013', name: 'Amanda Brooks', role: 'Substation Electrician', certifications: ['HV Switching', 'Relay Testing'], available: true, currentTaskId: 'WO-2026-009' },
      { id: 'W-014', name: 'Daniel Nguyen', role: 'Field Technician', certifications: ['Oil Sampling', 'Thermal Scan'], available: true },
    ],
  },
];

export const DISPATCH_WORK_ORDERS: DispatchWorkOrder[] = [
  // ── P1 Critical ──
  {
    id: 'WO-2026-001', priority: 'P1',
    title: 'Emergency DGA exceedance — acetylene spike detected',
    description: 'Online DGA monitor triggered Condition 4 alarm. Acetylene at 142 ppm (threshold: 35 ppm). Duval Triangle indicates D1 thermal fault. Immediate oil sampling and load reduction required.',
    assetTag: 'BGE-TF-001', assetName: 'Westport 230/115kV Auto-Transformer #1',
    substationName: 'Westport Substation', opCo: 'BGE',
    crewLead: 'Marcus Johnson', worker: 'Lisa Chang',
    status: 'in_progress', detectedAt: 'Today 5:22 AM', detectedDaysAgo: 0,
    timeSlot: '06:00–12:00', isPlanChange: true,
    daysToEscalation: null, costIfDelayed: 1_850_000, costIfEscalated: null,
    customersAtRisk: 72000, productionLossPerDay: 0,
    taskType: 'Emergency DGA Response', partsRequired: ['Oil sampling kit', 'Portable DGA analyzer'],
    estimatedHours: 6,
  },
  {
    id: 'WO-2026-002', priority: 'P1',
    title: 'Bushing oil leak — B-phase, active seepage',
    description: 'Field inspection confirmed active oil seepage on B-phase HV bushing. Oil level dropping. Bushing power factor test needed. Risk of flashover if unaddressed.',
    assetTag: 'COMED-TF-004', assetName: 'Electric Junction 345/138kV Transformer #3',
    substationName: 'Electric Junction', opCo: 'ComEd',
    crewLead: 'Patricia Williams', worker: 'Robert Kim',
    status: 'dispatched', detectedAt: 'Today 4:15 AM', detectedDaysAgo: 0,
    timeSlot: '07:00–15:00', isPlanChange: true,
    daysToEscalation: null, costIfDelayed: 2_200_000, costIfEscalated: null,
    customersAtRisk: 65000, productionLossPerDay: 0,
    taskType: 'Emergency Bushing Repair', partsRequired: ['ABB GOB bushing (345kV)', 'Gasket kit', 'Insulating oil (200L)'],
    estimatedHours: 8,
  },
  {
    id: 'WO-2026-003', priority: 'P1',
    title: 'Cooling fan failure — all fans offline, load at 88%',
    description: 'SCADA alarm: all OFAF cooling fans offline at Calvert Cliffs GSU. Top-oil temp rising. Manual cooling required while fans are repaired. Load transfer may be needed.',
    assetTag: 'BGE-TF-003', assetName: 'Calvert Cliffs 500/230kV Transformer #1',
    substationName: 'Calvert Cliffs Switchyard', opCo: 'BGE',
    crewLead: 'Marcus Johnson', worker: 'Sarah Mitchell',
    status: 'in_progress', detectedAt: 'Today 6:45 AM', detectedDaysAgo: 0,
    timeSlot: '07:00–13:00', isPlanChange: true,
    daysToEscalation: null, costIfDelayed: 3_400_000, costIfEscalated: null,
    customersAtRisk: 120000, productionLossPerDay: 0,
    taskType: 'Emergency Cooling Repair', partsRequired: ['OFAF fan motor (700 MVA class)', 'Fan blade assembly', 'Control relay'],
    estimatedHours: 6,
  },

  // ── P2 High ──
  {
    id: 'WO-2026-004', priority: 'P2',
    title: 'OLTC tap changer — contact wear exceeding threshold',
    description: 'Tap changer contact resistance rising. Last maintenance 18 months ago. OEM recommends service at 10,000 operations — currently at 9,400.',
    assetTag: 'COMED-TF-001', assetName: 'Crawford 345/138kV Auto-Transformer #1',
    substationName: 'Crawford Substation', opCo: 'ComEd',
    crewLead: 'Patricia Williams', worker: 'Michael Torres',
    status: 'dispatched', detectedAt: '2 days ago', detectedDaysAgo: 2,
    timeSlot: '08:00–14:00', isPlanChange: false,
    daysToEscalation: 5, costIfDelayed: 420_000, costIfEscalated: 1_340_000,
    customersAtRisk: 85000, productionLossPerDay: 0,
    taskType: 'Tap Changer Service', partsRequired: ['OLTC contact set', 'Diverter switch gaskets', 'Selector oil filter'],
    estimatedHours: 6,
  },
  {
    id: 'WO-2026-005', priority: 'P2',
    title: 'Hot-spot temperature alarm — winding temp +12°C above normal',
    description: 'Fiber optic winding temperature sensors show sustained +12°C delta. Load factor at 76%. Thermal scan and oil test recommended to assess insulation condition.',
    assetTag: 'PEPCO-TF-001', assetName: 'Benning Road 230/69kV Transformer #2',
    substationName: 'Benning Road Substation', opCo: 'Pepco',
    crewLead: 'Raymond Scott', worker: 'William Harris',
    status: 'en_route', detectedAt: '1 day ago', detectedDaysAgo: 1,
    timeSlot: '09:00–13:00', isPlanChange: false,
    daysToEscalation: 4, costIfDelayed: 380_000, costIfEscalated: 1_200_000,
    customersAtRisk: 62000, productionLossPerDay: 0,
    taskType: 'Thermal Investigation', partsRequired: ['IR camera', 'Oil sampling kit', 'Temperature probes'],
    estimatedHours: 4,
  },
  {
    id: 'WO-2026-006', priority: 'P2',
    title: 'Protection relay miscalibration — Zone 2 timer drift',
    description: 'Relay test revealed Zone 2 distance relay timer has drifted 15ms beyond tolerance. Risk of sympathetic tripping on adjacent feeder fault.',
    assetTag: 'COMED-SS-001', assetName: 'Fisk Substation',
    substationName: 'Fisk Substation', opCo: 'ComEd',
    crewLead: 'Patricia Williams', worker: 'Angela Foster',
    status: 'in_progress', detectedAt: '3 days ago', detectedDaysAgo: 3,
    timeSlot: '08:00–12:00', isPlanChange: false,
    daysToEscalation: 3, costIfDelayed: 220_000, costIfEscalated: 890_000,
    customersAtRisk: 150000, productionLossPerDay: 0,
    taskType: 'Relay Calibration', partsRequired: ['SEL-421 test set', 'Calibration firmware'],
    estimatedHours: 4,
  },
  {
    id: 'WO-2026-007', priority: 'P2',
    title: 'Oil moisture content elevated — 28 ppm (limit: 20 ppm)',
    description: 'Quarterly oil analysis shows moisture at 28 ppm in main tank. Accelerated cellulose degradation risk. Online drying recommended.',
    assetTag: 'PECO-TF-001', assetName: 'Plymouth Meeting 230/69kV Transformer #1',
    substationName: 'Plymouth Meeting Substation', opCo: 'PECO',
    crewLead: 'Thomas Anderson', worker: 'Christopher Lee',
    status: 'dispatched', detectedAt: '4 days ago', detectedDaysAgo: 4,
    timeSlot: '07:30–15:30', isPlanChange: false,
    daysToEscalation: 6, costIfDelayed: 310_000, costIfEscalated: 950_000,
    customersAtRisk: 55000, productionLossPerDay: 0,
    taskType: 'Oil Processing', partsRequired: ['Mobile oil processing unit', 'Fuller\'s earth filters', 'Vacuum dehydrator hoses'],
    estimatedHours: 8,
  },
  {
    id: 'WO-2026-008', priority: 'P2',
    title: 'Surge arrester leakage current trending up',
    description: 'Continuous leakage current monitoring shows 150% increase over 6 months on A-phase surge arrester. Risk of arrester failure during next switching surge.',
    assetTag: 'ACE-TF-001', assetName: 'Cardiff 230/69kV Transformer #1',
    substationName: 'Cardiff Substation', opCo: 'ACE',
    crewLead: 'Marcus Johnson', worker: 'James Parker',
    status: 'on_hold', detectedAt: '5 days ago', detectedDaysAgo: 5,
    timeSlot: '10:00–14:00', isPlanChange: false,
    daysToEscalation: 7, costIfDelayed: 180_000, costIfEscalated: 640_000,
    customersAtRisk: 52000, productionLossPerDay: 0,
    taskType: 'Surge Arrester Testing', partsRequired: ['230kV surge arrester (ABB PEXLIM)', 'Leakage current analyzer'],
    estimatedHours: 4,
  },
  {
    id: 'WO-2026-009', priority: 'P2',
    title: 'Underground cable partial discharge detected',
    description: 'PD monitoring on 69kV feeder cable from Capitol Hill substation shows recurring activity. Possible joint degradation. TDR test required.',
    assetTag: 'PEPCO-SS-001', assetName: 'Capitol Hill Substation',
    substationName: 'Capitol Hill Substation', opCo: 'Pepco',
    crewLead: 'Raymond Scott', worker: 'Lisa Chang',
    status: 'deferred', detectedAt: '6 days ago', detectedDaysAgo: 6,
    timeSlot: '—', isPlanChange: false,
    daysToEscalation: 4, costIfDelayed: 520_000, costIfEscalated: 1_800_000,
    customersAtRisk: 80000, productionLossPerDay: 0,
    taskType: 'Cable Testing', partsRequired: ['PD detector', 'TDR unit', 'Cable splice kit (standby)'],
    estimatedHours: 6,
  },

  // ── P3 Medium ──
  {
    id: 'WO-2026-010', priority: 'P3',
    title: 'Scheduled DGA oil sampling — quarterly',
    description: 'Routine quarterly DGA sampling. Last sample showed stable gas levels. Trending review required.',
    assetTag: 'PECO-TF-002', assetName: 'Eddystone 230/69kV Transformer #2',
    substationName: 'Eddystone Substation', opCo: 'PECO',
    crewLead: 'Thomas Anderson', worker: 'Daniel Nguyen',
    status: 'dispatched', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '09:00–11:00', isPlanChange: false,
    daysToEscalation: 14, costIfDelayed: 45_000, costIfEscalated: 180_000,
    customersAtRisk: 38000, productionLossPerDay: 0,
    taskType: 'DGA Sampling', partsRequired: ['Oil sampling kit', 'Sample bottles (6)'],
    estimatedHours: 2,
  },
  {
    id: 'WO-2026-011', priority: 'P3',
    title: 'Infrared thermography scan — annual',
    description: 'Annual IR scan of all HV connections, bushings, and cable terminations. Compare with baseline from last year.',
    assetTag: 'DPL-TF-001', assetName: 'Indian River 230/69kV Transformer #1',
    substationName: 'Indian River Substation', opCo: 'DPL',
    crewLead: 'Marcus Johnson', worker: 'James Parker',
    status: 'dispatched', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '10:00–14:00', isPlanChange: false,
    daysToEscalation: 21, costIfDelayed: 25_000, costIfEscalated: 95_000,
    customersAtRisk: 48000, productionLossPerDay: 0,
    taskType: 'Thermal Scan', partsRequired: ['IR camera (FLIR T640)', 'Baseline report binder'],
    estimatedHours: 4,
  },
  {
    id: 'WO-2026-012', priority: 'P3',
    title: 'Battery bank capacity test — 125VDC station service',
    description: 'Scheduled capacity test on station battery bank. Last test showed 82% capacity. IEEE 450 recommends replacement at 80%.',
    assetTag: 'ACE-SS-001', assetName: 'Lewis Substation',
    substationName: 'Lewis Substation', opCo: 'ACE',
    crewLead: 'Thomas Anderson', worker: 'Amanda Brooks',
    status: 'en_route', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '08:00–16:00', isPlanChange: false,
    daysToEscalation: 30, costIfDelayed: 35_000, costIfEscalated: 120_000,
    customersAtRisk: 95000, productionLossPerDay: 0,
    taskType: 'Battery Test', partsRequired: ['Battery load tester', 'Impedance analyzer', 'Replacement cells (4) standby'],
    estimatedHours: 8,
  },
  {
    id: 'WO-2026-013', priority: 'P3',
    title: 'Grounding grid resistance test',
    description: 'Annual ground grid testing. Fall-of-potential method per IEEE 81. Critical for safety clearance renewal.',
    assetTag: 'BGE-SS-001', assetName: 'Canton Substation',
    substationName: 'Canton Substation', opCo: 'BGE',
    crewLead: 'Marcus Johnson', worker: 'David Chen',
    status: 'completed', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '07:00–11:00', isPlanChange: false,
    daysToEscalation: 45, costIfDelayed: 15_000, costIfEscalated: 55_000,
    customersAtRisk: 45000, productionLossPerDay: 0,
    taskType: 'Ground Grid Test', partsRequired: ['Ground resistance tester', 'Current probes', 'Potential leads (200m)'],
    estimatedHours: 4,
  },

  // ── Routine ──
  {
    id: 'WO-2026-014', priority: 'Routine',
    title: 'Vegetation management — right-of-way clearing',
    description: 'Quarterly vegetation inspection and trimming around substation perimeter and incoming transmission corridor.',
    assetTag: 'COMED-TF-002', assetName: 'Waukegan 138/34.5kV Transformer #2',
    substationName: 'Waukegan Substation', opCo: 'ComEd',
    crewLead: 'Patricia Williams', worker: 'Kevin Washington',
    status: 'completed', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '07:00–15:00', isPlanChange: false,
    daysToEscalation: null, costIfDelayed: 8_000, costIfEscalated: null,
    customersAtRisk: 42000, productionLossPerDay: 0,
    taskType: 'Vegetation Management', partsRequired: [],
    estimatedHours: 8,
  },
  {
    id: 'WO-2026-015', priority: 'Routine',
    title: 'Oil level check and conservator inspection',
    description: 'Monthly visual inspection of oil levels, conservator tank, Buchholz relay, and PRV. Record readings.',
    assetTag: 'DPL-TF-002', assetName: 'Edge Moor 138/69kV Auto-Transformer',
    substationName: 'Edge Moor Substation', opCo: 'DPL',
    crewLead: 'Thomas Anderson', worker: 'Daniel Nguyen',
    status: 'completed', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '09:00–11:00', isPlanChange: false,
    daysToEscalation: null, costIfDelayed: 5_000, costIfEscalated: null,
    customersAtRisk: 31000, productionLossPerDay: 0,
    taskType: 'Visual Inspection', partsRequired: [],
    estimatedHours: 2,
  },
  {
    id: 'WO-2026-016', priority: 'Routine',
    title: 'Substation security audit and camera check',
    description: 'Monthly NERC CIP-014 physical security audit. Verify cameras, fencing, access logs, and lighting.',
    assetTag: 'COMED-SS-001', assetName: 'Fisk Substation',
    substationName: 'Fisk Substation', opCo: 'ComEd',
    crewLead: 'Patricia Williams', worker: 'Kevin Washington',
    status: 'dispatched', detectedAt: 'Scheduled', detectedDaysAgo: 0,
    timeSlot: '13:00–15:00', isPlanChange: false,
    daysToEscalation: null, costIfDelayed: 12_000, costIfEscalated: null,
    customersAtRisk: 150000, productionLossPerDay: 0,
    taskType: 'Security Audit', partsRequired: [],
    estimatedHours: 2,
  },
];

export const DISRUPTIONS: Disruption[] = [
  {
    id: 'D-001', severity: 'critical', icon: 'alert',
    title: 'DGA Condition 4 at Westport 230kV',
    impact: '72,000 customers at risk · 2 routine tasks bumped',
    action: 'Emergency dispatch. Oil sampling in progress. Load reduced to 65%.',
    reportedAt: '5:22 AM', tasksAffected: 3,
  },
  {
    id: 'D-002', severity: 'critical', icon: 'alert',
    title: 'Cooling failure at Calvert Cliffs 500kV GSU',
    impact: '120,000 customers · load at 88% with no forced cooling',
    action: 'Emergency fan repair dispatched. Mobile cooling unit en route.',
    reportedAt: '6:45 AM', tasksAffected: 2,
  },
  {
    id: 'D-003', severity: 'warning', icon: 'crew',
    title: '2 technicians called out sick',
    impact: '6 tasks need reassignment across BGE and Pepco',
    action: 'Redistribute to available crew. Defer 2 routine inspections.',
    reportedAt: '6:15 AM', tasksAffected: 6,
  },
  {
    id: 'D-004', severity: 'warning', icon: 'weather',
    title: 'Ice storm warning — Delmarva Peninsula',
    impact: 'DPL substations at risk · 2 field tasks unsafe',
    action: 'Defer Indian River and Edge Moor outdoor work. Pre-position restoration crews.',
    reportedAt: 'Yesterday 10:45 PM', tasksAffected: 2,
  },
  {
    id: 'D-005', severity: 'warning', icon: 'parts',
    title: 'ABB GOB bushing backordered — 8 week lead time',
    description: '345kV bushing for Electric Junction replacement unavailable from primary supplier.',
    impact: '3 tasks may be delayed at ComEd',
    action: 'Source from ABB emergency stock in Jefferson City. ETA 48 hours.',
    reportedAt: 'Yesterday 4:30 PM', tasksAffected: 3,
  },
  {
    id: 'D-006', severity: 'positive', icon: 'success',
    title: 'Canton ground grid test completed ahead of schedule',
    impact: 'Crew freed up 2 hours early for reassignment',
    action: 'Marcus Johnson crew reassigned to Cardiff surge arrester testing.',
    reportedAt: '11:15 AM', tasksAffected: 0,
  },
];

export const GANTT_SCENARIOS: ScheduleScenario[] = [
  {
    id: 'legacy', label: 'Original Schedule',
    kpis: {
      tasksCompleted: 16, tasksTotal: 24, p1Completion: 67,
      travelTimeMins: 340, customersProtected: 285_000,
      costAvoidance: 1_920_000, crewUtilization: 72,
    },
    tasks: [
      { id: 'G-01', workOrderId: 'WO-2026-001', assetName: 'Westport 230kV', worker: 'Lisa Chang', crewLead: 'Marcus Johnson', priority: 'P1', startHour: 6, durationHours: 6, status: 'in_progress' },
      { id: 'G-02', workOrderId: 'WO-2026-002', assetName: 'Electric Jct 345kV', worker: 'Robert Kim', crewLead: 'Patricia Williams', priority: 'P1', startHour: 7, durationHours: 8, status: 'dispatched' },
      { id: 'G-03', workOrderId: 'WO-2026-003', assetName: 'Calvert Cliffs 500kV', worker: 'Sarah Mitchell', crewLead: 'Marcus Johnson', priority: 'P1', startHour: 7, durationHours: 6, status: 'in_progress' },
      { id: 'G-04', workOrderId: 'WO-2026-004', assetName: 'Crawford 345kV', worker: 'Michael Torres', crewLead: 'Patricia Williams', priority: 'P2', startHour: 8, durationHours: 6, status: 'dispatched' },
      { id: 'G-05', workOrderId: 'WO-2026-005', assetName: 'Benning Road 230kV', worker: 'William Harris', crewLead: 'Raymond Scott', priority: 'P2', startHour: 9, durationHours: 4, status: 'en_route' },
      { id: 'G-06', workOrderId: 'WO-2026-006', assetName: 'Fisk Substation', worker: 'Angela Foster', crewLead: 'Patricia Williams', priority: 'P2', startHour: 8, durationHours: 4, status: 'in_progress' },
      { id: 'G-07', workOrderId: 'WO-2026-007', assetName: 'Plymouth Meeting 230kV', worker: 'Christopher Lee', crewLead: 'Thomas Anderson', priority: 'P2', startHour: 7.5, durationHours: 8, status: 'dispatched' },
      { id: 'G-08', workOrderId: 'WO-2026-010', assetName: 'Eddystone 230kV', worker: 'Daniel Nguyen', crewLead: 'Thomas Anderson', priority: 'P3', startHour: 9, durationHours: 2, status: 'dispatched' },
      { id: 'G-09', workOrderId: 'WO-2026-011', assetName: 'Indian River 230kV', worker: 'James Parker', crewLead: 'Marcus Johnson', priority: 'P3', startHour: 10, durationHours: 4, status: 'dispatched' },
      { id: 'G-10', workOrderId: 'WO-2026-012', assetName: 'Lewis Substation', worker: 'Amanda Brooks', crewLead: 'Thomas Anderson', priority: 'P3', startHour: 8, durationHours: 8, status: 'en_route' },
      { id: 'G-11', workOrderId: 'WO-2026-013', assetName: 'Canton Substation', worker: 'David Chen', crewLead: 'Marcus Johnson', priority: 'P3', startHour: 7, durationHours: 4, status: 'completed' },
      { id: 'G-12', workOrderId: 'WO-2026-014', assetName: 'Waukegan 138kV', worker: 'Kevin Washington', crewLead: 'Patricia Williams', priority: 'Routine', startHour: 7, durationHours: 8, status: 'completed' },
    ],
  },
  {
    id: 'ai_optimized', label: 'AI-Optimized Schedule',
    kpis: {
      tasksCompleted: 20, tasksTotal: 24, p1Completion: 100,
      travelTimeMins: 210, customersProtected: 445_000,
      costAvoidance: 2_840_000, crewUtilization: 91,
    },
    tasks: [
      { id: 'G-01', workOrderId: 'WO-2026-001', assetName: 'Westport 230kV', worker: 'Lisa Chang', crewLead: 'Marcus Johnson', priority: 'P1', startHour: 6, durationHours: 6, status: 'in_progress', isChanged: true, changeReason: 'Priority escalated — dispatched 30 min earlier' },
      { id: 'G-02', workOrderId: 'WO-2026-002', assetName: 'Electric Jct 345kV', worker: 'Robert Kim', crewLead: 'Patricia Williams', priority: 'P1', startHour: 6.5, durationHours: 8, status: 'dispatched', isChanged: true, changeReason: 'Moved up 30 min, parts sourced from emergency stock' },
      { id: 'G-03', workOrderId: 'WO-2026-003', assetName: 'Calvert Cliffs 500kV', worker: 'David Chen', crewLead: 'Marcus Johnson', priority: 'P1', startHour: 6.5, durationHours: 6, status: 'in_progress', isChanged: true, changeReason: 'Reassigned from David Chen (ground test done early) → freed Sarah Mitchell for P2' },
      { id: 'G-04', workOrderId: 'WO-2026-004', assetName: 'Crawford 345kV', worker: 'Michael Torres', crewLead: 'Patricia Williams', priority: 'P2', startHour: 7, durationHours: 6, status: 'dispatched', isChanged: true, changeReason: 'Started 1hr earlier — escalation risk in 5 days' },
      { id: 'G-05', workOrderId: 'WO-2026-005', assetName: 'Benning Road 230kV', worker: 'William Harris', crewLead: 'Raymond Scott', priority: 'P2', startHour: 8, durationHours: 4, status: 'en_route', isChanged: true, changeReason: 'Shifted 1hr earlier to avoid afternoon heat load peak' },
      { id: 'G-06', workOrderId: 'WO-2026-006', assetName: 'Fisk Substation', worker: 'Angela Foster', crewLead: 'Patricia Williams', priority: 'P2', startHour: 7, durationHours: 4, status: 'in_progress', isChanged: true, changeReason: 'Moved up 1hr — 150K customers exposed to relay misop' },
      { id: 'G-07', workOrderId: 'WO-2026-007', assetName: 'Plymouth Meeting 230kV', worker: 'Christopher Lee', crewLead: 'Thomas Anderson', priority: 'P2', startHour: 7, durationHours: 8, status: 'dispatched' },
      { id: 'G-08', workOrderId: 'WO-2026-008', assetName: 'Cardiff 230kV', worker: 'James Parker', crewLead: 'Marcus Johnson', priority: 'P2', startHour: 12, durationHours: 4, status: 'dispatched', isChanged: true, changeReason: 'Added — was on hold. Marcus crew free after Canton early finish' },
      { id: 'G-09', workOrderId: 'WO-2026-010', assetName: 'Eddystone 230kV', worker: 'Daniel Nguyen', crewLead: 'Thomas Anderson', priority: 'P3', startHour: 8, durationHours: 2, status: 'dispatched', isChanged: true, changeReason: 'Moved earlier — Daniel routed efficiently after Edge Moor' },
      { id: 'G-10', workOrderId: 'WO-2026-011', assetName: 'Indian River 230kV', worker: 'James Parker', crewLead: 'Marcus Johnson', priority: 'P3', startHour: 10, durationHours: 4, status: 'deferred', isChanged: true, changeReason: 'Deferred — ice storm warning on Delmarva' },
      { id: 'G-11', workOrderId: 'WO-2026-012', assetName: 'Lewis Substation', worker: 'Amanda Brooks', crewLead: 'Thomas Anderson', priority: 'P3', startHour: 8, durationHours: 8, status: 'en_route' },
      { id: 'G-12', workOrderId: 'WO-2026-013', assetName: 'Canton Substation', worker: 'David Chen', crewLead: 'Marcus Johnson', priority: 'P3', startHour: 6.5, durationHours: 3.5, status: 'completed', isChanged: true, changeReason: 'Completed early — crew reassigned to Calvert Cliffs P1' },
      { id: 'G-13', workOrderId: 'WO-2026-009', assetName: 'Capitol Hill UG', worker: 'Sarah Mitchell', crewLead: 'Raymond Scott', priority: 'P2', startHour: 13, durationHours: 5, status: 'dispatched', isChanged: true, changeReason: 'Added — Sarah freed after Calvert Cliffs reassignment. 80K customers at risk.' },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

export function getCrewLeadByName(name: string): CrewLead | undefined {
  return CREW_LEADS.find(c => c.name === name);
}

export function getWorkOrdersByPriority(priority: WOPriority): DispatchWorkOrder[] {
  return DISPATCH_WORK_ORDERS.filter(wo => wo.priority === priority);
}

export function getWorkOrdersByOpCo(opCo: string): DispatchWorkOrder[] {
  return DISPATCH_WORK_ORDERS.filter(wo => wo.opCo === opCo);
}

export function getWorkOrdersByCrewLead(name: string): DispatchWorkOrder[] {
  return DISPATCH_WORK_ORDERS.filter(wo => wo.crewLead === name);
}

export function getWorkOrdersByStatus(status: WOStatus): DispatchWorkOrder[] {
  return DISPATCH_WORK_ORDERS.filter(wo => wo.status === status);
}
