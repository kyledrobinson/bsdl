/* matchDetails.js — Bloor Street Dart League (25/26 season, light/dark ready)
   - Team Standings from Google Apps Script
   - Player Stats from server.php
   - Search + Sort + Pagination
   - Match details tabs (Home | Away | Venue) + auto-highlight current week
   - Date badge beside "Team Standings" (today/next)
   - Upcoming Matches (Date | Time | Home | Away | Venue) — first 12 fall dates only
   
   [2025-09-14] Update:
   - Auto-build the Player <thead> from PLAYER_COLS (shows all columns)
   - Normalize incoming JSON keys (e.g., 4Fin -> 4 Fin.) so cells don't go blank
*/

let teamData = [];
let playersData = [];
let currentSortColumn = 'Pos';
let isAscending = true;

let currentPage = 1;
const rowsPerPage = 15;

// ---- Endpoints ----
const SCRIPT_URL  = 'https://script.google.com/macros/s/AKfycbzTuDXGlzPu-ffSOljwV19VkBHJ1R8eYS90TYMe3P775IB3xFbrodFc2J8o2Ub6lYPd6w/exec'; // Apps Script
const playersURL  = 'server.php'; // PHP JSON feed

// =====================================================
// 25/26 SEASON SCHEDULE (Round 2 begins in December)
// =====================================================
// Round 1 (Fall 2025): Sep 9 -> Nov 25 (skip Nov 11)
const ROUND1_FALL_25 = [
  '2025-09-09','2025-09-16','2025-09-23','2025-09-30',
  '2025-10-07','2025-10-14','2025-10-21','2025-10-28',
  '2025-11-04','2025-11-18','2025-11-25'
];
// Round 2 (Winter 2025–26): Dec 2 & 9, then Jan–Mar
const ROUND2_WINTER_26 = [
  '2025-12-02','2025-12-09',
  '2026-01-06','2026-01-13','2026-01-20','2026-01-27',
  '2026-02-03','2026-02-10','2026-02-17','2026-02-24',
  '2026-03-03'
];
// Full 25/26 season (standings badge + HA/V schedule tabs)
const SEASON_25_26 = [...ROUND1_FALL_25, ...ROUND2_WINTER_26];
// Upcoming Matches: ONLY first 12 dates (Sep 9 → Dec 2)
const UPCOMING_SCHEDULE = [...ROUND1_FALL_25, '2025-12-02'];

// =====================================================
// Utilities
// =====================================================
function showError(msg){
  const el = document.getElementById('errorMessage');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function fmt(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month:'long', day:'numeric', year:'numeric' });
}

