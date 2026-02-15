// ═══════════════════════════════════════════════════════════════
// RISK INTELLIGENCE DATA — Exelon GridIQ
// Sources: EAGLE-I (ORNL), NOAA Storm Events, ComEd ICC Filings
// Fleet: ~6,230 substation transformers across 6 OpCos
// ═══════════════════════════════════════════════════════════════

// ─── Types ───

export type RiskLevel = 'low' | 'medium' | 'high';
export type WeatherSeverity = 'severe' | 'moderate' | 'minor';
export type WeatherIcon = 'derecho' | 'ice' | 'hurricane' | 'heat' | 'wind' | 'tornado' | 'thunder';

export interface OpCo {
  id: string;
  name: string;
  state: string;
  customers: number;
  color: string;
  risk: RiskLevel;
  riskLabel: string;
  center: [number, number];
  outages10yr: number;
  avgRestore: number;
  peakMW: number;
  territory: string;
  riskColor: string;
  riskBg: string;
}

export interface WeatherEvent {
  id: string;
  type: WeatherSeverity;
  icon: WeatherIcon;
  title: string;
  date: string;
  opcos: string[];
  outages: number;
  desc: string;
  lat: number;
  lng: number;
}

export interface SubstationAsset {
  tag: string;
  name: string;
  lat: number;
  lng: number;
  opco: string;
  age: number;
  health: number;
  load: number;
  kv: string;
  customers: number;
  // Predictive maintenance fields
  ttf: string;              // Time to failure (predicted)
  repairWindow: string;     // Recommended repair window
  repairDuration: string;   // Estimated repair time
  materials: string[];      // Required materials
  skills: string[];         // Required crew skills
  failureMode: string;      // Primary predicted failure mode
  riskTrend: 'stable' | 'degrading' | 'critical'; // Trend direction
}

export interface OutageTrend {
  yr: number;
  count: number;
  weather: number;
}

export interface ImpactCause {
  cause: string;
  hours: number;
  color: string;
}

export interface FailureMode {
  name: string;
  pct: number;
  color: string;
}

export interface FleetStats {
  total: number;
  totalReal: number;
  sampleRatio: string;
  pctOver40: number;
  pctPoor: number;
  avgAge: number;
  avgHealth: number;
}

// ─── OpCo Definitions ───

export const OPCOS: OpCo[] = [
  { id: 'ComEd', name: 'ComEd', state: 'IL', customers: 4000000, color: '#38bdf8', risk: 'medium', riskLabel: 'Med',
    center: [41.88, -87.75], outages10yr: 5420, avgRestore: 3.8, peakMW: 22500, territory: 'Northern Illinois',
    riskColor: 'rgb(251,191,36)', riskBg: 'rgba(245,158,11,0.15)' },
  { id: 'PECO', name: 'PECO', state: 'PA', customers: 1700000, color: '#a78bfa', risk: 'high', riskLabel: 'High',
    center: [40.0, -75.15], outages10yr: 3180, avgRestore: 4.8, peakMW: 8900, territory: 'SE Pennsylvania',
    riskColor: 'rgb(251,113,133)', riskBg: 'rgba(244,63,94,0.15)' },
  { id: 'BGE', name: 'BGE', state: 'MD', customers: 1290000, color: '#fbbf24', risk: 'medium', riskLabel: 'Med',
    center: [39.28, -76.62], outages10yr: 2640, avgRestore: 4.1, peakMW: 7200, territory: 'Central Maryland',
    riskColor: 'rgb(251,191,36)', riskBg: 'rgba(245,158,11,0.15)' },
  { id: 'Pepco', name: 'Pepco', state: 'DC/MD', customers: 919000, color: '#34d399', risk: 'low', riskLabel: 'Low',
    center: [38.9, -76.99], outages10yr: 1580, avgRestore: 3.2, peakMW: 6400, territory: 'DC Metro / Maryland',
    riskColor: 'rgb(52,211,153)', riskBg: 'rgba(16,185,129,0.1)' },
  { id: 'ACE', name: 'ACE', state: 'NJ', customers: 572000, color: '#fb923c', risk: 'high', riskLabel: 'High',
    center: [39.45, -74.6], outages10yr: 890, avgRestore: 5.1, peakMW: 3100, territory: 'Southern New Jersey',
    riskColor: 'rgb(251,113,133)', riskBg: 'rgba(244,63,94,0.15)' },
  { id: 'DPL', name: 'DPL', state: 'DE/MD', customers: 561500, color: '#f472b6', risk: 'medium', riskLabel: 'Med',
    center: [39.0, -75.5], outages10yr: 575, avgRestore: 4.4, peakMW: 2800, territory: 'Delaware / E. Maryland',
    riskColor: 'rgb(251,191,36)', riskBg: 'rgba(245,158,11,0.15)' },
];

