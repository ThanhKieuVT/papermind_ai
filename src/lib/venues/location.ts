/** Infers the host country (ISO 3166-1 alpha-2) and region from free-form venue places. */

export type Region = "asia" | "europe" | "north-america" | "south-america" | "oceania" | "africa" | "online";
export const REGIONS: Region[] = ["asia", "europe", "north-america", "south-america", "oceania", "africa", "online"];

const REGION_OF: Record<string, Region> = {};
const RULES: { re: RegExp; code: string }[] = [];

function add(code: string, region: Region, names: string[], caseSensitive: string[] = []): void {
  REGION_OF[code] = region;
  for (const n of names) {
    RULES.push({ re: new RegExp(`(?<![\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+")}(?![\\p{L}])`, "iu"), code });
  }
  for (const n of caseSensitive) RULES.push({ re: new RegExp(`(?<![\\p{L}])${n}(?![\\p{L}])`, "u"), code });
}

// Order matters: more specific names first (e.g. Hong Kong / Taiwan before China).
add("HK", "asia", ["Hong Kong"]);
add("TW", "asia", ["Taiwan", "Taipei"]);
add("AE", "asia", ["United Arab Emirates", "UAE", "Abu Dhabi", "Dubai"]);
add("KR", "asia", ["South Korea", "Republic of Korea", "Korea", "Seoul", "Busan", "Jeju"]);
add("CN", "asia", ["China", "P.R. China", "Beijing", "Shanghai", "Shenzhen", "Hangzhou", "Nanjing", "Guangzhou", "Chengdu", "Wuhan", "Xi'an", "Changsha", "Macau", "Macao"]);
add("JP", "asia", ["Japan", "Tokyo", "Kyoto", "Osaka", "Yokohama"]);
add("SG", "asia", ["Singapore"]);
add("IN", "asia", ["India", "Bangalore", "Bengaluru", "Hyderabad", "New Delhi", "Mumbai", "Chennai"]);
add("VN", "asia", ["Vietnam", "Viet Nam", "Hanoi", "Ho Chi Minh", "Da Nang", "Danang"]);
add("MY", "asia", ["Malaysia", "Kuala Lumpur", "Penang"]);
add("TH", "asia", ["Thailand", "Bangkok", "Phuket"]);
add("ID", "asia", ["Indonesia", "Bali", "Jakarta"]);
add("KH", "asia", ["Cambodia", "Siem Reap"]);
add("IL", "asia", ["Israel", "Tel Aviv", "Jerusalem", "Haifa"]);
add("QA", "asia", ["Qatar", "Doha"]);
add("PH", "asia", ["Philippines", "Manila"]);
add("PK", "asia", ["Pakistan"]);
add("SA", "asia", ["Saudi Arabia", "Riyadh"]);

add("GB", "europe", ["United Kingdom", "Great Britain", "England", "Scotland", "Wales", "Northern Ireland", "London", "Edinburgh", "Glasgow", "Manchester", "Cambridge, UK", "Oxford"], ["UK"]);
add("IE", "europe", ["Ireland", "Dublin", "Galway"]);
add("DE", "europe", ["Germany", "Berlin", "Munich", "München", "Hamburg", "Saarbrücken", "Mainz", "Darmstadt"]);
add("FR", "europe", ["France", "Paris", "Lyon", "Nice", "Toulouse", "Marseille", "Grenoble"]);
add("IT", "europe", ["Italy", "Rome", "Milan", "Florence", "Venice", "Naples", "Turin", "Bologna"]);
add("ES", "europe", ["Spain", "Madrid", "Barcelona", "Valencia", "Seville", "Bilbao", "Santiago de Compostela", "Málaga"]);
add("PT", "europe", ["Portugal", "Lisbon", "Porto"]);
add("GR", "europe", ["Greece", "Athens", "Crete", "Thessaloniki", "Rhodes"]);
add("NL", "europe", ["The Netherlands", "Netherlands", "Amsterdam", "Rotterdam", "Delft", "Eindhoven", "Utrecht"]);
add("BE", "europe", ["Belgium", "Brussels", "Leuven", "Ghent", "Antwerp"], ["BE"]);
add("AT", "europe", ["Austria", "Vienna", "Graz", "Linz", "Innsbruck", "Salzburg"]);
add("CH", "europe", ["Switzerland", "Zurich", "Zürich", "Geneva", "Lausanne", "Lugano"]);
add("PL", "europe", ["Poland", "Warsaw", "Kraków", "Krakow", "Wrocław", "Poznań", "Gdańsk"]);
add("NO", "europe", ["Norway", "Oslo", "Trondheim", "Bergen"]);
add("DK", "europe", ["Denmark", "Copenhagen", "Aarhus"]);
add("FI", "europe", ["Finland", "Helsinki", "Tampere", "Espoo"]);
add("SE", "europe", ["Sweden", "Stockholm", "Gothenburg", "Lund", "Uppsala"]);
add("IS", "europe", ["Iceland", "Reykjavik", "Reykjavík"]);
add("CZ", "europe", ["Czech Republic", "Czechia", "Prague", "Brno"]);
add("SK", "europe", ["Slovakia", "Bratislava"]);
add("HU", "europe", ["Hungary", "Budapest"]);
add("SI", "europe", ["Slovenia", "Ljubljana"]);
add("HR", "europe", ["Croatia", "Zagreb", "Dubrovnik", "Split"]);
add("RS", "europe", ["Serbia", "Belgrade"]);
add("RO", "europe", ["Romania", "Bucharest", "Cluj"]);
add("EE", "europe", ["Estonia", "Tallinn", "Tartu"]);
add("LT", "europe", ["Lithuania", "Vilnius"]);
add("LV", "europe", ["Latvia", "Riga"]);
add("LU", "europe", ["Luxembourg"]);
add("MT", "europe", ["Malta", "Valletta"]);
add("CY", "europe", ["Cyprus", "Limassol", "Nicosia", "Larnaca", "Paphos"]);
add("TR", "europe", ["Türkiye", "Turkiye", "Turkey", "Istanbul", "Antalya", "Ankara"]);
add("BG", "europe", ["Bulgaria", "Sofia"]);