function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}`;
}

// index of "today if match day, else next upcoming"; -1 if after last date
function nextMatchIndex(schedule) {
  const t = todayISO();
  for (let i = 0; i < schedule.length; i++) if (schedule[i] >= t) return i;
  return -1;
}

// same, but clamps to last visible week (for Upcoming view)
function nextWeekIndexFor(schedule){
  const t = todayISO();
  for (let i = 0; i < schedule.length; i++) if (schedule[i] >= t) return i;
  return schedule.length - 1;
}

function ensureTabInView(btn) {
  if (btn && btn.scrollIntoView) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

// Manual hook if you ever set the badge explicitly
function updateStandingsDate(iso){
  const t = document.getElementById('standingsDate');
  if (!t) return;
  t.setAttribute('datetime', iso);
  try {
    t.textContent = new Date(iso).toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' });
  } catch { t.textContent = iso; }
}

// Auto-set the date badge beside "Team Standings" to today/next match
function updateStandingsDateAuto() {
  const el = document.getElementById('standingsDate');
  if (!el) return;

  let idx = nextMatchIndex(SEASON_25_26);
  if (idx >= 0) {
    const iso = SEASON_25_26[idx];
    el.setAttribute('datetime', iso);
    el.textContent = fmt(iso);
    el.title = (iso === todayISO()) ? 'Match Day' : 'Next Match';
  } else {
    const last = SEASON_25_26[SEASON_25_26.length - 1];
    el.setAttribute('datetime', last);
    el.textContent = 'Season Complete (Mar 3, 2026)';
    el.title = 'Season Complete';
  }
}

function updateSortIndicators(tableSelector, column){
  const headers = document.querySelectorAll(`${tableSelector} thead th`);
  headers.forEach(h => h.classList.remove('sort-asc','sort-desc'));
  const th = Array.from(headers).find(h => (h.dataset.column||'') === column);
  if (th) th.classList.add(isAscending ? 'sort-asc':'sort-desc');
}

// =====================================================
// Team Standings
// =====================================================
async function fetchTeamData(){
  try {
    const response = await fetch(SCRIPT_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) throw new Error('No data');

    processTeamData(data);
    renderTeamTable(teamData);
    addSortingListeners('#teamStandings', sortTeamData);
    addTeamSearchFunctionality(); // team-only search to match placeholder
  } catch (err){
    console.error(err);
    showError('Could not load standings. Please refresh.');
  }
}

const IGNORE_COL_INDEXES = new Set([8, 9]); // zero-based: I=8, J=9

function processTeamData(raw){
  const headers = raw[0] || [];
  teamData = raw.slice(1).map((row, idx) => {
    const team = { Pos: idx + 1 };
    headers.forEach((header, i) => {
      if (IGNORE_COL_INDEXES.has(i)) return; // <-- skip I & J entirely

      const h0 = String(header ?? '').trim();
      const h  = HEADER_ALIASES?.[h0] || h0;

      const val = row[i];
      if (h === 'Win Percentage') {
        let v = val; if (typeof v === 'string') v = v.replace('%','').trim();
        const num = Number(v);
        team[h] = Number.isFinite(num) ? num : '';
      } else if (val === '' || val == null) {
        team[h] = '';
      } else if (typeof val === 'number') {
        team[h] = val;
      } else {
        const num = Number(val);
        team[h] = Number.isFinite(num) ? num : String(val);
      }
    });
    return team;
  }).filter(t => t.Team && String(t.Team).trim() !== '');
}



function sortData(data, column){
  return data.sort((a,b) => {
    let A = a[column], B = b[column];
    if (typeof A === 'string') A = A.toLowerCase();
    if (typeof B === 'string') B = B.toLowerCase();
    if (A < B) return isAscending ? -1 : 1;
    if (A > B) return isAscending ? 1 : -1;
    return 0;
  });
}

function sortTeamData(column){
  if (currentSortColumn === column) {
    isAscending = !isAscending;
  } else {
    currentSortColumn = column;
    isAscending = true;
  }
  teamData = sortData(teamData, column);
  if (column !== 'Pos'){
    teamData.forEach((t,i)=> t.Pos = i+1);
  }
  updateSortIndicators('#teamStandings', column);
  renderTeamTable(teamData);
}

function getTeamColumnsFromThead() {
  const ths = document.querySelectorAll('#teamStandings thead [data-column]');
  return Array.from(ths).map(th => th.getAttribute('data-column'));
}

function renderTeamTable(data){
  const tbody = document.getElementById('teamStandingsBody');
  if (!tbody){ console.error('Team standings table body element not found'); return; }
  tbody.innerHTML = '';

  data.forEach(team => {
    const pct = team['Win Percentage'] != null
      ? Number(team['Win Percentage']).toFixed(3)
      : '0.000';

    const skw = team['Skunk W'] ?? '';
    const skl = team['Skunk L'] ?? '';

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${team.Pos ?? ''}</td>
      <td>${team.Team ?? ''}</td>
      <td>${team['Nights Played'] ?? ''}</td>
      <td>${team['Nights Won'] ?? ''}</td>
      <td>${team['Nights Lost'] ?? ''}</td>
      <td>${team['Games Won'] ?? ''}</td>
      <td>${team['Games Lost'] ?? ''}</td>
      <td>${pct}</td>
      <td>${skw}</td>
      <td>${skl}</td>
    `;
    tbody.appendChild(row);
  });
}




function addSortingListeners(tableSelector, sortFn){
  const headers = document.querySelectorAll(`${tableSelector} th`);
  headers.forEach(h => {
    h.style.cursor = 'pointer';
    h.addEventListener('click', function(){
      const col = this.getAttribute('data-column');
      sortFn(col);
    });
  });
}

function addTeamSearchFunctionality(){
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase();
    const filtered = teamData.filter(t => String(t.Team||'').toLowerCase().includes(q));
    renderTeamTable(filtered);
  });
}


// ---- Player table config/order/formatters ----
const PLAYER_COLS = [
  'Pos','Team','Player','WP','GP','GW','DBL IN','GF','Win %','Finish %',
  'Skunk Win','B. Open','B. Fin.','High Start','High Finish','High Score',
  '4 Fin.','5 Fin.','Busts','Fewest Darts','LFT FIN'
];

