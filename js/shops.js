// Butiksgenerator: hvilke butikstyper der plausibelt findes i en bosætning,
// skaleret efter befolkningstal, plus tilfældige navne og smagsprøver.

const SHOP_TIERS = [
  { name: "Torp", maxPop: 20, guaranteed: [], adds: ["Købmand"], count: [0, 1] },
  { name: "Landsby", maxPop: 200, guaranteed: ["Kro"], adds: ["Smed", "Helligdom", "Stald"], count: [2, 3] },
  { name: "Lille By", maxPop: 2000, guaranteed: ["Kro", "Købmand"], adds: ["Urtekræmmer", "Skrædder", "Tempel"], count: [4, 5] },
  { name: "Stor By", maxPop: 5000, guaranteed: ["Kro", "Købmand", "Tempel"], adds: ["Våbensmed", "Rustningssmed", "Juveler", "Boghandler", "Pengeudlåner"], count: [6, 8] },
  { name: "Storby", maxPop: 25000, guaranteed: ["Kro", "Købmand", "Tempel", "Våbensmed"], adds: ["Magibutik", "Alkymist", "Eksotisk Handler", "Gildehus"], count: [9, 12] },
  { name: "Metropol", maxPop: Infinity, guaranteed: ["Kro", "Købmand", "Tempel", "Våbensmed", "Magibutik"], adds: ["Sortebørs", "Ærkemagi-akademi", "Ambassade", "Auktionshus"], count: [12, 16] },
];

const EPITHETS = [
  "Den Gyldne", "Den Rustne", "Den Glade", "Den Sidste", "Ravnens", "Ulvens",
  "Måne-", "Drage-", "Sølv-", "Den Skæve", "Den Trofaste", "Vandrerens",
  "Den Forgyldte", "Den Blå", "Den Tavse", "Krondrages",
];