// ─── Weather Events ───

export const WEATHER_EVENTS: WeatherEvent[] = [
  { id: 'W1', type: 'severe', icon: 'derecho', title: 'August 2020 Derecho', date: 'Aug 10, 2020', opcos: ['ComEd'],
    outages: 890000, desc: 'Cat-1 equivalent winds across northern IL. 1 in 4 ComEd customers lost power.', lat: 41.9, lng: -88.2 },
  { id: 'W2', type: 'severe', icon: 'ice', title: 'Ice Storm Nika', date: 'Feb 5, 2014', opcos: ['PECO', 'BGE'],
    outages: 410000, desc: '2nd most damaging storm in PECO 135-year history. 91% restored within 72 hours.', lat: 40.0, lng: -75.3 },
  { id: 'W3', type: 'severe', icon: 'hurricane', title: 'Hurricane Isaias', date: 'Aug 4, 2020', opcos: ['ACE', 'DPL', 'PECO', 'Pepco'],
    outages: 680000, desc: 'Category 1 hurricane impacting mid-Atlantic. Major tree damage across NJ/DE.', lat: 39.3, lng: -74.8 },
  { id: 'W4', type: 'moderate', icon: 'heat', title: 'Heat Dome — Record Load', date: 'Jul 19, 2024', opcos: ['ComEd', 'PECO', 'BGE'],
    outages: 125000, desc: 'Extended heat wave. ComEd set all-time peak demand record at 22,500 MW.', lat: 40.5, lng: -79.0 },
  { id: 'W5', type: 'moderate', icon: 'wind', title: "Nor'easter Kenan", date: 'Jan 29, 2022', opcos: ['ACE', 'DPL', 'PECO'],
    outages: 340000, desc: 'Blizzard conditions with 60+ mph gusts. Coastal flooding in southern NJ.', lat: 39.6, lng: -74.4 },
  { id: 'W6', type: 'severe', icon: 'tornado', title: 'ComEd Tornado Outbreak', date: 'Jun 21, 2021', opcos: ['ComEd'],
    outages: 520000, desc: 'EF-3 tornado + widespread straight-line winds across suburban Chicago.', lat: 41.7, lng: -88.1 },
  { id: 'W7', type: 'moderate', icon: 'ice', title: 'Delmarva Ice Storm', date: 'Dec 17, 2023', opcos: ['DPL', 'ACE'],
    outages: 185000, desc: 'Freezing rain accumulation caused widespread line and tree damage.', lat: 38.9, lng: -75.4 },
  { id: 'W8', type: 'minor', icon: 'wind', title: 'Spring Windstorm', date: 'Mar 14, 2024', opcos: ['Pepco', 'BGE'],
    outages: 62000, desc: 'Sustained 40-50 mph winds with isolated 70 mph gusts across DC metro.', lat: 39.0, lng: -76.8 },
  { id: 'W9', type: 'severe', icon: 'hurricane', title: 'Tropical Storm Ophelia', date: 'Sep 23, 2023', opcos: ['BGE', 'Pepco', 'DPL'],
    outages: 290000, desc: 'Remnants brought heavy rain and flooding to mid-Atlantic region.', lat: 39.1, lng: -76.5 },
  { id: 'W10', type: 'moderate', icon: 'thunder', title: 'Severe Thunderstorm Complex', date: 'Jul 12, 2022', opcos: ['PECO', 'BGE'],
    outages: 210000, desc: 'Supercell thunderstorms with large hail and damaging winds.', lat: 39.9, lng: -75.8 },
];

// ─── Outage Trend ───

export const OUTAGE_TREND: OutageTrend[] = [
  { yr: 2014, count: 1050, weather: 680 }, { yr: 2015, count: 920, weather: 590 },
  { yr: 2016, count: 980, weather: 650 }, { yr: 2017, count: 1150, weather: 810 },
  { yr: 2018, count: 1080, weather: 720 }, { yr: 2019, count: 1240, weather: 860 },
  { yr: 2020, count: 1680, weather: 1250 }, { yr: 2021, count: 1520, weather: 1080 },
  { yr: 2022, count: 1410, weather: 980 }, { yr: 2023, count: 1580, weather: 1120 },
  { yr: 2024, count: 1675, weather: 1190 },
];