// Columns that should be treated as numeric when rendering
const PLAYER_NUMERIC_COLS = new Set([
  'Pos','WP','GP','GW','DBL IN','GF','Win %','Finish %','Skunk Win','B. Open','B. Fin.',
  'High Start','High Finish','High Score','4 Fin.','5 Fin.','Busts','Fewest Darts','LFT FIN'
]);

// ---- Build the <thead> from PLAYER_COLS (so header always shows all columns)
function renderPlayerHeader(){
  const thead = document.querySelector('#playerStandings thead');
  if (!thead) { console.error('Player table <thead> not found'); return; }
  thead.innerHTML = `<tr>${
    PLAYER_COLS.map(col => `<th data-column="${col}">${col}</th>`).join('')
  }</tr>`;
}

// ---- Normalize incoming JSON keys from PHP (map common variations → labels)
const FIELD_ALIASES = {
  'High_Score':'High Score','HighScore':'High Score',
  'HighFinish':'High Finish','High_Finish':'High Finish',
  '4Fin':'4 Fin.','FourFin':'4 Fin.','4_Fin':'4 Fin.',
  '5Fin':'5 Fin.','FiveFin':'5 Fin.','5_Fin':'5 Fin.',
  'Bust':'Busts',
  'Fewest_Darts':'Fewest Darts','FewestDarts':'Fewest Darts',
  'LFT_FIN':'LFT FIN','LftFin':'LFT FIN',
  'BOpen':'B. Open','B_Open':'B. Open',
  'BFin':'B. Fin.','B_Fin':'B. Fin.'
};
function normalizePlayerRow(row){
  const out = {};
  for (const [k, v] of Object.entries(row)) out[FIELD_ALIASES[k] || k] = v;
  return out;
}

const fmtP = {
  num: v => (v ?? '') === '' ? '' : Number(v),
  pct: v => (v ?? '') === '' ? '' : Number(v).toFixed(2), // add '%' if desired
};

// =====================================================
// Player Stats
// =====================================================
async function fetchAndPopulatePlayers(){
  try{
    const r = await fetch(playersURL);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data)) throw new Error('Invalid data');

    // Build header first to ensure sort handlers bind correctly
    renderPlayerHeader();

    // Normalize keys to match PLAYER_COLS labels exactly
    playersData = data.map(normalizePlayerRow);

    renderPlayersTable(currentPage);
    setupPagination();
    addSortingListeners('#playerStandings', sortPlayersData);
  } catch(err){
    console.error('Error fetching players:', err);
  }
}

function sortPlayersData(column){
  if (currentSortColumn === column){
    isAscending = !isAscending;
  } else {
    currentSortColumn = column;
    isAscending = true;
  }
  playersData = sortData(playersData, column);
  renderPlayersTable(currentPage);
}