const SHOP_TYPES = {
  "Kro": {
    nouns: ["Kro", "Værtshus", "Beværtning"],
    flavors: [
      "Altid fyldt, altid larmende, og altid det bedste sted at høre rygter.",
      "Ejeren husker enhver gæst, og enhver gælds saldo.",
      "Der er en fast plads ved ilden, som ingen tør sætte sig i.",
    ],
  },
  "Købmand": {
    nouns: ["Handel", "Købmandsgård", "Bod"],
    flavors: [
      "Har alt, hvad man kan få brug for — og en del man ikke vidste, man manglede.",
      "Hylderne bugner af tovværk, lys, konserves og et og andet uidentificerbart.",
      "Ejeren forhandler priser, som var det en sport.",
    ],
  },
  "Smed": {
    nouns: ["Smedje", "Esse", "Værksted"],
    flavors: [
      "Lyden af hammer mod ambolt kan høres i hele kvarteret fra solopgang.",
      "Reparerer alt fra hestesko til harnisker, ingen spørgsmål stillet.",
      "Smeden bander på sit eget modersmål, når arbejdet går skævt.",
    ],
  },
  "Helligdom": {
    nouns: ["Helligdom", "Alter", "Lund"],
    flavors: [
      "Et lille, fredfyldt sted, hvor rejsende lægger en mønt og et ønske.",
      "Ingen ved præcis, hvilken guddom alteret oprindeligt var viet til.",
    ],
  },
  "Stald": {
    nouns: ["Stald", "Hestegård"],
    flavors: [
      "Passer på både heste og rygter — staldkarlen hører alt.",
      "Frisk halm, friske heste, og en pris der stiger ved markedstid.",
    ],
  },
  "Urtekræmmer": {
    nouns: ["Urtebod", "Krydderikammer", "Drueriet"],
    flavors: [
      "Lugter af tørrede blade, sirup og noget, der bedst efterlades ubeskrevet.",
      "Sælger salver, teer, og lejlighedsvis noget der bare lige overskrider lovens grænser.",
    ],
  },
  "Skrædder": {
    nouns: ["Skrædderi", "Systue"],
    flavors: [
      "Kan sy alt fra rejseklæder til balkjoler — til den rette pris.",
      "Har et godt øje for stof, og et endnu bedre øje for kunders hemmeligheder.",
    ],
  },
  "Tempel": {
    nouns: ["Tempel", "Kloster"],
    flavors: [
      "Præster tilbyder helbredelse, velsignelser, og et lyttende øre.",
      "Klokkerne ringer ved daggry og skumring, uanset hvad byen ellers foretager sig.",
    ],
  },
  "Våbensmed": {
    nouns: ["Våbenkammer", "Rustkammer"],
    flavors: [
      "Sværd, buer og økser i alle prisklasser, poleret til de skinner.",
      "Ejeren tester personligt hvert våben før salg — nogle gange lidt for entusiastisk.",
    ],
  },
  "Rustningssmed": {
    nouns: ["Rustningskammer", "Pladeloft"],
    flavors: [
      "Skræddersyet rustning, hvis man har tid — og tålmodighed — til at vente.",
      "Væggene er dækket af pantsatte harnisker, ingen ved hvorfor.",
    ],
  },
  "Juveler": {
    nouns: ["Juvelerbutik", "Guldsmedje"],
    flavors: [
      "Glimtende smykker bag tykt glas, og en ejer der aldrig blinker under en handel.",
      "Rygtet siger, at halvdelen af varelageret er af tvivlsom herkomst.",
    ],
  },
  "Boghandler": {
    nouns: ["Boglade", "Skriftsamling"],
    flavors: [
      "Støvede reoler fyldt med kort, historiebøger og et par forbudte titler, hvis man spørger pænt.",
      "Ejeren læser mere, end vedkommende sælger.",
    ],
  },
  "Pengeudlåner": {
    nouns: ["Vekselkontor", "Pengehus"],
    flavors: [
      "Låner ud til enhver, der kan betale renterne — eller noget andet af værdi.",
      "Et koldt smil og en varm kontrakt.",
    ],
  },
  "Magibutik": {
    nouns: ["Magikammer", "Arkanisk Handel"],
    flavors: [
      "Hylder fyldt med skinnende artefakter — de fleste ufarlige. De fleste.",
      "Ejeren garanterer intet, men sælger alligevel dyrt.",
    ],
  },
  "Alkymist": {
    nouns: ["Laboratorium", "Alkymistbod"],
    flavors: [
      "Dampende kolber og en lugt, der klæber sig til tøjet i dagevis.",
      "Sælger eliksirer, modgifte, og lejlighedsvis en decideret eksplosion.",
    ],
  },
  "Eksotisk Handler": {
    nouns: ["Kuriosahandel", "Sjældenhedskammer"],
    flavors: [
      "Varer fra fjerne lande, hvis oprindelse ejeren aldrig helt vil forklare.",
      "Krydderier, skind og relikvier, alt sammen med en historie der nok er opdigtet.",
    ],
  },
  "Gildehus": {
    nouns: ["Gildehus", "Lav"],
    flavors: [
      "Håndværkere og handlende mødes her for at diskutere priser og udelukke konkurrenter.",
      "Medlemskab koster — men adgangen til byens rygter er gratis.",
    ],
  },
  "Sortebørs": {
    nouns: ["Bagdør", "Skyggehandel"],
    flavors: [
      "Findes ikke officielt. Spørg den forkerte person, og den findes slet ikke.",
      "Alt kan skaffes, for den rette pris og de rette spørgsmål undladt.",
    ],
  },
  "Ærkemagi-akademi": {
    nouns: ["Akademi", "Magikerlav"],
    flavors: [
      "Unge troldmænd øver besværgelser bag lukkede døre — nogle gange for lukkede.",
      "Biblioteket alene er større end de fleste byers rådhus.",
    ],
  },
  "Ambassade": {
    nouns: ["Ambassade", "Gesandtskab"],
    flavors: [
      "Repræsenterer interesser fra lande, de fleste lokale aldrig har hørt om.",
      "Vagter ved døren, der ikke taler det lokale sprog — med vilje.",
    ],
  },
  "Auktionshus": {
    nouns: ["Auktionshus", "Bortsalg"],
    flavors: [
      "Sjældenheder, arvestykker og tvivlsomme fund sælges til højestbydende hver uge.",
      "Hammerslag betyder handel — ingen fortrydelsesret.",
    ],
  },
};

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN(arr, n) {
  const copy = [...arr];
  const result = [];
  while (result.length < n && copy.length) {
    const i = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(i, 1)[0]);
  }
  return result;
}

function combineName(epithet, noun) {
  if (epithet.endsWith("-")) {
    return epithet + noun.charAt(0).toLowerCase() + noun.slice(1);
  }
  return `${epithet} ${noun}`;
}

function makeShop(type) {
  const def = SHOP_TYPES[type];
  const name = combineName(pickRandom(EPITHETS), pickRandom(def.nouns));
  const flavor = pickRandom(def.flavors);
  return { type, name, flavor };
}