// ─── Impact by Cause ───

export const IMPACT_CAUSES: ImpactCause[] = [
  { cause: 'Severe Weather', hours: 4200000, color: 'rgb(251,113,133)' },
  { cause: 'Equipment Age', hours: 1850000, color: 'rgb(251,191,36)' },
  { cause: 'Vegetation', hours: 1420000, color: 'rgb(52,211,153)' },
  { cause: 'Animal Contact', hours: 680000, color: 'rgb(167,139,250)' },
  { cause: 'Overload', hours: 520000, color: 'rgb(56,189,248)' },
  { cause: 'Third-Party', hours: 380000, color: 'rgb(251,146,60)' },
];

// ─── Failure Modes ───

export const FAILURE_MODES: FailureMode[] = [
  { name: 'Insulation Degradation', pct: 28, color: 'rgb(251,113,133)' },
  { name: 'Bushing Failure', pct: 19, color: 'rgb(251,191,36)' },
  { name: 'Tap Changer Wear', pct: 16, color: 'rgb(56,189,248)' },
  { name: 'Cooling System', pct: 14, color: 'rgb(34,211,238)' },
  { name: 'Oil Contamination', pct: 12, color: 'rgb(167,139,250)' },
  { name: 'Winding Fault', pct: 7, color: 'rgb(52,211,153)' },
  { name: 'Other', pct: 4, color: 'rgba(255,255,255,0.2)' },
];

// ═══════════════════════════════════════════════════════════════
// PROCEDURAL FLEET GENERATION
// ═══════════════════════════════════════════════════════════════

function seededRandom(seed: number) {
  let s = seed;
  return function () { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; };
}

interface VoltageClass {
  kv: string;
  pct: number;
  custMin: number;
  custMax: number;
}

interface DensityCenter {
  lat: number;
  lng: number;
  r: number;
  w: number;
}

interface OpCoGeo {
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  centers: DensityCenter[];
  substationCount: number;
  voltages: VoltageClass[];
}

