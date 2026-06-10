export interface Match {
  id: number;
  group: string;
  matchday: number;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  kickoffUTC: string; // ISO 8601
  venue: string;
}

const FLAGS: Record<string, string> = {
  "Mexico": "🇲🇽",
  "South Africa": "🇿🇦",
  "South Korea": "🇰🇷",
  "Czechia": "🇨🇿",
  "Canada": "🇨🇦",
  "Bosnia & Herzegovina": "🇧🇦",
  "Qatar": "🇶🇦",
  "Switzerland": "🇨🇭",
  "Brazil": "🇧🇷",
  "Morocco": "🇲🇦",
  "Haiti": "🇭🇹",
  "Scotland": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "USA": "🇺🇸",
  "Paraguay": "🇵🇾",
  "Australia": "🇦🇺",
  "Türkiye": "🇹🇷",
  "Germany": "🇩🇪",
  "Curaçao": "🇨🇼",
  "Netherlands": "🇳🇱",
  "Japan": "🇯🇵",
  "Ivory Coast": "🇨🇮",
  "Ecuador": "🇪🇨",
  "Tunisia": "🇹🇳",
  "Sweden": "🇸🇪",
  "Spain": "🇪🇸",
  "Cape Verde": "🇨🇻",
  "Belgium": "🇧🇪",
  "Egypt": "🇪🇬",
  "Saudi Arabia": "🇸🇦",
  "Uruguay": "🇺🇾",
  "Iran": "🇮🇷",
  "New Zealand": "🇳🇿",
  "France": "🇫🇷",
  "Senegal": "🇸🇳",
  "Iraq": "🇮🇶",
  "Norway": "🇳🇴",
  "Argentina": "🇦🇷",
  "Algeria": "🇩🇿",
  "Austria": "🇦🇹",
  "Jordan": "🇯🇴",
  "Portugal": "🇵🇹",
  "Congo DR": "🇨🇩",
  "England": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Croatia": "🇭🇷",
  "Ghana": "🇬🇭",
  "Panama": "🇵🇦",
  "Colombia": "🇨🇴",
  "Uzbekistan": "🇺🇿",
};

function f(team: string): string {
  return FLAGS[team] ?? "🏳️";
}