add("CA", "north-america", ["Canada", "Vancouver", "Toronto", "Montreal", "Montréal", "Ottawa", "Quebec", "Québec", "Calgary", "Waterloo", "Halifax", "British Columbia"], ["BC"]);
add("MX", "north-america", ["Mexico", "México", "Cancún", "Cancun", "Mexico City", "Guadalajara"]);
add("CR", "north-america", ["Costa Rica"]);
add("PA", "north-america", ["Panama"]);
add("DO", "north-america", ["Dominican Republic", "Punta Cana"]);
add("BS", "north-america", ["Bahamas", "Nassau"]);
add("BB", "north-america", ["Barbados"]);
add("CW", "north-america", ["Curaçao", "Curacao"]);
add("KN", "north-america", ["St. Kitts", "Saint Kitts"]);
add("GD", "north-america", ["Grenada"]);
add("PR", "north-america", ["Puerto Rico", "San Juan"]);
add("US", "north-america", [
  "United States", "United State", "U.S.A.", "U.S.A", "USA", "America",
  "California", "Colorado", "Louisiana", "Utah", "Hawaii", "Florida", "Maryland", "Indiana", "South Carolina", "North Carolina",
  "Oregon", "Georgia", "Texas", "Washington", "Massachusetts", "New York", "Pennsylvania", "Illinois", "Arizona", "Nevada",
  "Virginia", "Michigan", "Minnesota", "Tennessee", "Ohio", "Wisconsin", "New Jersey", "Missouri", "Kentucky", "Alaska",
  "Los Angeles", "Denver", "Philadelphia", "Seattle", "Boston", "San Francisco", "San Diego", "Chicago", "New Orleans",
  "Austin", "Honolulu", "Las Vegas", "Atlanta", "Pittsburgh", "Salt Lake City", "Anaheim", "Long Beach", "Boulder",
], ["US", "CA", "DC", "PA", "NY", "MA", "TX", "WA"]);

add("BR", "south-america", ["Brazil", "Brasil", "São Paulo", "Sao Paulo", "Rio de Janeiro", "Florianópolis"]);
add("CL", "south-america", ["Chile", "Santiago, Chile"]);
add("AR", "south-america", ["Argentina", "Buenos Aires"]);
add("CO", "south-america", ["Colombia", "Bogotá", "Bogota", "Medellín", "Cartagena"]);
add("PE", "south-america", ["Peru", "Lima"]);
add("UY", "south-america", ["Uruguay", "Montevideo"]);

add("AU", "oceania", ["Australia", "Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra", "Gold Coast", "Hobart"]);
add("NZ", "oceania", ["New Zealand", "Auckland", "Wellington", "Christchurch"]);
add("FJ", "oceania", ["Fiji"]);

add("MA", "africa", ["Morocco", "Marrakesh", "Marrakech", "Rabat", "Casablanca"]);
add("ZA", "africa", ["South Africa", "Cape Town", "Johannesburg", "Durban", "Stellenbosch"]);
add("TN", "africa", ["Tunisia", "Tunis"]);
add("EG", "africa", ["Egypt", "Cairo"]);
add("RW", "africa", ["Rwanda", "Kigali"]);
add("KE", "africa", ["Kenya", "Nairobi"]);
add("NG", "africa", ["Nigeria", "Lagos"]);

export interface HostLocation {
  /** ISO 3166-1 alpha-2 code, or null for online-only / unknown venues. */
  country: string | null;
  region: Region | null;
}

const cache = new Map<string, HostLocation>();

export function parseHostLocation(place: string | null | undefined): HostLocation {
  const text = (place ?? "").trim();
  const hit = cache.get(text);
  if (hit) return hit;
  let result: HostLocation = { country: null, region: null };
  if (text && !/^tb[ad]$/i.test(text)) {
    const rule = RULES.find((r) => r.re.test(text));
    if (rule) result = { country: rule.code, region: REGION_OF[rule.code] ?? null };
    else if (/virtual|online|remote/i.test(text)) result = { country: null, region: "online" };
  }
  cache.set(text, result);
  return result;
}

/** Localized country name (e.g. "Hoa Kỳ" in Vietnamese), falling back to the code. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