const SUBSTATION_NAMES: Record<string, string[]> = {
  ComEd: ['Jefferson','Elmhurst','Crawford','Fisk','Electric Junction','Maywood','Cicero','Berwyn','Oak Park',
    'Evanston','Skokie','Palatine','Schaumburg','Naperville','Aurora','Joliet','Waukegan','Des Plaines',
    'Park Ridge','Norridge','Niles','Morton Grove','Glenview','Northbrook','Highland Park','Lake Forest',
    'Libertyville','Mundelein','Round Lake','Woodstock','Crystal Lake','McHenry','Elgin','St. Charles',
    'Geneva','Batavia','Oswego','Plainfield','Romeoville','Lockport','Lemont','Orland Park','Tinley Park',
    'Homewood','Harvey','Calumet','Chicago Heights','Lansing','Hammond','Gary','Wicker Park','Logan Square',
    'Albany Park','Edgewater','Rogers Park','West Loop','Pilsen','Bridgeport','Brighton Park','Back of Yards',
    'Pullman','Hegewisch','South Chicago','Blue Island','Alsip','Palos Hills','Oak Lawn','Evergreen Park',
    'Dolton','Riverdale','Wheaton','Glen Ellyn','Lombard','Addison','Wood Dale','Bensenville','Elk Grove',
    'Rolling Meadows','Arlington Heights','Mount Prospect','Prospect Heights','Buffalo Grove','Wheeling',
    'Deerfield','Vernon Hills','Lincolnshire','Lake Zurich','Barrington','Cary','Algonquin','Huntley',
    'DeKalb','Sycamore','Rochelle','Dixon','Sterling','Ottawa','Morris','Kankakee','Bourbonnais',
    'Bradley','Manteno','Peotone','Mokena','New Lenox','Frankfort','Matteson','Richton Park','Olympia Fields',
    'Flossmoor','Country Club Hills','Markham','Midlothian','Oak Forest','Crestwood','Worth','Chicago Ridge',
    'Bedford Park','Summit','McCook','Lyons','Brookfield','La Grange','Western Springs','Hinsdale',
    'Clarendon Hills','Westmont','Downers Grove','Woodridge','Bolingbrook','Lisle','Warrenville',
    'West Chicago','Carol Stream','Hanover Park','Streamwood','Bartlett','Wayne','South Elgin','Dundee',
    'Carpentersville','Hampshire','Pingree Grove','Gilberts','Plano','Yorkville','Minooka','Channahon',
    'Shorewood','Troy','Crest Hill','Rockdale','Coal City','Braidwood','Wilmington','Watseka',
    'Pontiac','Streator','LaSalle','Peru','Oglesby','Marseilles','Seneca','Sandwich','Plano North'],
  PECO: ['Plymouth Meeting','Eddystone','Whitpain','Norristown','Conshohocken','King of Prussia',
    'Collegeville','Pottstown','Phoenixville','West Chester','Media','Chester','Marcus Hook','Swarthmore',
    'Springfield','Broomall','Havertown','Drexel Hill','Upper Darby','Lansdowne','Yeadon','Darby',
    'Folcroft','Ridley Park','Prospect Park','Glenolden','Norwood','Interboro','Collingdale','Sharon Hill',
    'Clifton Heights','Aldan','Lansdowne East','Ardmore','Bryn Mawr','Villanova','Wayne','Devon',
    'Malvern','Exton','Downingtown','Coatesville','Paoli','Berwyn','Bala Cynwyd','Gladwyne','Narberth',
    'Merion','Penn Valley','Wynnewood','Overbrook','Manayunk','Roxborough','Chestnut Hill','Mount Airy',
    'Germantown','Cheltenham','Jenkintown','Abington','Glenside','Wyndmoor','Flourtown','Fort Washington',
    'Ambler','Horsham','Warminster','Doylestown','New Hope','Langhorne','Bensalem','Bristol','Levittown',
    'Fairless Hills','Morrisville','Newtown','Yardley','Richboro','Warrington','Chalfont','Souderton',
    'Perkasie','Quakertown','Sellersville','Telford','North Wales','Lansdale','Harleysville','Skippack',
    'Limerick','Royersford','Trappe','Schwenksville','Green Lane','Pennsburg','East Greenville'],
  BGE: ['Westport','Canton','Calvert Cliffs','Riverside','Dundalk','Essex','Middle River','Towson',
    'Pikesville','Owings Mills','Reisterstown','Westminster','Eldersburg','Ellicott City','Columbia',
    'Laurel','Bowie','Odenton','Severn','Glen Burnie','Pasadena','Annapolis','Severna Park','Arnold',
    'Edgewater','Crofton','Gambrills','Millersville','Crownsville','Hanover','Arbutus','Catonsville',
    'Woodlawn','Randallstown','Liberty','Hampstead','Manchester','Taneytown','Sykesville','Marriottsville',
    'Clarksville','Dayton','Highland','Savage','Jessup','Linthicum','Brooklyn Park','Curtis Bay',
    'Halethorpe','Lansdowne MD','Pump','Hamilton','Rosedale','White Marsh','Perry Hall','Nottingham',
    'Joppa','Edgewood','Aberdeen','Havre de Grace','Bel Air','Fallston','Forest Hill','Jarrettsville',
    'Pylesville','Street','North East','Elkton','Rising Sun','Chesapeake City','Perryville','Port Deposit'],
  Pepco: ['Benning Road','Capitol Hill','Takoma','Silver Spring','Bethesda','Chevy Chase','Rockville',
    'Gaithersburg','Germantown MD','Clarksburg','Damascus','Poolesville','Potomac','Cabin John',
    'Glen Echo','Friendship Heights','Tenleytown','Georgetown','Foggy Bottom','Adams Morgan','Columbia Heights',
    'Petworth','Brookland','Woodridge','Michigan Park','Fort Totten','Brightwood','Shepherd Park',
    'Wheaton','Kensington','Garrett Park','Laytonsville','Olney','Burtonsville','White Oak','Adelphi',
    'College Park','Greenbelt','Beltsville','Riverdale','Hyattsville','Landover','Upper Marlboro',
    'Bowie MD','Crofton MD','Mitchellville','Largo','Temple Hills','Oxon Hill','Forestville',
    'District Heights','Suitland','Camp Springs','Clinton','Waldorf','La Plata','Indian Head',
    'Brandywine','Aquasco','Dunkirk','Chesapeake Beach'],
  ACE: ['Cardiff','Lewis','Pleasantville','Atlantic City','Egg Harbor','Hammonton','Vineland',
    'Millville','Bridgeton','Salem','Pennsville','Woodstown','Glassboro','Clayton','Franklinville',
    'Williamstown','Sicklerville','Winslow','Berlin','Clementon','Lindenwold','Bellmawr','Runnemede',
    'Woodbury','Deptford','Westville','Paulsboro','Swedesboro','Mullica Hill','Sewell','Turnersville',
    'Blackwood','Pine Hill','Waterford','Atco','Medford','Tabernacle','Chatsworth','Tuckerton',
    'Manahawkin','Beach Haven','Barnegat','Waretown','Forked River','Lacey','Bayville','Beachwood',
    'Toms River','Brick','Point Pleasant','Manasquan','Asbury Park','Ocean Grove','Neptune'],
  DPL: ['Indian River','Edge Moor','Christiana','Newark DE','Wilmington','New Castle','Bear',
    'Glasgow','Middletown DE','Odessa','Townsend','Smyrna','Dover','Camden','Wyoming','Felton',
    'Harrington','Milford','Georgetown DE','Seaford','Laurel DE','Delmar','Salisbury','Fruitland',
    'Princess Anne','Crisfield','Pocomoke','Snow Hill','Berlin MD','Ocean City','Easton','St. Michaels',
    'Cambridge','Hurlock','Federalsburg','Denton','Greensboro','Ridgely','Centreville','Chestertown',
    'Rock Hall','Galena','Cecilton','Chesapeake City DE','North Claymont','Talleyville','Hockessin',
    'Pike Creek','Stanton','Newport','Elsmere','Holly Oak','Brandywine DE','Greenville DE'],
};

