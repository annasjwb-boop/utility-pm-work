/**
 * Asset Bridge — connects Risk Intelligence map assets to IoT + Grid IQ views.
 *
 * Takes a SubstationAsset (from risk-intelligence-data) and synthesizes:
 *   - ExelonAsset record (for transformer-iot page)
 *   - TransformerHealthRecord[] time series (for DGA charts, sensor data)
 *   - GridIQ TreeCluster + scenario data (for diagnostic tree)
 *
 * All data is deterministically seeded from the asset tag so it's stable across page loads.
 */

import { generateFleet, OPCOS, type SubstationAsset } from './risk-intelligence-data';
import type { ExelonAsset } from './fleet';
import type { TransformerHealthRecord } from '@/lib/datasets/transformer-health';

// ── Seeded RNG (same as risk-intelligence-data) ──
function seededRng(seed: number) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

function tagToSeed(tag: string): number {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

// ── Cached fleet ──
let _fleet: SubstationAsset[] | null = null;
function getFleet(): SubstationAsset[] {
  if (!_fleet) _fleet = generateFleet().assets;
  return _fleet;
}

export function getSubstationAsset(tag: string): SubstationAsset | null {
  return getFleet().find(a => a.tag === tag) || null;
}

export function getCriticalAssets(): SubstationAsset[] {
  return getFleet().filter(a => a.health < 50);
}

// ══════════════════════════════════════════════════════════════════
// EXELON ASSET SYNTHESIS
// ══════════════════════════════════════════════════════════════════

const MANUFACTURERS = ['ABB', 'GE Prolec', 'Siemens', 'Westinghouse', 'Hitachi Energy', 'Hyundai', 'ERMCO', 'Virginia Transformer'];
const COOLING_TYPES = ['ONAN', 'ONAF', 'ONAN/ONAF', 'OFAF', 'ODAF'];
const SUBTYPES = ['Auto-Transformer', 'Power Transformer', 'Station Transformer', 'GSU Transformer'];

export function synthesizeExelonAsset(a: SubstationAsset): ExelonAsset {
  const rng = seededRng(tagToSeed(a.tag));
  const kvNum = parseFloat(a.kv);
  const mva = kvNum >= 345 ? 200 + Math.floor(rng() * 300) : kvNum >= 138 ? 60 + Math.floor(rng() * 140) : kvNum >= 69 ? 20 + Math.floor(rng() * 40) : 5 + Math.floor(rng() * 20);

  return {
    assetTag: a.tag,
    name: a.name,
    type: 'power_transformer',
    subType: SUBTYPES[Math.floor(rng() * SUBTYPES.length)],
    opCo: a.opco,
    substationName: a.name.replace(/ \d+(\.\d+)?kV$| Sub #\d+$/, ''),
    position: { lat: a.lat, lng: a.lng },
    voltageClassKV: kvNum,
    ratedMVA: mva,
    yearInstalled: new Date().getFullYear() - a.age,
    manufacturer: MANUFACTURERS[Math.floor(rng() * MANUFACTURERS.length)],
    model: `T-${Math.floor(rng() * 900 + 100)}${String.fromCharCode(65 + Math.floor(rng() * 6))}`,
    coolingType: COOLING_TYPES[Math.floor(rng() * COOLING_TYPES.length)],
    status: a.health < 30 ? 'alert' : 'operational',
    healthIndex: a.health,
    loadFactor: a.load,
    customersServed: a.customers,
    criticality: a.health < 30 ? 'critical' : a.health < 50 ? 'major' : 'standard',
    specs: {
      oilVolumeLiters: Math.floor(mva * 40 + rng() * 2000),
      weight: Math.floor(mva * 200 + rng() * 10000),
      tapChangerType: rng() > 0.5 ? 'OLTC' : 'DETC',
      bushingType: rng() > 0.5 ? 'OIP' : 'RIP',
      serialNumber: `SN-${a.tag.replace(/-/g, '')}-${Math.floor(rng() * 9000 + 1000)}`,
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// HEALTH RECORD SYNTHESIS (4-quarter time series)
// ══════════════════════════════════════════════════════════════════

export function synthesizeHealthRecords(a: SubstationAsset): TransformerHealthRecord[] {
  const rng = seededRng(tagToSeed(a.tag) + 999);
  const records: TransformerHealthRecord[] = [];
  const now = new Date();

  // Generate 4 quarterly records showing degradation trend
  for (let q = 3; q >= 0; q--) {
    const date = new Date(now.getFullYear(), now.getMonth() - q * 3, 10 + Math.floor(rng() * 15));
    const ageFactor = a.age / 60; // 0..1
    const degradation = q * (a.health < 40 ? 4 : 2); // health was worse further back if critical
    const hi = Math.min(100, a.health + degradation);
    const loadBase = a.load;
    const tempBase = 65 + (loadBase / 100) * 20;

    // DGA gases — correlated with health
    const gasMultiplier = (100 - hi) / 50; // worse health = higher gases
    const h2 = Math.floor((150 + rng() * 100) * gasMultiplier + 50);
    const ch4 = Math.floor((80 + rng() * 60) * gasMultiplier + 20);
    const c2h2 = Math.floor((2 + rng() * 5) * gasMultiplier * (a.failureMode.includes('Winding') ? 3 : 1));
    const c2h4 = Math.floor((100 + rng() * 80) * gasMultiplier + 30);
    const c2h6 = Math.floor((40 + rng() * 30) * gasMultiplier + 15);
    const co = Math.floor((300 + rng() * 200) * gasMultiplier + 100);
    const co2 = Math.floor((3000 + rng() * 2000) * gasMultiplier + 2000);

    records.push({
      assetTag: a.tag,
      timestamp: date.toISOString().split('T')[0],
      h2, ch4, c2h2, c2h4, c2h6, co, co2,
      o2: Math.floor(3000 + rng() * 500),
      n2: Math.floor(50000 + rng() * 3000),
      tdcg: h2 + ch4 + c2h2 + c2h4 + c2h6 + co,
      moisture: Math.floor(15 + (100 - hi) / 5 + rng() * 5),
      acidity: +((0.05 + (100 - hi) / 200 + rng() * 0.05).toFixed(2)),
      dielectricStrength: Math.floor(45 - (100 - hi) / 5 + rng() * 3),
      interfacialTension: Math.floor(28 - (100 - hi) / 8 + rng() * 2),
      colorNumber: +((2 + (100 - hi) / 15 + rng()).toFixed(1)),
      powerFactor: +((0.3 + (100 - hi) / 40 + rng() * 0.2).toFixed(1)),
      furan2FAL: +((0.2 + ageFactor * 2 + rng() * 0.3).toFixed(1)),
      topOilTemp: Math.floor(tempBase + rng() * 8 - 4),
      windingHotSpot: Math.floor(tempBase + 15 + rng() * 10 - 5),
      ambientTemp: Math.floor(15 + rng() * 20),
      loadPercent: Math.floor(loadBase - 5 + rng() * 10),
      healthIndex: hi,
      condition: hi >= 85 ? 'Good' : hi >= 70 ? 'Fair' : hi >= 50 ? 'Poor' : hi >= 30 ? 'Very Poor' : 'End of Life',
      remainingLifeYears: Math.max(1, Math.floor(hi / 10 - 1 + rng() * 3)),
    });
  }

  return records;
}

// ══════════════════════════════════════════════════════════════════
// GRID IQ TREE CLUSTER SYNTHESIS
// ══════════════════════════════════════════════════════════════════

interface SynthTrigger {
  label: string;
  detail: string;
  color: string;
  iconName: string; // lucide icon reference
}

interface SynthTreeCluster {
  triggers: SynthTrigger[];
  agentIds: [string, string, string];
  findings: { text: string; sev: 'critical' | 'warning' }[];
  deepAnalysis: { text: string; method: string }[];
  crossVal: { label: string; detail: string; confidence: number };
  crossLinks: string[];
}

// Failure-mode-specific diagnostic patterns
const DIAG_TEMPLATES: Record<string, SynthTreeCluster> = {
  'Insulation degradation': {
    triggers: [
      { label: 'DGA TDCG Rising', detail: '', color: 'amber', iconName: 'FlaskConical' },
      { label: 'Thermal Trending', detail: '', color: 'rose', iconName: 'Thermometer' },
      { label: 'Load Stress', detail: '', color: 'sky', iconName: 'Activity' },
    ],
    agentIds: ['dga', 'thermal', 'load'],
    findings: [
      { text: '', sev: 'critical' },
      { text: '', sev: 'critical' },
      { text: '', sev: 'warning' },
    ],
    deepAnalysis: [
      { text: '', method: 'IEEE C57.104' },
      { text: '', method: 'Thermal Model' },
      { text: '', method: 'Load Analytics' },
    ],
    crossVal: { label: 'Insulation Degradation Confirmed', detail: 'DGA trend + thermal aging + load stress converge', confidence: 0 },
    crossLinks: ['DGA ↔ Thermal correlation', 'Load stress ↔ Insulation aging'],
  },
  'Bushing failure': {
    triggers: [
      { label: 'Bushing PF Alarm', detail: '', color: 'fuchsia', iconName: 'Zap' },
      { label: 'OEM Bulletin', detail: '', color: 'cyan', iconName: 'FileText' },
      { label: 'Visual Anomaly', detail: '', color: 'emerald', iconName: 'Eye' },
    ],
    agentIds: ['electrical', 'oem', 'inspection'],
    findings: [
      { text: '', sev: 'critical' },
      { text: '', sev: 'critical' },
      { text: '', sev: 'warning' },
    ],
    deepAnalysis: [
      { text: '', method: 'Dielectric Analysis' },
      { text: '', method: 'OEM Cross-Ref' },
      { text: '', method: 'Field Inspect' },
    ],
    crossVal: { label: 'Bushing Failure Imminent', detail: 'PF exceedance + OEM recall + visual leak converge', confidence: 0 },
    crossLinks: ['Dielectric ↔ OEM batch defect', 'Visual ↔ PF trending'],
  },
  'Tap changer wear': {
    triggers: [
      { label: 'OLTC Counter Alert', detail: '', color: 'amber', iconName: 'Activity' },
      { label: 'DGA in OLTC Oil', detail: '', color: 'rose', iconName: 'FlaskConical' },
      { label: 'Electrical Test', detail: '', color: 'fuchsia', iconName: 'Zap' },
    ],
    agentIds: ['history', 'dga', 'electrical'],
    findings: [
      { text: '', sev: 'critical' },
      { text: '', sev: 'warning' },
      { text: '', sev: 'critical' },
    ],
    deepAnalysis: [
      { text: '', method: 'OLTC Analytics' },
      { text: '', method: 'Oil Analysis' },
      { text: '', method: 'Contact Resistance' },
    ],
    crossVal: { label: 'OLTC Overhaul Required', detail: 'Operation count + DGA + contact wear converge', confidence: 0 },
    crossLinks: ['OLTC ops ↔ Contact degradation', 'DGA ↔ Arcing detection'],
  },
  'Cooling system failure': {
    triggers: [
      { label: 'Thermal Alarm', detail: '', color: 'rose', iconName: 'Thermometer' },
      { label: 'Fan Failure', detail: '', color: 'sky', iconName: 'Activity' },
      { label: 'Load Exceedance', detail: '', color: 'amber', iconName: 'Activity' },
    ],
    agentIds: ['thermal', 'condition', 'load'],
    findings: [
      { text: '', sev: 'critical' },
      { text: '', sev: 'critical' },
      { text: '', sev: 'warning' },
    ],
    deepAnalysis: [
      { text: '', method: 'Thermal Model' },
      { text: '', method: 'SCADA Diagnostics' },
      { text: '', method: 'Load Analytics' },
    ],
    crossVal: { label: 'Cooling Deficiency Confirmed', detail: 'Thermal rise + fan failure + peak loading converge', confidence: 0 },
    crossLinks: ['Thermal ↔ Cooling capacity', 'Load ↔ Temperature rise'],
  },
  'Winding fault': {
    triggers: [
      { label: 'DGA Acetylene Spike', detail: '', color: 'rose', iconName: 'FlaskConical' },
      { label: 'SFRA Deviation', detail: '', color: 'fuchsia', iconName: 'Zap' },
      { label: 'PD Trending', detail: '', color: 'lime', iconName: 'Activity' },
    ],
    agentIds: ['dga', 'electrical', 'condition'],
    findings: [
      { text: '', sev: 'critical' },
      { text: '', sev: 'critical' },
      { text: '', sev: 'critical' },
    ],
    deepAnalysis: [
      { text: '', method: 'Duval Triangle' },
      { text: '', method: 'SFRA Comparison' },
      { text: '', method: 'PD Diagnostics' },
    ],
    crossVal: { label: 'Winding Fault Confirmed', detail: 'Acetylene + SFRA shift + PD activity converge', confidence: 0 },
    crossLinks: ['DGA ↔ Internal arcing', 'SFRA ↔ Winding deformation'],
  },
  'Oil contamination': {
    triggers: [
      { label: 'Oil Quality Alert', detail: '', color: 'amber', iconName: 'FlaskConical' },
      { label: 'Moisture Alarm', detail: '', color: 'cyan', iconName: 'FlaskConical' },
      { label: 'Dielectric Drop', detail: '', color: 'fuchsia', iconName: 'Zap' },
    ],
    agentIds: ['dga', 'condition', 'electrical'],
    findings: [
      { text: '', sev: 'warning' },
      { text: '', sev: 'critical' },
      { text: '', sev: 'warning' },
    ],
    deepAnalysis: [
      { text: '', method: 'Oil Chemistry' },
      { text: '', method: 'Moisture Model' },
      { text: '', method: 'Dielectric Analysis' },
    ],
    crossVal: { label: 'Oil Reclamation Required', detail: 'Acidity + moisture + dielectric loss converge', confidence: 0 },
    crossLinks: ['Oil chemistry ↔ Moisture ingress', 'Dielectric ↔ Contamination level'],
  },
  'Gasket/seal leak': {
    triggers: [
      { label: 'Oil Level Drop', detail: '', color: 'amber', iconName: 'Activity' },
      { label: 'Visual Seepage', detail: '', color: 'emerald', iconName: 'Eye' },
      { label: 'PM Compliance', detail: '', color: 'violet', iconName: 'ClipboardList' },
    ],
    agentIds: ['condition', 'inspection', 'history'],
    findings: [
      { text: '', sev: 'warning' },
      { text: '', sev: 'critical' },
      { text: '', sev: 'warning' },
    ],
    deepAnalysis: [
      { text: '', method: 'Level Trending' },
      { text: '', method: 'Field Inspect' },
      { text: '', method: 'Maintenance History' },
    ],
    crossVal: { label: 'Seal Replacement Required', detail: 'Oil loss + visual seepage + repeat maintenance converge', confidence: 0 },
    crossLinks: ['Oil level ↔ Leak rate', 'Inspection ↔ Gasket condition'],
  },
};

export interface AssetDiagnostic {
  asset: SubstationAsset;
  triggers: SynthTrigger[];
  agentIds: [string, string, string];
  findings: { text: string; sev: 'critical' | 'warning' }[];
  deepAnalysis: { text: string; method: string }[];
  crossVal: { label: string; detail: string; confidence: number };
  crossLinks: string[];
  scenarioTitle: string;
  scenarioCategory: string;
}

export function synthesizeDiagnostic(a: SubstationAsset): AssetDiagnostic {
  const rng = seededRng(tagToSeed(a.tag) + 7777);
  const template = DIAG_TEMPLATES[a.failureMode] || DIAG_TEMPLATES['Insulation degradation'];
  const records = synthesizeHealthRecords(a);
  const latest = records[records.length - 1];

  // Fill in asset-specific details
  const triggers = template.triggers.map((t, i) => {
    const details: string[] = [];
    switch (a.failureMode) {
      case 'Insulation degradation':
        details.push(`TDCG ${latest.tdcg} ppm — Cond. ${latest.healthIndex < 30 ? 4 : 3}`, `Hot-spot ${latest.windingHotSpot} °C`, `Peak ${a.load} % nameplate`);
        break;
      case 'Bushing failure':
        details.push(`PF ${latest.powerFactor} % (limit 1.0)`, `SB-${2019 + Math.floor(rng() * 5)}-${String(Math.floor(rng() * 90 + 10)).padStart(3, '0')}`, `Oil seepage ${['A', 'B', 'C'][Math.floor(rng() * 3)]}-phase`);
        break;
      case 'Tap changer wear':
        details.push(`${Math.floor(50000 + rng() * 30000)} operations`, `C₂H₂ ${latest.c2h2} ppm in OLTC`, `Contact Ω +${(15 + rng() * 25).toFixed(0)} %`);
        break;
      case 'Cooling system failure':
        details.push(`Top oil ${latest.topOilTemp} °C (limit 80)`, `${Math.floor(rng() * 3 + 1)}/${Math.floor(rng() * 2 + 3)} fans failed`, `Load ${a.load} % nameplate`);
        break;
      case 'Winding fault':
        details.push(`C₂H₂ ${latest.c2h2} ppm — arcing`, `SFRA δ ${(1.5 + rng() * 3).toFixed(1)} dB`, `PD ↑ ${Math.floor(200 + rng() * 400)} % in 6 mo`);
        break;
      case 'Oil contamination':
        details.push(`Acidity ${latest.acidity} mg KOH/g`, `Moisture ${latest.moisture} ppm (limit 25)`, `BDV ${latest.dielectricStrength} kV (min 40)`);
        break;
      case 'Gasket/seal leak':
        details.push(`Level -${(0.2 + rng() * 0.5).toFixed(1)} L/wk`, `Score ${(3 + rng() * 2).toFixed(1)}/10 · seepage`, `PM score ${Math.floor(60 + rng() * 15)} % (tgt 85 %)`);
        break;
      default:
        details.push(`HI ${a.health} %`, `Age ${a.age} yr`, `Load ${a.load} %`);
    }
    return { ...t, detail: details[i] || t.detail };
  });

  // Contextual findings
  const findingTextsMap: Record<string, string[]> = {
    'Insulation degradation': [
      `TDCG Cond. ${latest.healthIndex < 30 ? 4 : 3} — T2 thermal fault`,
      `Hot-spot +${Math.floor(5 + rng() * 15)} °C, aging ${(2 + rng() * 4).toFixed(1)}×`,
      `Peak load ${a.load} % — thermal stress`,
    ],
    'Bushing failure': [
      `PF ${latest.powerFactor} % — insulation breakdown`,
      `Design life +${(a.age - 25 > 0 ? a.age - 25 : 1).toFixed(0)} yr · bulletin open`,
      `Oil stain ${['A', 'B', 'C'][Math.floor(rng() * 3)]}-phase bushing base`,
    ],
    'Tap changer wear': [
      `${Math.floor(50000 + rng() * 30000)} ops — overhaul due`,
      `Acetylene in OLTC oil — arcing`,
      `Contact resistance +${(15 + rng() * 25).toFixed(0)} % from baseline`,
    ],
    'Cooling system failure': [
      `Top oil ${latest.topOilTemp} °C — limit exceeded`,
      `Fan bank ${Math.floor(rng() * 2 + 1)} offline — ${Math.floor(rng() * 48 + 4)}h`,
      `Derated to ${Math.floor(a.load * 0.7)} % — thermal limit`,
    ],
    'Winding fault': [
      `C₂H₂ ${latest.c2h2} ppm — active arcing`,
      `SFRA frequency shift — winding movement`,
      `PD ${Math.floor(300 + rng() * 500)} pC · acoustic confirmed`,
    ],
    'Oil contamination': [
      `Acidity ${latest.acidity} — oil oxidation`,
      `Moisture ${latest.moisture} ppm — paper saturation risk`,
      `BDV ${latest.dielectricStrength} kV — below service min`,
    ],
    'Gasket/seal leak': [
      `Oil level trending ↓ ${(0.2 + rng() * 0.5).toFixed(1)} L/wk`,
      `Visual ${(3 + rng() * 2).toFixed(1)}/10 · active seepage`,
      `Gasket replaced ${Math.floor(1 + rng() * 3)}× in 24 mo`,
    ],
  };
  const findingTexts = findingTextsMap[a.failureMode] || [`HI ${a.health} % — degraded`, `Age ${a.age} yr — beyond design life`, `Load ${a.load} % — stressed`];

  const findings = template.findings.map((f, i) => ({ ...f, text: findingTexts[i] || f.text }));

  // Deep analysis text
  const deepTextsMap: Record<string, string[]> = {
    'Insulation degradation': [
      `Duval → T2 · Rogers ${(2.5 + rng() * 1.5).toFixed(1)} · TDCG ${Math.floor(30 + rng() * 30)} ppm/d`,
      `DP = ${Math.floor(200 + rng() * 150)} · insulation ${(1 + rng() * 4).toFixed(1)} yr left`,
      `LF ${(a.load / 100).toFixed(2)} · ${Math.floor(8 + rng() * 12)} overloads/mo`,
    ],
    'Bushing failure': [
      `Tan-δ ${(0.02 + rng() * 0.04).toFixed(3)} · C₁ +${Math.floor(3 + rng() * 8)} %`,
      `Batch ${Math.floor(rng() * 5 + 2)}/${Math.floor(rng() * 5 + 5)} failed · recall active`,
      `Corrosion ${['A', 'B', 'C'][Math.floor(rng() * 3)]} · gasket ↓ · ${(0.1 + rng() * 0.5).toFixed(1)} L/mo`,
    ],
    'Tap changer wear': [
      `Weibull β ${(2 + rng() * 2).toFixed(1)} · ${Math.floor(70 + rng() * 20)} % wear`,
      `C₂H₂ trend ↑ · arcing in diverter`,
      `µΩ +${Math.floor(15 + rng() * 25)} % · dynamic time +${Math.floor(10 + rng() * 20)} ms`,
    ],
    'Cooling system failure': [
      `ΔT model: ${Math.floor(8 + rng() * 12)} °C above rating`,
      `SCADA: fan contactor ${Math.floor(rng() * 2 + 1)} failed · pump OK`,
      `Emergency rating ${Math.floor(a.load * 0.7)} % at ambient ${Math.floor(20 + rng() * 15)} °C`,
    ],
    'Winding fault': [
      `Duval → D1 arcing · key gas C₂H₂`,
      `SFRA δ ${(1.5 + rng() * 3).toFixed(1)} dB at ${Math.floor(50 + rng() * 150)} kHz`,
      `PD ${Math.floor(300 + rng() * 500)} pC · UHF trend · ${Math.floor(30 + rng() * 15)} dB`,
    ],
    'Oil contamination': [
      `IFT ${latest.interfacialTension} mN/m · color ${latest.colorNumber}`,
      `Moisture sat. ${Math.floor(60 + rng() * 30)} % · paper at risk`,
      `BDV gap ${Math.floor(40 - latest.dielectricStrength)} kV below spec`,
    ],
    'Gasket/seal leak': [
      `Level trend: ${(0.2 + rng() * 0.5).toFixed(1)} L/wk · conservator OK`,
      `IR thermography: ${['flange', 'manhole', 'valve', 'radiator'][Math.floor(rng() * 4)]} joint`,
      `Repeat: ${Math.floor(1 + rng() * 3)} WOs in 24 mo · MTBF ↓ ${Math.floor(20 + rng() * 40)} %`,
    ],
  };
  const deepTexts = deepTextsMap[a.failureMode] || [`HI trending: -${Math.floor(5 + rng() * 10)} pts/yr`, `Age analysis: ${a.age} yr / ${Math.floor(35 + rng() * 15)} design`, `Load pattern: ${a.load} % avg · ${Math.floor(rng() * 10 + 3)} peaks/mo`];

  const deepAnalysis = template.deepAnalysis.map((d, i) => ({ ...d, text: deepTexts[i] || d.text }));

  // Confidence — higher for worse health
  const confidence = Math.min(98, Math.floor(80 + (50 - a.health) / 3 + rng() * 8));

  return {
    asset: a,
    triggers,
    agentIds: template.agentIds,
    findings,
    deepAnalysis,
    crossVal: { ...template.crossVal, confidence },
    crossLinks: template.crossLinks,
    scenarioTitle: `${a.failureMode} — ${a.name}`,
    scenarioCategory: a.riskTrend === 'critical' ? 'dga_alert' : a.age > 35 ? 'aging_asset' : 'avoided_outage',
  };
}

// ══════════════════════════════════════════════════════════════════
// SCENARIO SYNTHESIS — full DemoScenario from asset diagnostic
// ══════════════════════════════════════════════════════════════════

import type { DemoScenario, DecisionSupport, DecisionOption, ScenarioEvent, ScenarioOutcome, ScenarioMetric } from '@/lib/demo-scenarios';

export function synthesizeScenario(a: SubstationAsset, diag: AssetDiagnostic): DemoScenario {
  const rng = seededRng(tagToSeed(a.tag) + 8888);
  const category: DemoScenario['category'] = diag.scenarioCategory as DemoScenario['category'];
  const severity: DemoScenario['severity'] = a.health < 30 ? 'critical' : a.health < 40 ? 'high' : 'medium';

  // Cost modeling
  const hourlyImpact = a.customers * 0.008; // $/customer-hr
  const outageHours = a.health < 30 ? 36 + Math.floor(rng() * 48) : a.health < 40 ? 12 + Math.floor(rng() * 24) : 4 + Math.floor(rng() * 12);
  const costAvoided = hourlyImpact * outageHours;
  const costStr = costAvoided >= 1000000 ? `$${(costAvoided / 1000000).toFixed(1)}M` : `$${Math.round(costAvoided / 1000)}K`;
  const replacementCost = Math.floor(800000 + rng() * 3200000);
  const replacementStr = `$${(replacementCost / 1000000).toFixed(1)}M`;
  const deferRisk = Math.floor(replacementCost * (1.5 + rng()));
  const deferStr = `$${(deferRisk / 1000000).toFixed(1)}M`;

  const now = new Date();
  const timeline: ScenarioEvent[] = [
    { id: `${a.tag}-e1`, timestamp: new Date(now.getTime() - 180 * 86400000).toISOString(), type: 'detection', title: 'Anomaly Detected', description: `AI monitoring flagged ${a.failureMode.toLowerCase()} trending on ${a.name}. Health index declining at accelerated rate.`, icon: 'TrendingDown' },
    { id: `${a.tag}-e2`, timestamp: new Date(now.getTime() - 120 * 86400000).toISOString(), type: 'analysis', title: 'Multi-Agent Analysis', description: `${diag.agentIds.length} diagnostic agents converged on ${diag.crossVal.label.toLowerCase()} with ${diag.crossVal.confidence}% confidence.`, icon: 'Brain' },
    { id: `${a.tag}-e3`, timestamp: new Date(now.getTime() - 60 * 86400000).toISOString(), type: 'recommendation', title: 'Recommendation Issued', description: `Grid IQ recommends ${a.repairWindow.toLowerCase()} action: ${a.failureMode.toLowerCase()} repair. Est. duration: ${a.repairDuration}.`, icon: 'Shield' },
    { id: `${a.tag}-e4`, timestamp: new Date(now.getTime() - 14 * 86400000).toISOString(), type: 'action', title: 'Decision Point', description: `Operator review required. ${a.customers.toLocaleString()} customers at risk. TTF: ${a.ttf}.`, icon: 'AlertTriangle' },
  ];

  const outcome: ScenarioOutcome = {
    title: `${a.failureMode} Prevented`,
    description: `Proactive intervention on ${a.name} averts unplanned outage affecting ${a.customers.toLocaleString()} customers.`,
    costAvoided: costStr,
    customersProtected: a.customers,
    outageHoursAvoided: outageHours,
  };

  const metrics: ScenarioMetric[] = [
    { label: 'Health Index', value: `${a.health}%`, trend: 'down', context: `Declining ${a.health < 30 ? 'rapidly' : 'steadily'}` },
    { label: 'Load Factor', value: `${a.load}%`, trend: a.load > 80 ? 'up' : 'stable', context: `${a.load > 80 ? 'Above' : 'Within'} design limits` },
    { label: 'TTF', value: a.ttf, trend: 'down', context: 'Predicted time to failure' },
    { label: 'Age', value: `${a.age} yr`, trend: 'up', context: `Design life: ${Math.floor(35 + rng() * 15)} yr` },
  ];

  const urgency: DecisionSupport['urgency'] = a.repairWindow === 'Immediate' ? 'immediate' : a.repairWindow === 'Within 30 days' ? 'within_week' : 'within_month';

  const approveOption: DecisionOption = {
    label: 'Approve Proactive Repair',
    description: `Execute planned ${a.failureMode.toLowerCase()} repair during ${a.repairWindow === 'Immediate' ? 'emergency window' : 'next scheduled outage'}. Crew and materials pre-staged.`,
    pros: [
      `Prevents unplanned outage (${outageHours}h estimated)`,
      `Protects ${a.customers.toLocaleString()} customers`,
      `Controlled execution with pre-staged resources`,
      `Extends asset life by ${Math.floor(5 + rng() * 15)} years`,
    ],
    cons: [
      `Planned outage required (${a.repairDuration})`,
      `Capital cost: ${replacementStr}`,
      `Crew reallocation from other work`,
    ],
    financialImpact: { label: 'Net Savings', value: costStr, trend: 'positive' },
    riskLevel: 'low',
    customerImpact: `Brief planned outage (${a.repairDuration}) with advance notification. Zero unplanned exposure.`,
    timeline: `${a.repairDuration} repair + 48h commissioning`,
  };

  const deferOption: DecisionOption = {
    label: 'Defer to Watch List',
    description: `Continue monitoring with enhanced surveillance. Re-evaluate at next inspection cycle. Accept risk of unplanned failure.`,
    pros: [
      'No immediate capital expenditure',
      'No planned outage disruption',
      'More time for budget approval',
    ],
    cons: [
      `${Math.floor(rng() * 30 + 40)}% probability of unplanned failure within ${a.ttf}`,
      `Potential ${outageHours}h unplanned outage for ${a.customers.toLocaleString()} customers`,
      `Emergency repair cost up to ${deferStr}`,
      `Possible cascading failures to adjacent equipment`,
    ],
    financialImpact: { label: 'Risk Exposure', value: deferStr, trend: 'negative' },
    riskLevel: severity === 'critical' ? 'critical' : 'high',
    customerImpact: `${a.customers.toLocaleString()} customers exposed to unplanned outage risk. Restoration time: ${outageHours}h.`,
    timeline: `Re-evaluate in ${a.repairWindow === 'Immediate' ? '7 days' : '30 days'}`,
  };

  const decisionSupport: DecisionSupport = {
    summary: `Grid IQ has identified ${a.failureMode.toLowerCase()} on ${a.name} (${a.tag}) with ${diag.crossVal.confidence}% confidence. The asset serves ${a.customers.toLocaleString()} customers and has a predicted time-to-failure of ${a.ttf}. Recommended action: ${a.repairWindow.toLowerCase()} repair.`,
    urgency,
    confidenceScore: diag.crossVal.confidence,
    approveOption,
    deferOption,
    keyRisks: [
      `Health index at ${a.health}% — ${a.health < 30 ? 'end of life' : 'very poor condition'}`,
      `Primary failure mode: ${a.failureMode}`,
      `${a.customers.toLocaleString()} customers at risk of ${outageHours}h outage`,
      `Asset age (${a.age} yr) exceeds fleet average`,
    ],
  };

  return {
    id: `synth-${a.tag}`,
    title: diag.scenarioTitle,
    subtitle: `${diag.crossVal.label} — proactive intervention recommended`,
    description: `${a.name} (${a.tag}) at ${a.opco} shows ${a.failureMode.toLowerCase()} with health index ${a.health}%. Multi-agent diagnostic converged at ${diag.crossVal.confidence}% confidence. Predicted time to failure: ${a.ttf}. Grid IQ recommends ${a.repairWindow.toLowerCase()} action to protect ${a.customers.toLocaleString()} customers.`,
    assetTag: a.tag,
    assetName: a.name,
    opCo: a.opco,
    category,
    severity,
    timeline,
    outcome,
    metrics,
    decisionSupport,
  };
}

// ══════════════════════════════════════════════════════════════════
// WORK ORDER HISTORY — 24-month synthetic maintenance log
// ══════════════════════════════════════════════════════════════════

export interface WorkOrder {
  id: string;
  date: string;            // ISO date
  type: 'PM' | 'CM' | 'INSP' | 'EMER' | 'MOD' | 'TEST';
  typeLabel: string;
  title: string;
  description: string;
  duration: string;
  crew: string;
  status: 'completed' | 'deferred' | 'cancelled' | 'in-progress';
  finding?: string;
  cost: number;
  priority: 'routine' | 'high' | 'emergency';
}

const WO_TYPE_LABELS: Record<WorkOrder['type'], string> = {
  PM: 'Preventive Maintenance',
  CM: 'Corrective Maintenance',
  INSP: 'Inspection',
  EMER: 'Emergency Repair',
  MOD: 'Modification / Upgrade',
  TEST: 'Diagnostic Test',
};

const PM_TEMPLATES = [
  { title: 'Annual Oil Sampling & DGA', desc: 'Collected oil samples for dissolved gas analysis, moisture, acidity, and dielectric strength testing per IEEE C57.106.', dur: '2h', crew: 'Lab Tech', cost: 1200 },
  { title: 'Bushing Inspection & Cleaning', desc: 'Visual and IR inspection of all HV/LV bushings. Cleaned porcelain surfaces, checked oil levels, measured power factor.', dur: '4h', crew: 'Line Crew', cost: 2800 },
  { title: 'Cooling System Service', desc: 'Inspected radiators, fans, and pumps. Cleaned fin surfaces, verified fan rotation, checked oil flow indicators.', dur: '3h', crew: 'Mech Tech', cost: 1800 },
  { title: 'OLTC Maintenance', desc: 'On-load tap changer contact inspection, oil sampling, operation counter read, and timing test per manufacturer schedule.', dur: '6h', crew: 'Relay Tech', cost: 4500 },
  { title: 'Gasket & Seal Inspection', desc: 'Inspected all external gaskets and seals for oil seepage. Checked conservator, Buchholz relay, pressure relief device.', dur: '3h', crew: 'Line Crew', cost: 1500 },
  { title: 'Protective Relay Calibration', desc: 'Tested and calibrated differential, overcurrent, and thermal relays. Verified trip circuits and alarm setpoints.', dur: '4h', crew: 'Relay Tech', cost: 3200 },
  { title: 'Grounding System Test', desc: 'Measured ground resistance, inspected ground connections, and verified continuity of surge arrester grounding.', dur: '2h', crew: 'Line Crew', cost: 900 },
];

const CM_TEMPLATES = [
  { title: 'Oil Leak Repair — Main Tank', desc: 'Repaired gasket leak at main tank flange. Drained oil, replaced gasket, refilled and tested.', dur: '8h', crew: 'Xfmr Crew', cost: 12000 },
  { title: 'Fan Motor Replacement', desc: 'Replaced failed cooling fan motor. Verified rotation, airflow, and thermal response.', dur: '3h', crew: 'Mech Tech', cost: 4200 },
  { title: 'Bushing Replacement', desc: 'Replaced degraded HV bushing after elevated power factor test results. Installed OEM replacement.', dur: '16h', crew: 'Xfmr Crew', cost: 35000 },
  { title: 'OLTC Contact Replacement', desc: 'Replaced worn tap changer contacts after increased contact resistance detected during routine test.', dur: '12h', crew: 'Relay Tech', cost: 18000 },
  { title: 'Oil Processing / Degassing', desc: 'Processed transformer oil to remove moisture and dissolved gases. Restored dielectric strength to specification.', dur: '24h', crew: 'Oil Service', cost: 8500 },
  { title: 'Conservator Bladder Repair', desc: 'Replaced deteriorated conservator bladder. Inspected Buchholz relay and silica gel breather.', dur: '6h', crew: 'Xfmr Crew', cost: 7200 },
];

const INSP_TEMPLATES = [
  { title: 'Quarterly Visual Inspection', desc: 'Walked down transformer and checked for oil leaks, abnormal sounds, paint condition, ground connections, and clearances.', dur: '1h', crew: 'Operator', cost: 200 },
  { title: 'IR Thermography Survey', desc: 'Performed infrared scan of bushings, connections, radiators, and cooling equipment. Compared to baseline.', dur: '2h', crew: 'IR Tech', cost: 1500 },
  { title: 'Ultrasonic / Acoustic Survey', desc: 'Performed acoustic emission scan for partial discharge activity on bushings and winding area.', dur: '2h', crew: 'PD Tech', cost: 2200 },
  { title: 'Foundation & Civil Inspection', desc: 'Inspected concrete pad, containment berm, fire wall, and drainage system for deterioration.', dur: '1h', crew: 'Civil Eng', cost: 600 },
];

const TEST_TEMPLATES = [
  { title: 'Sweep Frequency Response (SFRA)', desc: 'Performed SFRA to detect winding deformation, core displacement, or clamping force changes.', dur: '4h', crew: 'Test Eng', cost: 3500 },
  { title: 'Bushing Power Factor Test', desc: 'Measured C1 and C2 power factor and capacitance for all bushings per IEEE C57.19.01.', dur: '3h', crew: 'Test Eng', cost: 2800 },
  { title: 'Winding Resistance Test', desc: 'Measured DC resistance of all windings at all tap positions to detect loose connections or broken strands.', dur: '3h', crew: 'Test Eng', cost: 2400 },
  { title: 'Turns Ratio Test', desc: 'Verified turns ratio at all tap positions against nameplate. Compared to factory test results.', dur: '2h', crew: 'Test Eng', cost: 1800 },
  { title: 'Insulation Resistance / PI Test', desc: 'Measured insulation resistance and polarization index for all winding combinations at 5kV.', dur: '2h', crew: 'Test Eng', cost: 1600 },
];

export function synthesizeWorkOrders(a: SubstationAsset): WorkOrder[] {
  const rng = seededRng(tagToSeed(a.tag) + 9999);
  const orders: WorkOrder[] = [];
  const now = new Date();
  const healthFactor = (100 - a.health) / 50; // worse health → more work orders

  // Generate 24 months of work orders
  for (let monthsAgo = 24; monthsAgo >= 0; monthsAgo--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);

    // Quarterly visual inspection
    if (monthsAgo % 3 === 0) {
      const tmpl = INSP_TEMPLATES[0];
      const day = 5 + Math.floor(rng() * 10);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: 'INSP', typeLabel: WO_TYPE_LABELS.INSP,
        title: tmpl.title, description: tmpl.desc,
        duration: tmpl.dur, crew: tmpl.crew,
        status: monthsAgo === 0 ? 'in-progress' : 'completed',
        cost: tmpl.cost, priority: 'routine',
        finding: a.health < 40 && rng() > 0.5 ? 'Oil weep noted at main tank flange' : undefined,
      });
    }

    // Semi-annual oil sampling
    if (monthsAgo % 6 === 0) {
      const tmpl = PM_TEMPLATES[0];
      const day = 10 + Math.floor(rng() * 10);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      const hasFinding = a.health < 45 && rng() > 0.3;
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: 'PM', typeLabel: WO_TYPE_LABELS.PM,
        title: tmpl.title, description: tmpl.desc,
        duration: tmpl.dur, crew: tmpl.crew,
        status: 'completed', cost: tmpl.cost, priority: 'routine',
        finding: hasFinding ? 'Elevated dissolved gases — TDCG trending above IEEE Condition 2' : undefined,
      });
    }

    // Annual bushing inspection
    if (monthsAgo % 12 === 0 && monthsAgo > 0) {
      const tmpl = PM_TEMPLATES[1];
      const day = 15 + Math.floor(rng() * 5);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: 'PM', typeLabel: WO_TYPE_LABELS.PM,
        title: tmpl.title, description: tmpl.desc,
        duration: tmpl.dur, crew: tmpl.crew,
        status: 'completed', cost: tmpl.cost, priority: 'routine',
        finding: a.health < 35 ? 'Bushing C1 power factor 0.8% — approaching action level' : undefined,
      });
    }

    // Annual cooling system service
    if (monthsAgo === 12 || monthsAgo === 0) {
      const tmpl = PM_TEMPLATES[2];
      const day = 18 + Math.floor(rng() * 5);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: 'PM', typeLabel: WO_TYPE_LABELS.PM,
        title: tmpl.title, description: tmpl.desc,
        duration: tmpl.dur, crew: tmpl.crew,
        status: monthsAgo === 0 ? 'in-progress' : 'completed',
        cost: tmpl.cost, priority: 'routine',
      });
    }

    // Random additional PM/INSP/TEST depending on health
    if (rng() < 0.15 + healthFactor * 0.2) {
      const pool = [...PM_TEMPLATES.slice(3), ...INSP_TEMPLATES.slice(1), ...TEST_TEMPLATES];
      const tmpl = pool[Math.floor(rng() * pool.length)];
      const isTest = TEST_TEMPLATES.includes(tmpl);
      const day = 1 + Math.floor(rng() * 25);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: isTest ? 'TEST' : (INSP_TEMPLATES.includes(tmpl) ? 'INSP' : 'PM'),
        typeLabel: WO_TYPE_LABELS[isTest ? 'TEST' : (INSP_TEMPLATES.includes(tmpl) ? 'INSP' : 'PM')],
        title: tmpl.title, description: tmpl.desc,
        duration: tmpl.dur, crew: tmpl.crew,
        status: rng() > 0.9 ? 'deferred' : 'completed',
        cost: tmpl.cost, priority: 'routine',
        finding: a.health < 40 && rng() > 0.6 ? 'Anomaly noted — follow-up recommended' : undefined,
      });
    }

    // Corrective maintenance: more likely for poor health
    if (rng() < healthFactor * 0.15) {
      const tmpl = CM_TEMPLATES[Math.floor(rng() * CM_TEMPLATES.length)];
      const day = 1 + Math.floor(rng() * 25);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: 'CM', typeLabel: WO_TYPE_LABELS.CM,
        title: tmpl.title, description: tmpl.desc,
        duration: tmpl.dur, crew: tmpl.crew,
        status: 'completed', cost: tmpl.cost, priority: 'high',
        finding: 'Defect corrected — returned to service',
      });
    }

    // Emergency: rare, more likely for very poor health
    if (a.health < 35 && rng() < 0.06) {
      const day = 1 + Math.floor(rng() * 25);
      const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
      orders.push({
        id: `WO-${a.tag.slice(-4)}-${String(orders.length + 1).padStart(3, '0')}`,
        date: d.toISOString().slice(0, 10),
        type: 'EMER', typeLabel: WO_TYPE_LABELS.EMER,
        title: 'Emergency De-energization & Inspection',
        description: 'Transformer de-energized after Buchholz alarm / sudden gas accumulation. Emergency inspection of tank internals, bushings, and tap changer.',
        duration: '24h', crew: 'Emergency Crew',
        status: 'completed', cost: 45000, priority: 'emergency',
        finding: 'Active arcing detected — winding damage confirmed',
      });
    }
  }

  // Sort by date descending (most recent first)
  orders.sort((a, b) => b.date.localeCompare(a.date));
  return orders;
}