function renderPlayersTable(page){
  const tbody = document.getElementById('playerStandingsBody');
  if (!tbody){ console.error('Players standings table body element not found'); return; }

  const q = (document.getElementById('playerSearchInput')?.value || '').trim().toLowerCase();
  const filtered = q
    ? playersData.filter(r => String(r.Player||'').toLowerCase().includes(q) ||
                              String(r.Team||'').toLowerCase().includes(q))
    : playersData;

  const sortKey = (typeof currentSortColumn === 'string' && currentSortColumn) ? currentSortColumn : 'Team';
  const dir = isAscending ? 1 : -1;
  const sorted = [...filtered].sort((a,b) => {
    const A = a[sortKey] ?? '', B = b[sortKey] ?? '';
    const nA = +A, nB = +B;
    const bothNums = Number.isFinite(nA) && Number.isFinite(nB);
    const cmp = bothNums ? (nA - nB) : String(A).localeCompare(String(B), undefined, {numeric:true, sensitivity:'base'});
    return dir * cmp;
  });

  const start = (page - 1) * rowsPerPage;
  const slice = sorted.slice(start, start + rowsPerPage);

  const rows = slice.map(r => {
    return `<tr>${
      PLAYER_COLS.map(col => {
        const raw = r[col];
        let text = '';
        let alignRight = false;

        if (PLAYER_NUMERIC_COLS && PLAYER_NUMERIC_COLS.has(col)) {
          const n = Number(raw);
          if (Number.isFinite(n)) {
            alignRight = true;
            text = (col === 'Win %' || col === 'Finish %') ? n.toFixed(2) : String(n);
          } else {
            text = (raw ?? '');
          }
        } else {
          text = (raw ?? '');
        }

        return `<td${alignRight ? ' align=\"right\"' : ''}>${text}</td>`;
      }).join('')
    }</tr>`;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="${PLAYER_COLS.length}">No players found.</td></tr>`;
}

function setupPagination(){
  const q = (document.getElementById('playerSearchInput')?.value || '').trim().toLowerCase();
  const filteredCount = q
    ? playersData.filter(r => String(r.Player||'').toLowerCase().includes(q) ||
                              String(r.Team||'').toLowerCase().includes(q)).length
    : playersData.length;

  const totalPages = Math.max(1, Math.ceil(filteredCount / rowsPerPage));
  const pg = document.getElementById('pagination');
  if (!pg){ console.error('Pagination element not found'); return; }

  pg.innerHTML = '';
  for (let i=1; i<=totalPages; i++){
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = i === currentPage ? 'active' : '';
    btn.addEventListener('click', () => {
      currentPage = i;
      renderPlayersTable(currentPage);
      setupPagination();
    });
    pg.appendChild(btn);
  }
}

function initPlayerSearch(){
  const el = document.getElementById('playerSearchInput');
  if (!el) return;
  let t;
  el.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      currentPage = 1;
      renderPlayersTable(currentPage);
      setupPagination();
    }, 150);
  });
}


// =====================================================
// Venue detection & styling helpers (used in both views)
// =====================================================
function _normVenue(v){ return (v || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

const VENUE_CLASS_RULES = [
  { test: 'owlsunit306',   cls: 'green-highlight' },
  { test: 'rclb26646',     cls: 'green-highlight' },
  { test: 'acranchcafe',   cls: 'orange-highlight' },
  { test: 'coronation',    cls: 'venue-coronation' },
  { test: 'japas',         cls: 'venue-japas' }
];

function venueClassFor(venue, explicit){
  if (explicit) return explicit;
  const nv = _normVenue(venue);
  for (const r of VENUE_CLASS_RULES){
    if (nv.includes(r.test)) return r.cls;
  }
  return '';
}

// =====================================================
// Match Details (Home | Away | Venue) — existing view
// =====================================================
function renderMatchDetails(week){
  const el = document.getElementById('match-details');
  if (!el){ console.error('Match details element not found'); return; }
  el.innerHTML = '<p>Loading match details.</p>';

  // 'matchDetails' is expected to be defined elsewhere (your schedule data object)
  const scheduleData = (typeof matchDetails !== 'undefined') ? matchDetails[week] : null;
  if (scheduleData && scheduleData.length){
    let html = '<table class="match-details-table"><thead><tr><th>Home Team</th><th>Away Team</th><th>Venue</th></tr></thead><tbody>';
    scheduleData.forEach(m => {
      const vClass = venueClassFor(m.venue, m.class);
      html += `<tr><td>${m.home}</td><td>${m.away}</td><td class="${vClass}">${m.venue||''}</td></tr>`;
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  } else {
    el.innerHTML = '<p>No match details available.</p>';
  }
}

// Highlight correct week button based on the full-season schedule
function highlightWeekButton(){
  let idx = nextMatchIndex(SEASON_25_26);
  if (idx === -1) idx = SEASON_25_26.length - 1; // after season -> last
  const weekNumber = idx + 1;

  // Only touch the HA/V schedule tabs, not the Upcoming tabs
  const buttons = Array.from(document.querySelectorAll('button[role="tab"]'))
    .filter(b => !b.closest('#upcomingWeekTabs'));

  buttons.forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-selected','false');
  });

  const btn = document.querySelector(`button[role="tab"][data-week="week${weekNumber}"]:not(#upcomingWeekTabs button)`);
  if (btn){
    btn.classList.add('selected');
    btn.setAttribute('aria-selected','true');
    ensureTabInView(btn);
  }
  renderMatchDetails(`week${weekNumber}`);
}

// Scope the HA/V tabs only (avoid binding to Upcoming tabs)
function initializeTabs(){
  const buttons = Array.from(document.querySelectorAll('button[role="tab"]'))
    .filter(b => !b.closest('#upcomingWeekTabs'));
  buttons.forEach(btn => {
    btn.addEventListener('click', function(){
      const week = this.getAttribute('data-week');
      buttons.forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-selected','false');
      });
      this.classList.add('selected');
      this.setAttribute('aria-selected','true');
      ensureTabInView(this);
      renderMatchDetails(week);
    });
  });
}

// tolerate header variations coming from the sheet
const HEADER_ALIASES = {
  'Win %': 'Win Percentage',
  'Win%': 'Win Percentage',
  'Skunks W': 'Skunk W',
  'Skunk Wins': 'Skunk W',
  'Skunks L': 'Skunk L',
  'Skunk Losses': 'Skunk L',
};

/** Default “home pub” lookups.
 *  Edit these in ONE place if a team’s venue changes.
 */
const HOME_VENUE = {
  'Kilkenny':         'Owls Unit #306',
  'Highwaymen':       'Owls Unit #306',
  'Wombles':          'Owls Unit #306',
  'Clamour':          'Owls Unit #306',
  'Shooters':         'R.C.L.B 266 / 46',
  'Torpedoes':        'Owls Unit #306',
  'Who Darted':       'Owls Unit #306',
  "Taz's Devils":     'Coronation 259',
  'Bullshooters':     'AC Ranch Café',
  'Redeeming Ronin':  'Japas',
  'Dart Attack':      'Owls Unit #306',
  'Darty McFly':      'Owls Unit #306'
};

/** Utility to attach a venue from the HOME_VENUE dictionary. */
function withVenue(matches){
  return matches.map(m => ({
    ...m,
    venue: m.venue || HOME_VENUE[m.home] || ''
  }));
}

/**
 * Utility: Convert a raw triple-line list (Home, Away, Venue, Home, Away, Venue, ...)
 * into an explicit week array: [{home, away, venue}, ...].
 *
 * Example usage:
 *   const lines = [
 *     'Darty McFly', 'Highwaymen', 'Owls Unit #306',
 *     'Clamour', 'Who Darted', 'Owls Unit #306',
 *     // ...
 *   ];
 *   const weekX = buildWeekFromFlatList(lines);
 */
function buildWeekFromFlatList(lines){
  if (!Array.isArray(lines)) return [];
  const out = [];
  for (let i = 0; i + 2 < lines.length; i += 3){
    const home  = String(lines[i]   ?? '').trim();
    const away  = String(lines[i+1] ?? '').trim();
    const venue = String(lines[i+2] ?? '').trim();
    if (home && away){
      out.push({ home, away, venue });
    }
  }
  return out;
}

/** WEEK-BY-WEEK MATCHUPS
 * Weeks 1–11 = Fall Round (Sep 9 → Nov 25, skipping Nov 11)
 * Week 12    = Dec 2 (first Winter week included in “Upcoming”)
 */

// Week 1 — Tue 2025-09-09 (explicit venues from PDF)
const week1 = [
  { home:'Highwaymen',    away:'Kilkenny',        venue:'R.C.L.B 266 / 46' },
  { home:'Clamour',   away:'Darty McFly',         venue:'Coronation 259'   },
  { home:'Bullshooters',    away:'Who Darted',    venue:'Japas'            },
  { home:'Wombles',      away:'Shooters',         venue:'Owls Unit #306'   },
  { home:"Torpedoes",  away:"Taz's Devils",       venue:'R.C.L.B 266 / 46' },
  { home:'Redeeming Ronin',   away:'Dart Attack', venue:'Owls Unit #306'   },
];

// Week 2 — Tue 2025-09-16 (explicit venues from bulletin)
const week2 = [
  { home:'Darty McFly',     away:'Highwaymen',      venue:'Owls Unit #306' },
  { home:'Clamour',         away:'Who Darted',      venue:'Owls Unit #306' },
  { home:'Bullshooters',    away:'Shooters',        venue:'AC Ranch Café' },
  { home:'Wombles',         away:'Torpedoes',       venue:'Owls Unit #306' },
  { home:"Taz's Devils",    away:'Dart Attack',     venue:'Coronation 259' },
  { home:'Kilkenny',        away:'Redeeming Ronin', venue:'R.C.L.B 266 / 46' },
];

// Week 3 — Tue 2025-09-23 (from PDF)
const week3 = [
  { home:'Kilkenny',        away:'Darty McFly',     venue:'R.C.L.B 266 / 46' },
  { home:"Taz's Devils",    away:'Redeeming Ronin', venue:'Coronation 259'   },
  { home:'Dart Attack',     away:'Wombles',         venue:'Owls Unit #306'   },
  { home:'Clamour',         away:'Shooters',        venue:'Owls Unit #306'   },
  { home:'Who Darted',      away:'Highwaymen',      venue:'Owls Unit #306'   },
  { home:'Torpedoes',       away:'Bullshooters',    venue:'Owls Unit #306'   },
];

// Week 4 — Tue 2025-09-30 (from PDF)
const week4 = [
  { home:'Clamour',         away:'Torpedoes',       venue:'Owls Unit #306'   },
  { home:'Dart Attack',     away:'Bullshooters',    venue:'Owls Unit #306'   },
  { home:'Darty McFly',     away:'Who Darted',      venue:'Owls Unit #306'   },
  { home:"Taz's Devils",    away:'Kilkenny',        venue:'Coronation 259'   },
  { home:'Wombles',         away:'Redeeming Ronin', venue:'Owls Unit #306'   },
  { home:'Shooters',        away:'Highwaymen',      venue:'R.C.L.B 266 / 46' },
];

// Week 5 — Tue 2025-10-07 (from PDF)
const week5 = [
  { home:'Torpedoes',       away:'Highwaymen',      venue:'Owls Unit #306'   },
  { home:'Shooters',        away:'Darty McFly',     venue:'R.C.L.B 266 / 46' },
  { home:"Taz's Devils",    away:'Wombles',         venue:'Coronation 259'   },
  { home:'Clamour',         away:'Dart Attack',     venue:'Owls Unit #306'   },
  { home:'Who Darted',      away:'Kilkenny',        venue:'Owls Unit #306'   },
  { home:'Redeeming Ronin', away:'Bullshooters',    venue:'Japas'            },
];

// Week 6 — Tue 2025-10-14 (from PDF)
const week6 = [
  { home:'Redeeming Ronin', away:'Clamour',         venue:'Japas'            },
  { home:'Bullshooters',    away:"Taz's Devils",    venue:'AC Ranch Café'    },
  { home:'Wombles',         away:'Kilkenny',        venue:'Owls Unit #306'   },
  { home:'Shooters',        away:'Who Darted',      venue:'R.C.L.B 266 / 46' },
  { home:'Highwaymen',      away:'Dart Attack',     venue:'Owls Unit #306'   },
  { home:'Darty McFly',     away:'Torpedoes',       venue:'Owls Unit #306'   },
];

// Week 7 — Tue 2025-10-21 (from PDF)
const week7 = [
  { home:'Kilkenny',        away:'Shooters',        venue:'R.C.L.B 266 / 46' },
  { home:'Who Darted',      away:'Torpedoes',       venue:'Owls Unit #306'   },
  { home:'Clamour',         away:"Taz's Devils",    venue:'Owls Unit #306'   },
  { home:'Redeeming Ronin', away:'Highwaymen',      venue:'Japas'            },
  { home:'Darty McFly',     away:'Dart Attack',     venue:'Owls Unit #306'   },
  { home:'Bullshooters',    away:'Wombles',         venue:'AC Ranch Café'    },
];

// Week 8 — Tue 2025-10-28 (from PDF)
const week8 = [
  { home:'Darty McFly',     away:'Redeeming Ronin', venue:'Owls Unit #306'   },
  { home:'Shooters',        away:'Torpedoes',       venue:'R.C.L.B 266 / 46' },
  { home:'Highwaymen',      away:"Taz's Devils",    venue:'Owls Unit #306'   },
  { home:'Dart Attack',     away:'Who Darted',      venue:'Owls Unit #306'   },
  { home:'Bullshooters',    away:'Kilkenny',        venue:'AC Ranch Café'    },
  { home:'Wombles',         away:'Clamour',         venue:'Owls Unit #306'   },
];

// Week 9 — Tue 2025-11-04 (from PDF)
const week9 = [
  { home:'Dart Attack',     away:'Shooters',        venue:'Owls Unit #306'   },
  { home:'Kilkenny',        away:'Torpedoes',       venue:'R.C.L.B 266 / 46' },
  { home:'Who Darted',      away:'Redeeming Ronin', venue:'Owls Unit #306'   },
  { home:'Highwaymen',      away:'Wombles',         venue:'Owls Unit #306'   },
  { home:'Bullshooters',    away:'Clamour',         venue:'AC Ranch Café'    },
  { home:'Darty McFly',     away:"Taz's Devils",    venue:'Owls Unit #306'   },
];

// Week 10 — Tue 2025-11-18 (from PDF)
const week10 = [
  { home:'Dart Attack',     away:'Torpedoes',       venue:'Owls Unit #306'   },
  { home:'Clamour',         away:'Kilkenny',        venue:'Owls Unit #306'   },
  { home:'Who Darted',      away:"Taz's Devils",    venue:'Owls Unit #306'   },
  { home:'Shooters',        away:'Redeeming Ronin', venue:'R.C.L.B 266 / 46' },
  { home:'Darty McFly',     away:'Wombles',         venue:'Owls Unit #306'   },
  { home:'Bullshooters',    away:'Highwaymen',      venue:'AC Ranch Café'    },
];

// Week 11 — Tue 2025-11-25 (from PDF)
const week11 = [
  { home:'Wombles',         away:'Who Darted',      venue:'Owls Unit #306'   },
  { home:'Kilkenny',        away:'Dart Attack',     venue:'R.C.L.B 266 / 46' },
  { home:'Redeeming Ronin', away:'Torpedoes',       venue:'Japas'            },
  { home:'Darty McFly',     away:'Bullshooters',    venue:'Owls Unit #306'   },
  { home:'Clamour',         away:'Highwaymen',      venue:'Owls Unit #306'   },
  { home:"Taz's Devils",    away:'Shooters',        venue:'Coronation 259'   },
];

// Week 12 — Tue 2025-12-02 (from PDF, first Winter week)
const week12 = [
  { home:'Highwaymen',      away:'Kilkenny',        venue:'Owls Unit #306'   },
  { home:'Darty McFly',     away:'Clamour',         venue:'Owls Unit #306'   },
  { home:'Who Darted',      away:'Bullshooters',    venue:'Owls Unit #306'   },
  { home:'Shooters',        away:'Wombles',         venue:'R.C.L.B 266 / 46' },
  { home:"Taz's Devils",    away:'Torpedoes',       venue:'Coronation 259'   },
  { home:'Dart Attack',     away:'Redeeming Ronin', venue:'Owls Unit #306'   },
];


/** Expose to both the HA/V schedule and the Upcoming table. */
window.matchDetails = {
  week1, week2, week3, week4, week5, week6,
  week7, week8, week9, week10, week11, week12
};

// =====================================================
// Upcoming Matches (Date | Time | Home | Away | Venue) — first 12 fall dates only
// Requires in HTML:
//   #upcomingWeekTabs  (tab container)
//   #upcomingBody      (tbody)
//   #upcomingDateBadge (<time> chip)
// Table header should be: Date | Time | Home | Away | Venue
// =====================================================
const UP_TABS_ID  = 'upcomingWeekTabs';
const UP_TBODY_ID = 'upcomingBody';
const UP_BADGE_ID = 'upcomingDateBadge';

/** Inject responsive styles for the Upcoming Week tabs (12 on one line) */
function _injectUpcomingTabsCSS() {
  if (document.getElementById('upcoming-tabs-css')) return;
  const style = document.createElement('style');
  style.id = 'upcoming-tabs-css';
  style.textContent = `
    /* Tabs: 12 columns, one line, no scroll */
    #upcomingWeekTabs {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 8px;
      align-items: stretch;
    }
    /* Make each button fill its cell and be shrinkable */
    #upcomingWeekTabs .week-tab {
      width: 100%;
      min-width: 0;
      white-space: nowrap;
      border-radius: 9999px;
      padding: 6px 10px;
      font-size: 14px;
      line-height: 1.1;
      font-variant-numeric: tabular-nums;
    }
    /* Active/selected */
    #upcomingWeekTabs .week-tab[aria-selected="true"],
    #upcomingWeekTabs .week-tab.active {
      outline: 2px solid rgba(255,255,255,.25);
    }
    /* Label variants: full / short / tiny */
    #upcomingWeekTabs .label-full  { display: inline; }
    #upcomingWeekTabs .label-short { display: none; }
    #upcomingWeekTabs .label-tiny  { display: none; }

    /* Medium screens: “W12” */
    @media (max-width: 820px) {
      #upcomingWeekTabs .label-full  { display: none; }
      #upcomingWeekTabs .label-short { display: inline; }
      #upcomingWeekTabs .label-tiny  { display: none; }
      #upcomingWeekTabs .week-tab { padding: 6px 8px; font-size: 13px; }
    }

    /* Small screens: “12” */
    @media (max-width: 560px) {
      #upcomingWeekTabs .label-full  { display: none; }
      #upcomingWeekTabs .label-short { display: none; }
      #upcomingWeekTabs .label-tiny  { display: inline; }
      #upcomingWeekTabs .week-tab { padding: 4px 6px; font-size: 12px; }
    }
  `;
  document.head.appendChild(style);
}


function buildUpcomingTabs() {
  _injectUpcomingTabsCSS(); // ensure responsive layout/styles exist

  const tabs = document.getElementById(UP_TABS_ID);
  if (!tabs) return;
  tabs.setAttribute('role','tablist');
  tabs.setAttribute('aria-label','Season Weeks');
  tabs.innerHTML = '';

  UPCOMING_SCHEDULE.forEach((iso, i) => {
    const wk = `week${i + 1}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'week-tab';
    btn.setAttribute('role', 'tab');
    btn.dataset.week = wk;
    btn.setAttribute('aria-selected', 'false');

    // Three label lengths: CSS shows the right one per screen width
    btn.innerHTML = `
      <span class="label-full">Week ${i + 1}</span>
      <span class="label-short" aria-hidden="true">W${i + 1}</span>
      <span class="label-tiny"  aria-hidden="true">${i + 1}</span>
    `;

    btn.addEventListener('click', () => selectUpcomingWeek(i));
    tabs.appendChild(btn);
  });

  // Default select Week 1 visually
  const first = tabs.querySelector('.week-tab');
  if (first) {
    first.classList.add('active');
    first.setAttribute('aria-selected', 'true');
  }
}


function renderUpcomingWeek(i) {
  const tbody = document.getElementById(UP_TBODY_ID);
  if (!tbody) return;

  const iso   = UPCOMING_SCHEDULE[i];
  const badge = document.getElementById(UP_BADGE_ID);
  if (badge) {
    badge.setAttribute('datetime', iso);
    badge.textContent = fmt(iso);
    badge.title = (iso === todayISO()) ? 'Match Day' : 'Week Date';
  }

  const weekKey = `week${i + 1}`;
  const list = (window.matchDetails && window.matchDetails[weekKey]) || [];

  const rows = list.map(m => {
    const time   = m.time || '7:30 PM';
    const vClass = venueClassFor(m.venue, m.class);
    return `
      <tr>
        <td>${fmt(iso)}</td>
        <td>${time}</td>
        <td>${m.home}</td>
        <td>${m.away}</td>
        <td class="${vClass}">${m.venue || ''}</td>
      </tr>`;
  }).join('');

  tbody.innerHTML = rows || `<tr><td colspan="5">No matches posted for ${fmt(iso)}.</td></tr>`;
}

function selectUpcomingWeek(i) {
  const tabs = document.getElementById(UP_TABS_ID);
  if (tabs) {
    tabs.querySelectorAll('button[role="tab"], .week-tab').forEach(b => {
      b.classList.remove('selected', 'active');
      b.setAttribute('aria-selected', 'false');
    });
    const current = tabs.querySelector(`button[data-week="week${i + 1}"]`);
    if (current) {
      current.classList.add('active');
      current.setAttribute('aria-selected', 'true');
      if (typeof ensureTabInView === 'function') ensureTabInView(current); // safe if you have it
    }
  }
  renderUpcomingWeek(i);
}


// Only runs if the Upcoming section exists on the page
function initUpcomingMatches() {
  if (!document.getElementById(UP_TABS_ID)) return;
  buildUpcomingTabs();
  // On Tuesday (match day) show that week; after midnight it advances automatically
  const idx = nextWeekIndexFor(UPCOMING_SCHEDULE);
  selectUpcomingWeek(idx);
}

// =====================================================
// Init + Midnight Rollover
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
  // Standings
  fetchTeamData();
  updateStandingsDateAuto();

  // Players
  renderPlayerHeader(); // ensure header exists even if fetch errors
  initPlayerSearch();
  fetchAndPopulatePlayers();

  // Schedule & upcoming
  initializeTabs();
  highlightWeekButton();
  initUpcomingMatches();

  // Rollover at midnight: keep everything in sync without reload
  const toMidnight = (() => {
    const n = new Date(), t = new Date(n); t.setHours(24,0,0,0); return t - n;
  })();
  setTimeout(() => {
    updateStandingsDateAuto();
    highlightWeekButton();
    initUpcomingMatches();
    setInterval(() => {
      updateStandingsDateAuto();
      highlightWeekButton();
      initUpcomingMatches();
    }, 86400000); // daily
  }, toMidnight);
});