const OPCO_GEO: Record<string, OpCoGeo> = {
  ComEd: {
    latMin: 41.35, latMax: 42.5, lngMin: -88.9, lngMax: -87.3,
    centers: [
      { lat: 41.88, lng: -87.63, r: 0.15, w: 0.35 },
      { lat: 41.85, lng: -87.75, r: 0.12, w: 0.15 },
      { lat: 42.0, lng: -87.7, r: 0.15, w: 0.12 },
      { lat: 41.75, lng: -88.0, r: 0.2, w: 0.1 },
      { lat: 42.3, lng: -87.85, r: 0.15, w: 0.08 },
      { lat: 41.6, lng: -87.6, r: 0.15, w: 0.08 },
      { lat: 42.05, lng: -88.3, r: 0.25, w: 0.06 },
      { lat: 41.5, lng: -88.1, r: 0.2, w: 0.06 },
    ],
    substationCount: 250,
    voltages: [
      { kv: '765', pct: 0.01, custMin: 200000, custMax: 500000 },
      { kv: '345', pct: 0.06, custMin: 80000, custMax: 200000 },
      { kv: '138', pct: 0.28, custMin: 20000, custMax: 85000 },
      { kv: '34.5', pct: 0.35, custMin: 5000, custMax: 25000 },
      { kv: '12', pct: 0.30, custMin: 800, custMax: 6000 },
    ],
  },
  PECO: {
    latMin: 39.8, latMax: 40.35, lngMin: -75.65, lngMax: -74.85,
    centers: [
      { lat: 39.95, lng: -75.17, r: 0.08, w: 0.3 },
      { lat: 40.1, lng: -75.3, r: 0.12, w: 0.2 },
      { lat: 40.0, lng: -75.45, r: 0.15, w: 0.15 },
      { lat: 39.88, lng: -75.35, r: 0.1, w: 0.12 },
      { lat: 40.2, lng: -75.1, r: 0.1, w: 0.12 },
      { lat: 40.15, lng: -75.55, r: 0.12, w: 0.11 },
    ],
    substationCount: 100,
    voltages: [
      { kv: '230', pct: 0.08, custMin: 40000, custMax: 120000 },
      { kv: '138', pct: 0.15, custMin: 15000, custMax: 55000 },
      { kv: '69', pct: 0.32, custMin: 5000, custMax: 20000 },
      { kv: '13.2', pct: 0.45, custMin: 800, custMax: 6000 },
    ],
  },
  BGE: {
    latMin: 38.3, latMax: 39.7, lngMin: -77.0, lngMax: -76.15,
    centers: [
      { lat: 39.28, lng: -76.62, r: 0.1, w: 0.3 },
      { lat: 39.15, lng: -76.75, r: 0.15, w: 0.15 },
      { lat: 39.4, lng: -76.45, r: 0.12, w: 0.15 },
      { lat: 39.2, lng: -76.85, r: 0.15, w: 0.12 },
      { lat: 38.98, lng: -76.5, r: 0.2, w: 0.1 },
      { lat: 38.5, lng: -76.45, r: 0.15, w: 0.08 },
      { lat: 39.55, lng: -76.3, r: 0.15, w: 0.1 },
    ],
    substationCount: 80,
    voltages: [
      { kv: '500', pct: 0.03, custMin: 80000, custMax: 200000 },
      { kv: '230', pct: 0.1, custMin: 30000, custMax: 90000 },
      { kv: '115', pct: 0.3, custMin: 10000, custMax: 40000 },
      { kv: '34.5', pct: 0.25, custMin: 3000, custMax: 15000 },
      { kv: '13.2', pct: 0.32, custMin: 500, custMax: 4000 },
    ],
  },
  Pepco: {
    latMin: 38.7, latMax: 39.2, lngMin: -77.25, lngMax: -76.75,
    centers: [
      { lat: 38.9, lng: -77.02, r: 0.06, w: 0.35 },
      { lat: 38.98, lng: -77.1, r: 0.08, w: 0.2 },
      { lat: 39.08, lng: -77.15, r: 0.1, w: 0.15 },
      { lat: 38.82, lng: -76.88, r: 0.08, w: 0.15 },
      { lat: 38.95, lng: -76.93, r: 0.08, w: 0.15 },
    ],
    substationCount: 60,
    voltages: [
      { kv: '230', pct: 0.08, custMin: 40000, custMax: 100000 },
      { kv: '69', pct: 0.35, custMin: 8000, custMax: 35000 },
      { kv: '13.8', pct: 0.57, custMin: 800, custMax: 8000 },
    ],
  },
  ACE: {
    latMin: 39.0, latMax: 40.2, lngMin: -75.2, lngMax: -74.0,
    centers: [
      { lat: 39.36, lng: -74.42, r: 0.1, w: 0.25 },
      { lat: 39.5, lng: -74.75, r: 0.15, w: 0.2 },
      { lat: 39.8, lng: -75.0, r: 0.12, w: 0.15 },
      { lat: 39.15, lng: -74.8, r: 0.12, w: 0.15 },
      { lat: 39.95, lng: -74.2, r: 0.1, w: 0.12 },
      { lat: 39.65, lng: -74.55, r: 0.12, w: 0.13 },
    ],
    substationCount: 50,
    voltages: [
      { kv: '230', pct: 0.06, custMin: 25000, custMax: 80000 },
      { kv: '69', pct: 0.3, custMin: 5000, custMax: 25000 },
      { kv: '13.2', pct: 0.64, custMin: 500, custMax: 6000 },
    ],
  },
  DPL: {
    latMin: 38.4, latMax: 39.85, lngMin: -75.8, lngMax: -75.0,
    centers: [
      { lat: 39.74, lng: -75.55, r: 0.08, w: 0.3 },
      { lat: 39.6, lng: -75.7, r: 0.1, w: 0.15 },
      { lat: 39.2, lng: -75.55, r: 0.15, w: 0.12 },
      { lat: 38.7, lng: -75.15, r: 0.2, w: 0.12 },
      { lat: 38.55, lng: -75.07, r: 0.15, w: 0.1 },
      { lat: 38.95, lng: -75.8, r: 0.15, w: 0.1 },
      { lat: 39.0, lng: -75.35, r: 0.12, w: 0.11 },
    ],
    substationCount: 50,
    voltages: [
      { kv: '230', pct: 0.06, custMin: 20000, custMax: 65000 },
      { kv: '138', pct: 0.15, custMin: 8000, custMax: 30000 },
      { kv: '69', pct: 0.32, custMin: 3000, custMax: 15000 },
      { kv: '13.2', pct: 0.47, custMin: 400, custMax: 5000 },
    ],
  },
};