function cumulativePool(tierIndex) {
  const pool = new Set();
  for (let i = 0; i <= tierIndex; i++) SHOP_TIERS[i].adds.forEach((a) => pool.add(a));
  return [...pool];
}

// Genererer en tilfældig, men størrelses-passende butiksliste for en given befolkning.
function generateShopList(population) {
  let tierIndex = SHOP_TIERS.findIndex((t) => population <= t.maxPop);
  if (tierIndex === -1) tierIndex = SHOP_TIERS.length - 1;
  const tier = SHOP_TIERS[tierIndex];
  const pool = cumulativePool(tierIndex).filter((t) => !tier.guaranteed.includes(t));
  const [minTotal, maxTotal] = tier.count;
  const total = minTotal + Math.floor(Math.random() * (maxTotal - minTotal + 1));
  const extraNeeded = Math.max(0, total - tier.guaranteed.length);
  const types = [...tier.guaranteed, ...pickN(pool, extraNeeded)];
  return { tierName: tier.name, shops: types.map(makeShop) };
}

// --- Varer til salg: rigtige D&D-genstande fra Open5e's åbne SRD-database ---
// Kun System Reference Document 5.1 (den klassiske 2014-udgave, officielt
// udgivet af Wizards of the Coast under en åben licens) bruges som kilde —
// aldrig tredjeparts- eller homebrew-indhold fra Open5e's øvrige dokumenter.
const OPEN5E_DOCUMENT = "srd-2014";

const SHOP_ITEM_CATEGORIES = {
  "Smed": ["weapon", "tools"],
  "Våbensmed": ["weapon"],
  "Rustningssmed": ["armor", "shield"],
  "Købmand": ["adventuring-gear", "trade-good"],
  "Urtekræmmer": ["poison", "adventuring-gear"],
  "Alkymist": ["poison", "adventuring-gear"],
  "Eksotisk Handler": ["trade-good"],
  "Gildehus": ["tools"],
  "Sortebørs": ["poison"],
};

const itemCategoryCache = new Map();

function formatCost(costStr) {
  const n = parseFloat(costStr);
  if (!n && n !== 0) return "pris ukendt";
  return `${Number.isInteger(n) ? n : n.toFixed(2)} gp`;
}

function normalizeItem(raw) {
  let stat = "";
  if (raw.weapon) {
    const dmg = raw.weapon.damage_dice
      ? `${raw.weapon.damage_dice} ${(raw.weapon.damage_type?.name || "").toLowerCase()}`.trim()
      : "";
    const props = (raw.weapon.properties || [])
      .map((p) => p.property.name.toLowerCase() + (p.detail ? ` (${p.detail})` : ""))
      .join(", ");
    stat = [dmg, props].filter(Boolean).join(", ");
  } else if (raw.armor) {
    const bits = [`AC ${raw.armor.ac_display}`];
    if (raw.armor.strength_score_required) bits.push(`kræver Styrke ${raw.armor.strength_score_required}`);
    if (raw.armor.grants_stealth_disadvantage) bits.push("ulempe på Snighed");
    stat = bits.join(", ");
  } else if (raw.weight) {
    stat = `${parseFloat(raw.weight)} lb.`;
  }
  return { name: raw.name, cost: formatCost(raw.cost), stat };
}

async function fetchCategoryItems(category) {
  if (itemCategoryCache.has(category)) return itemCategoryCache.get(category);
  let items = [];
  try {
    const url = `https://api.open5e.com/v2/items/?category=${encodeURIComponent(category)}&document=${OPEN5E_DOCUMENT}&limit=100`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      items = (data.results || []).map(normalizeItem);
    }
  } catch (err) {
    items = [];
  }
  itemCategoryCache.set(category, items);
  return items;
}

async function fetchShopItems(shopType) {
  const categories = SHOP_ITEM_CATEGORIES[shopType];
  if (!categories) return [];
  const pools = await Promise.all(categories.map(fetchCategoryItems));
  const merged = pools.flat();
  const count = 3 + Math.floor(Math.random() * 2);
  return pickN(merged, Math.min(count, merged.length));
}

// Henter varer til alle butikker i `shops` parallelt og sætter dem på
// `shop.items`. Fejlende/tomme kategorier giver bare en tom vareliste.
async function attachShopItems(shops) {
  await Promise.all(
    shops.map(async (shop) => {
      shop.items = await fetchShopItems(shop.type);
    })
  );
  return shops;
}