const RAW: Omit<Match, "homeFlag" | "awayFlag">[] = [
  // ── MATCHDAY 1 ──────────────────────────────────────────────────────────
  { id: 1,  group: "A", matchday: 1, homeTeam: "Mexico",              awayTeam: "South Africa",      kickoffUTC: "2026-06-11T19:00:00Z", venue: "Estadio Azteca, Mexico City" },
  { id: 2,  group: "A", matchday: 1, homeTeam: "South Korea",         awayTeam: "Czechia",            kickoffUTC: "2026-06-12T02:00:00Z", venue: "Estadio Akron, Guadalajara" },
  { id: 3,  group: "B", matchday: 1, homeTeam: "Canada",              awayTeam: "Bosnia & Herzegovina", kickoffUTC: "2026-06-12T19:00:00Z", venue: "BMO Field, Toronto" },
  { id: 4,  group: "D", matchday: 1, homeTeam: "USA",                 awayTeam: "Paraguay",           kickoffUTC: "2026-06-13T01:00:00Z", venue: "SoFi Stadium, Los Angeles" },
  { id: 5,  group: "B", matchday: 1, homeTeam: "Qatar",               awayTeam: "Switzerland",        kickoffUTC: "2026-06-13T19:00:00Z", venue: "Levi's Stadium, San Francisco" },
  { id: 6,  group: "C", matchday: 1, homeTeam: "Brazil",              awayTeam: "Morocco",            kickoffUTC: "2026-06-13T22:00:00Z", venue: "MetLife Stadium, New York/NJ" },
  { id: 7,  group: "C", matchday: 1, homeTeam: "Haiti",               awayTeam: "Scotland",           kickoffUTC: "2026-06-14T01:00:00Z", venue: "Gillette Stadium, Boston" },
  { id: 8,  group: "D", matchday: 1, homeTeam: "Australia",           awayTeam: "Türkiye",            kickoffUTC: "2026-06-14T04:00:00Z", venue: "BC Place, Vancouver" },
  { id: 9,  group: "E", matchday: 1, homeTeam: "Germany",             awayTeam: "Curaçao",            kickoffUTC: "2026-06-14T17:00:00Z", venue: "NRG Stadium, Houston" },
  { id: 10, group: "F", matchday: 1, homeTeam: "Netherlands",         awayTeam: "Japan",              kickoffUTC: "2026-06-14T20:00:00Z", venue: "AT&T Stadium, Dallas" },
  { id: 11, group: "E", matchday: 1, homeTeam: "Ivory Coast",         awayTeam: "Ecuador",            kickoffUTC: "2026-06-14T23:00:00Z", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 12, group: "F", matchday: 1, homeTeam: "Tunisia",             awayTeam: "Sweden",             kickoffUTC: "2026-06-15T02:00:00Z", venue: "Estadio BBVA, Monterrey" },
  { id: 13, group: "H", matchday: 1, homeTeam: "Spain",               awayTeam: "Cape Verde",         kickoffUTC: "2026-06-15T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 14, group: "G", matchday: 1, homeTeam: "Belgium",             awayTeam: "Egypt",              kickoffUTC: "2026-06-15T19:00:00Z", venue: "Lumen Field, Seattle" },
  { id: 15, group: "H", matchday: 1, homeTeam: "Saudi Arabia",        awayTeam: "Uruguay",            kickoffUTC: "2026-06-15T22:00:00Z", venue: "Hard Rock Stadium, Miami" },
  { id: 16, group: "G", matchday: 1, homeTeam: "Iran",                awayTeam: "New Zealand",        kickoffUTC: "2026-06-16T01:00:00Z", venue: "SoFi Stadium, Los Angeles" },
  { id: 17, group: "I", matchday: 1, homeTeam: "France",              awayTeam: "Senegal",            kickoffUTC: "2026-06-16T19:00:00Z", venue: "MetLife Stadium, New York/NJ" },
  { id: 18, group: "I", matchday: 1, homeTeam: "Iraq",                awayTeam: "Norway",             kickoffUTC: "2026-06-16T22:00:00Z", venue: "Gillette Stadium, Boston" },
  { id: 19, group: "J", matchday: 1, homeTeam: "Argentina",           awayTeam: "Algeria",            kickoffUTC: "2026-06-17T01:00:00Z", venue: "Arrowhead Stadium, Kansas City" },
  { id: 20, group: "J", matchday: 1, homeTeam: "Austria",             awayTeam: "Jordan",             kickoffUTC: "2026-06-17T04:00:00Z", venue: "Levi's Stadium, San Francisco" },
  { id: 21, group: "K", matchday: 1, homeTeam: "Portugal",            awayTeam: "Congo DR",           kickoffUTC: "2026-06-17T17:00:00Z", venue: "NRG Stadium, Houston" },
  { id: 22, group: "L", matchday: 1, homeTeam: "England",             awayTeam: "Croatia",            kickoffUTC: "2026-06-17T20:00:00Z", venue: "AT&T Stadium, Dallas" },
  { id: 23, group: "L", matchday: 1, homeTeam: "Ghana",               awayTeam: "Panama",             kickoffUTC: "2026-06-17T23:00:00Z", venue: "BMO Field, Toronto" },
  { id: 24, group: "K", matchday: 1, homeTeam: "Uzbekistan",          awayTeam: "Colombia",           kickoffUTC: "2026-06-18T02:00:00Z", venue: "Estadio Azteca, Mexico City" },

  // ── MATCHDAY 2 ──────────────────────────────────────────────────────────
  { id: 25, group: "A", matchday: 2, homeTeam: "Czechia",             awayTeam: "South Africa",       kickoffUTC: "2026-06-18T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 26, group: "B", matchday: 2, homeTeam: "Switzerland",         awayTeam: "Bosnia & Herzegovina", kickoffUTC: "2026-06-18T19:00:00Z", venue: "SoFi Stadium, Los Angeles" },
  { id: 27, group: "B", matchday: 2, homeTeam: "Canada",              awayTeam: "Qatar",              kickoffUTC: "2026-06-18T22:00:00Z", venue: "BC Place, Vancouver" },
  { id: 28, group: "A", matchday: 2, homeTeam: "Mexico",              awayTeam: "South Korea",        kickoffUTC: "2026-06-19T01:00:00Z", venue: "Estadio Akron, Guadalajara" },
  { id: 29, group: "D", matchday: 2, homeTeam: "USA",                 awayTeam: "Australia",          kickoffUTC: "2026-06-19T19:00:00Z", venue: "Lumen Field, Seattle" },
  { id: 30, group: "C", matchday: 2, homeTeam: "Scotland",            awayTeam: "Morocco",            kickoffUTC: "2026-06-19T19:00:00Z", venue: "Gillette Stadium, Boston" },
  { id: 31, group: "C", matchday: 2, homeTeam: "Brazil",              awayTeam: "Haiti",              kickoffUTC: "2026-06-20T01:00:00Z", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 32, group: "D", matchday: 2, homeTeam: "Türkiye",             awayTeam: "Paraguay",           kickoffUTC: "2026-06-20T04:00:00Z", venue: "Levi's Stadium, San Francisco" },
  { id: 33, group: "F", matchday: 2, homeTeam: "Netherlands",         awayTeam: "Sweden",             kickoffUTC: "2026-06-20T17:00:00Z", venue: "NRG Stadium, Houston" },
  { id: 34, group: "E", matchday: 2, homeTeam: "Germany",             awayTeam: "Ivory Coast",        kickoffUTC: "2026-06-20T20:00:00Z", venue: "BMO Field, Toronto" },
  { id: 35, group: "E", matchday: 2, homeTeam: "Ecuador",             awayTeam: "Curaçao",            kickoffUTC: "2026-06-21T00:00:00Z", venue: "Arrowhead Stadium, Kansas City" },
  { id: 36, group: "F", matchday: 2, homeTeam: "Tunisia",             awayTeam: "Japan",              kickoffUTC: "2026-06-21T04:00:00Z", venue: "Estadio BBVA, Monterrey" },
  { id: 37, group: "H", matchday: 2, homeTeam: "Spain",               awayTeam: "Saudi Arabia",       kickoffUTC: "2026-06-21T16:00:00Z", venue: "Mercedes-Benz Stadium, Atlanta" },
  { id: 38, group: "G", matchday: 2, homeTeam: "Belgium",             awayTeam: "Iran",               kickoffUTC: "2026-06-21T19:00:00Z", venue: "SoFi Stadium, Los Angeles" },
  { id: 39, group: "H", matchday: 2, homeTeam: "Uruguay",             awayTeam: "Cape Verde",         kickoffUTC: "2026-06-21T22:00:00Z", venue: "Hard Rock Stadium, Miami" },
  { id: 40, group: "G", matchday: 2, homeTeam: "New Zealand",         awayTeam: "Egypt",              kickoffUTC: "2026-06-22T01:00:00Z", venue: "BC Place, Vancouver" },
  { id: 41, group: "J", matchday: 2, homeTeam: "Argentina",           awayTeam: "Austria",            kickoffUTC: "2026-06-22T17:00:00Z", venue: "AT&T Stadium, Dallas" },
  { id: 42, group: "I", matchday: 2, homeTeam: "France",              awayTeam: "Iraq",               kickoffUTC: "2026-06-22T21:00:00Z", venue: "Lincoln Financial Field, Philadelphia" },
  { id: 43, group: "I", matchday: 2, homeTeam: "Norway",              awayTeam: "Senegal",            kickoffUTC: "2026-06-23T00:00:00Z", venue: "MetLife Stadium, New York/NJ" },
  { id: 44, group: "J", matchday: 2, homeTeam: "Jordan",              awayTeam: "Algeria",            kickoffUTC: "2026-06-23T03:00:00Z", venue: "Levi's Stadium, San Francisco" },
  { id: 45, group: "K", matchday: 2, homeTeam: "Portugal",            awayTeam: "Uzbekistan",         kickoffUTC: "2026-06-23T17:00:00Z", venue: "NRG Stadium, Houston" },
  { id: 46, group: "L", matchday: 2, homeTeam: "England",             awayTeam: "Ghana",              kickoffUTC: "2026-06-23T20:00:00Z", venue: "Gillette Stadium, Boston" },
  { id: 47, group: "L", matchday: 2, homeTeam: "Panama",              awayTeam: "Croatia",            kickoffUTC: "2026-06-23T23:00:00Z", venue: "BMO Field, Toronto" },
  { id: 48, group: "K", matchday: 2, homeTeam: "Colombia",            awayTeam: "Congo DR",           kickoffUTC: "2026-06-24T02:00:00Z", venue: "Estadio Akron, Guadalajara" },

  // ── MATCHDAY 3 ──────────────────────────────────────────────────────────
  { id: 49, group: "B", matchday: 3, homeTeam: "Switzerland",         awayTeam: "Canada",             kickoffUTC: "2026-06-24T19:00:00Z", venue: "TBD" },
  { id: 50, group: "B", matchday: 3, homeTeam: "Bosnia & Herzegovina", awayTeam: "Qatar",             kickoffUTC: "2026-06-24T19:00:00Z", venue: "TBD" },
  { id: 51, group: "C", matchday: 3, homeTeam: "Scotland",            awayTeam: "Brazil",             kickoffUTC: "2026-06-24T22:00:00Z", venue: "TBD" },
  { id: 52, group: "C", matchday: 3, homeTeam: "Morocco",             awayTeam: "Haiti",              kickoffUTC: "2026-06-24T22:00:00Z", venue: "TBD" },
  { id: 53, group: "A", matchday: 3, homeTeam: "Czechia",             awayTeam: "Mexico",             kickoffUTC: "2026-06-25T01:00:00Z", venue: "TBD" },
  { id: 54, group: "A", matchday: 3, homeTeam: "South Africa",        awayTeam: "South Korea",        kickoffUTC: "2026-06-25T01:00:00Z", venue: "TBD" },
  { id: 55, group: "E", matchday: 3, homeTeam: "Ecuador",             awayTeam: "Germany",            kickoffUTC: "2026-06-25T20:00:00Z", venue: "TBD" },
  { id: 56, group: "E", matchday: 3, homeTeam: "Curaçao",             awayTeam: "Ivory Coast",        kickoffUTC: "2026-06-25T20:00:00Z", venue: "TBD" },
  { id: 57, group: "F", matchday: 3, homeTeam: "Japan",               awayTeam: "Sweden",             kickoffUTC: "2026-06-25T23:00:00Z", venue: "TBD" },
  { id: 58, group: "F", matchday: 3, homeTeam: "Tunisia",             awayTeam: "Netherlands",        kickoffUTC: "2026-06-25T23:00:00Z", venue: "TBD" },
  { id: 59, group: "D", matchday: 3, homeTeam: "Türkiye",             awayTeam: "USA",                kickoffUTC: "2026-06-26T02:00:00Z", venue: "TBD" },
  { id: 60, group: "D", matchday: 3, homeTeam: "Paraguay",            awayTeam: "Australia",          kickoffUTC: "2026-06-26T02:00:00Z", venue: "TBD" },
  { id: 61, group: "I", matchday: 3, homeTeam: "Norway",              awayTeam: "France",             kickoffUTC: "2026-06-26T19:00:00Z", venue: "TBD" },
  { id: 62, group: "I", matchday: 3, homeTeam: "Senegal",             awayTeam: "Iraq",               kickoffUTC: "2026-06-26T19:00:00Z", venue: "TBD" },
  { id: 63, group: "H", matchday: 3, homeTeam: "Cape Verde",          awayTeam: "Saudi Arabia",       kickoffUTC: "2026-06-27T00:00:00Z", venue: "TBD" },
  { id: 64, group: "H", matchday: 3, homeTeam: "Uruguay",             awayTeam: "Spain",              kickoffUTC: "2026-06-27T00:00:00Z", venue: "TBD" },
  { id: 65, group: "G", matchday: 3, homeTeam: "Egypt",               awayTeam: "Iran",               kickoffUTC: "2026-06-27T03:00:00Z", venue: "TBD" },
  { id: 66, group: "G", matchday: 3, homeTeam: "New Zealand",         awayTeam: "Belgium",            kickoffUTC: "2026-06-27T03:00:00Z", venue: "TBD" },
  { id: 67, group: "L", matchday: 3, homeTeam: "Panama",              awayTeam: "England",            kickoffUTC: "2026-06-27T21:00:00Z", venue: "TBD" },
  { id: 68, group: "L", matchday: 3, homeTeam: "Croatia",             awayTeam: "Ghana",              kickoffUTC: "2026-06-27T21:00:00Z", venue: "TBD" },
  { id: 69, group: "K", matchday: 3, homeTeam: "Colombia",            awayTeam: "Portugal",           kickoffUTC: "2026-06-27T23:30:00Z", venue: "TBD" },
  { id: 70, group: "K", matchday: 3, homeTeam: "Congo DR",            awayTeam: "Uzbekistan",         kickoffUTC: "2026-06-27T23:30:00Z", venue: "TBD" },
  { id: 71, group: "J", matchday: 3, homeTeam: "Algeria",             awayTeam: "Austria",            kickoffUTC: "2026-06-28T02:00:00Z", venue: "TBD" },
  { id: 72, group: "J", matchday: 3, homeTeam: "Jordan",              awayTeam: "Argentina",          kickoffUTC: "2026-06-28T02:00:00Z", venue: "TBD" },
];

export const FIXTURES: Match[] = RAW.map((m) => ({
  ...m,
  homeFlag: f(m.homeTeam),
  awayFlag: f(m.awayTeam),
}));

export const GROUPS = ["A","B","C","D","E","F","G","H","I","J","K","L"] as const;

export function isLocked(match: Match): boolean {
  return new Date() >= new Date(match.kickoffUTC);
}