function generateAge(rng: () => number): number {
  const r = rng();
  if (r < 0.04) return Math.floor(rng() * 5) + 1;
  if (r < 0.12) return Math.floor(rng() * 5) + 6;
  if (r < 0.22) return Math.floor(rng() * 5) + 11;
  if (r < 0.34) return Math.floor(rng() * 5) + 16;
  if (r < 0.46) return Math.floor(rng() * 5) + 21;
  if (r < 0.56) return Math.floor(rng() * 5) + 26;
  if (r < 0.65) return Math.floor(rng() * 5) + 31;
  if (r < 0.77) return Math.floor(rng() * 5) + 36;
  if (r < 0.88) return Math.floor(rng() * 5) + 41;
  if (r < 0.95) return Math.floor(rng() * 5) + 46;
  return Math.floor(rng() * 10) + 51;
}

function generateHealth(age: number, rng: () => number): number {
  let base = 95 - (age * 1.1) + (rng() - 0.5) * 20;
  if (rng() < 0.06) base = 15 + rng() * 25;
  return Math.max(12, Math.min(98, Math.round(base)));
}

function generateLoad(isUrban: boolean, rng: () => number): number {
  const base = isUrban ? 70 : 55;
  return Math.round(base + rng() * 30);
}

function generateLocation(geo: OpCoGeo, rng: () => number) {
  const totalW = geo.centers.reduce((s, c) => s + c.w, 0);
  let pick = rng() * totalW;
  let center = geo.centers[0];
  for (const c of geo.centers) {
    pick -= c.w;
    if (pick <= 0) { center = c; break; }
  }
  const lat = center.lat + (rng() + rng() + rng() - 1.5) * center.r;
  const lng = center.lng + (rng() + rng() + rng() - 1.5) * center.r * 1.3;
  return {
    lat: Math.max(geo.latMin, Math.min(geo.latMax, lat)),
    lng: Math.max(geo.lngMin, Math.min(geo.lngMax, lng)),
  };
}

function pickVoltage(voltages: VoltageClass[], rng: () => number): VoltageClass {
  const r = rng();
  let cum = 0;
  for (const v of voltages) { cum += v.pct; if (r < cum) return v; }
  return voltages[voltages.length - 1];
}

// Generate full fleet
export function generateFleet(): { assets: SubstationAsset[]; stats: FleetStats } {
  const rng = seededRandom(42);
  const assets: SubstationAsset[] = [];
  let globalId = 1;

  const FAILURE_MODES_BY_AGE = [
    { mode: 'Insulation degradation', minAge: 25, materials: ['Insulating oil', 'Kraft paper', 'Gaskets'], skills: ['Oil processing', 'Vacuum treatment'] },
    { mode: 'Bushing failure', minAge: 15, materials: ['Replacement bushing', 'Gasket kit', 'Transformer oil'], skills: ['HV bushing replacement', 'Crane operation'] },
    { mode: 'Tap changer wear', minAge: 10, materials: ['OLTC contacts', 'Drive mechanism parts', 'Diverter oil'], skills: ['OLTC overhaul', 'Mechanical adjustment'] },
    { mode: 'Cooling system failure', minAge: 20, materials: ['Radiator fans', 'Oil pump', 'Temperature sensors'], skills: ['Cooling system repair', 'Electrical testing'] },
    { mode: 'Winding fault', minAge: 30, materials: ['Copper conductor', 'Insulation wrap', 'Core steel'], skills: ['Winding replacement', 'Factory rebuild'] },
    { mode: 'Oil contamination', minAge: 5, materials: ['Transformer oil', 'Filter elements', 'Desiccant'], skills: ['Oil filtration', 'DGA sampling'] },
    { mode: 'Gasket/seal leak', minAge: 8, materials: ['Nitrile gaskets', 'Sealant', 'Drain valve'], skills: ['Seal replacement', 'Oil containment'] },
  ];

  for (const [opcoId, geo] of Object.entries(OPCO_GEO)) {
    const names = SUBSTATION_NAMES[opcoId];
    for (let i = 0; i < geo.substationCount; i++) {
      const loc = generateLocation(geo, rng);
      const vClass = pickVoltage(geo.voltages, rng);
      const age = generateAge(rng);
      const isUrban = geo.centers.some(c =>
        Math.abs(loc.lat - c.lat) < c.r * 0.6 && Math.abs(loc.lng - c.lng) < c.r * 0.8
      );
      const health = generateHealth(age, rng);
      const load = generateLoad(isUrban, rng);
      const customers = Math.round(vClass.custMin + rng() * (vClass.custMax - vClass.custMin));
      const nameIdx = i % names.length;
      const suffix = parseFloat(vClass.kv) >= 69 ? ` ${vClass.kv}kV` : ` Sub #${Math.floor(rng() * 9) + 1}`;

      // Predictive maintenance generation
      const eligible = FAILURE_MODES_BY_AGE.filter(f => age >= f.minAge);
      const fm = eligible.length > 0 ? eligible[Math.floor(rng() * eligible.length)] : FAILURE_MODES_BY_AGE[5]; // default oil contamination

      // Time to failure: correlated with health
      const ttfMonths = health < 30 ? Math.floor(rng() * 6 + 1)
        : health < 50 ? Math.floor(rng() * 18 + 6)
        : health < 70 ? Math.floor(rng() * 36 + 18)
        : Math.floor(rng() * 60 + 36);
      const ttf = ttfMonths < 12 ? `${ttfMonths} mo` : `${(ttfMonths / 12).toFixed(1)} yr`;

      // Repair window: based on urgency
      const repairWindow = health < 30 ? 'Immediate' : health < 50 ? 'Within 30 days' : health < 70 ? 'Next outage cycle' : 'Scheduled PM';

      // Repair duration: based on failure mode severity
      const isHeavy = fm.mode.includes('Winding') || fm.mode.includes('Bushing');
      const hours = isHeavy ? Math.floor(rng() * 72 + 48) : Math.floor(rng() * 24 + 4);
      const repairDuration = hours >= 48 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`;

      // Risk trend
      const riskTrend = health < 40 && load > 70 ? 'critical' as const
        : health < 60 || (age > 35 && load > 60) ? 'degrading' as const
        : 'stable' as const;

      assets.push({
        tag: `${opcoId.toUpperCase().replace(/ /g, '')}-${String(globalId).padStart(4, '0')}`,
        name: names[nameIdx] + suffix,
        lat: loc.lat, lng: loc.lng,
        opco: opcoId,
        age, health, load,
        kv: vClass.kv,
        customers,
        ttf,
        repairWindow,
        repairDuration,
        materials: fm.materials,
        skills: fm.skills,
        failureMode: fm.mode,
        riskTrend,
      });
      globalId++;
    }
  }

  const stats: FleetStats = {
    total: assets.length,
    totalReal: 6230,
    sampleRatio: '1:10.5',
    pctOver40: Math.round(assets.filter(a => a.age > 40).length / assets.length * 100),
    pctPoor: Math.round(assets.filter(a => a.health < 40).length / assets.length * 100),
    avgAge: Math.round(assets.reduce((s, a) => s + a.age, 0) / assets.length),
    avgHealth: Math.round(assets.reduce((s, a) => s + a.health, 0) / assets.length),
  };

  return { assets, stats };
}

// Generate heatmap data from assets
export function generateHeatData(assets: SubstationAsset[]): [number, number, number][] {
  const rng = seededRandom(7777);
  const heat: [number, number, number][] = [];

  assets.forEach(a => {
    const intensity = Math.min(1.0, 0.3 + (100 - a.health) / 100 * 0.5 + (a.load / 100) * 0.2);
    heat.push([a.lat, a.lng, intensity * (0.7 + rng() * 0.3)]);
    const scatter = Math.floor(1 + rng() * 3);
    for (let i = 0; i < scatter; i++) {
      heat.push([
        a.lat + (rng() - 0.5) * 0.08,
        a.lng + (rng() - 0.5) * 0.1,
        intensity * (0.3 + rng() * 0.5),
      ]);
    }
  });

  // Background outages
  const bg: [number, number, number][] = [
    ...Array.from({ length: 40 }, (): [number, number, number] => [41.4 + rng() * 1.1, -88.8 + rng() * 1.5, 0.15 + rng() * 0.25]),
    ...Array.from({ length: 20 }, (): [number, number, number] => [39.85 + rng() * 0.5, -75.6 + rng() * 0.7, 0.1 + rng() * 0.3]),
    ...Array.from({ length: 25 }, (): [number, number, number] => [38.4 + rng() * 1.2, -76.9 + rng() * 0.7, 0.1 + rng() * 0.25]),
    ...Array.from({ length: 15 }, (): [number, number, number] => [39.1 + rng() * 0.8, -74.9 + rng() * 0.8, 0.12 + rng() * 0.3]),
    ...Array.from({ length: 15 }, (): [number, number, number] => [38.5 + rng() * 1.2, -75.7 + rng() * 0.6, 0.08 + rng() * 0.2]),
    ...Array.from({ length: 10 }, (): [number, number, number] => [38.8 + rng() * 0.3, -77.2 + rng() * 0.3, 0.12 + rng() * 0.2]),
  ];

  return [...heat, ...bg];
}

// Age distribution computed from fleet
export function computeAgeDist(assets: SubstationAsset[]) {
  return [
    { range: '0–10 yr', count: assets.filter(a => a.age <= 10).length, color: 'rgb(52,211,153)' },
    { range: '11–20 yr', count: assets.filter(a => a.age > 10 && a.age <= 20).length, color: 'rgb(56,189,248)' },
    { range: '21–30 yr', count: assets.filter(a => a.age > 20 && a.age <= 30).length, color: 'rgb(34,211,238)' },
    { range: '31–40 yr', count: assets.filter(a => a.age > 30 && a.age <= 40).length, color: 'rgb(251,191,36)' },
    { range: '41–50 yr', count: assets.filter(a => a.age > 40 && a.age <= 50).length, color: 'rgb(251,146,60)' },
    { range: '51–60 yr', count: assets.filter(a => a.age > 50).length, color: 'rgb(251,113,133)' },
  ];
}
