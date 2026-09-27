// Tolker en stat block, kopieret som tekst (fra D&D Beyond, en PDF eller skrevet
// af), til samme form som Open5e's monsterdata — så kampbyggeren, stat
// block-visningen og tælleren for legendariske handlinger virker uændret.
// Kan både 2014-opsætningen ("Armor Class 16", "Challenge 13 (10,000 XP)") og
// 2024-opsætningen ("AC 16  Initiative +14", tabellen med MOD/SAVE, "CR 13 (XP …)").

const STAT_ABBR = ["str", "dex", "con", "int", "wis", "cha"];
const STAT_FIELD = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
const STAT_FULL = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };
const CONDITION_NAMES = [
  "blinded", "charmed", "deafened", "exhaustion", "frightened", "grappled", "incapacitated", "invisible",
  "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious",
];
// Overskrifter, der starter et afsnit, og hvor afsnittet gemmes.
const STAT_SECTIONS = {
  traits: "special_abilities",
  actions: "actions",
  "bonus actions": "bonus_actions",
  reactions: "reactions",
  "legendary actions": "legendary_actions",
  "lair actions": "lair_actions",
  "mythic actions": "mythic_actions",
  "regional effects": "regional_effects",
};
// Linjer i bunden af en 2024-stat block eller en kildeangivelse, der ikke hører til.
const STAT_FOOTER = /^(habitat|treasure|source|tags|environment)\b/i;

const toNumber = (s) => Number(String(s).replace(/[−–]/g, "-").replace(/\s+/g, ""));
function crToNumber(s) {
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
  return m ? Number(m[1]) / Number(m[2]) : Number(s);
}
function statKey(word) {
  const w = word.toLowerCase().replace(/\.$/, "");
  return STAT_ABBR.includes(w) ? w : STAT_FULL[w] || null;
}

// "Name. Tekst" — kort navn i overskriftsform (evt. med parentes), punktum, tekst.
// Linjer, der ikke ligner det, hører til den forrige indgang.
function entryStart(line) {
  const m = /^([A-Z0-9][^.:!?]{0,70}?)\.\s+(\S.*)$/.exec(line);
  if (!m) return null;
  const bare = m[1].replace(/\([^)]*\)/g, " ").trim();
  const words = bare.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 7) return null;
  if (words.some((w) => w.length > 3 && !/^[A-Z0-9'’"-]/.test(w))) return null;
  return { name: m[1].trim(), desc: m[2].trim() };
}

function parseSpeed(text) {
  const speed = {};
  text.split(",").forEach((part) => {
    const m = /^\s*(?:([a-z]+)\s+)?(\d+)\s*ft\.?\s*(\(hover\))?/i.exec(part);
    if (!m) return;
    speed[m[1] ? m[1].toLowerCase() : "walk"] = Number(m[2]);
    if (m[3]) speed.hover = true;
  });
  return speed;
}
function parseBonusList(text) {
  const out = {};
  text.split(",").forEach((part) => {
    const m = /^\s*(.+?)\s+([+−-]\s*\d+)\s*$/.exec(part);
    if (m) out[m[1].trim()] = toNumber(m[2]);
  });
  return out;
}

function parseStatBlock(text) {
  const block = {
    name: "", size: "", type: "", subtype: "", alignment: "",
    armor_class: null, armor_desc: "", hit_points: null, hit_dice: "", speed: {},
    strength: null, dexterity: null, constitution: null, intelligence: null, wisdom: null, charisma: null,
    strength_save: null, dexterity_save: null, constitution_save: null, intelligence_save: null, wisdom_save: null, charisma_save: null,
    skills: {}, damage_vulnerabilities: "", damage_resistances: "", damage_immunities: "", condition_immunities: "",
    senses: "", languages: "", challenge_rating: "", cr: null, initiative: null,
    special_abilities: [], actions: [], bonus_actions: [], reactions: [], legendary_desc: "", legendary_actions: [],
  };
  const lines = String(text || "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim());
  if (!lines.length) return block;

  // --- Toppen: alt indtil første afsnitsoverskrift, eller første "Name. Tekst"-linje efter CR ---
  const header = [];
  let i = 0;
  let sawCr = false;
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (STAT_SECTIONS[line.toLowerCase()]) break;
    if (sawCr && !/^proficiency bonus/i.test(line) && !/^(gear|pb)\b/i.test(line)) break;
    // Uden CR og uden "Traits": første "Name. Tekst"-linje er første egenskab.
    if (header.length > 1 && entryStart(line)) break;
    if (/^(challenge|cr)\s+[\d/]+/i.test(line)) sawCr = true;
    header.push(lines[i]);
  }

  const typeLine = /^((?:tiny|small|medium|large|huge|gargantuan)(?:\s+or\s+(?:tiny|small|medium|large|huge|gargantuan))?)\s+([^,(]+?)\s*(?:\(([^)]*)\))?\s*(?:,\s*(.*))?$/i;
  header.forEach((raw, idx) => {
    const line = raw.trim();
    let m;
    if (idx === 0 && !typeLine.test(line) && !/^(armor class|ac|hit points|hp)\b/i.test(line)) {
      block.name = line;
    } else if (!block.size && (m = typeLine.exec(line))) {
      block.size = m[1];
      block.type = m[2].trim();
      block.subtype = (m[3] || "").trim();
      block.alignment = (m[4] || "").trim();
    } else if ((m = /^(?:armor class|ac)\s+(\d+)\s*(?:\(([^)]*)\))?/i.exec(line))) {
      block.armor_class = Number(m[1]);
      block.armor_desc = (m[2] || "").trim();
    } else if ((m = /^(?:hit points|hp)\s+(\d+)\s*(?:\(([^)]*)\))?/i.exec(line))) {
      block.hit_points = Number(m[1]);
      block.hit_dice = (m[2] || "").replace(/\s+/g, "").replace(/[−–]/g, "-");
    } else if ((m = /^speed\s+(.+)$/i.exec(line))) {
      block.speed = parseSpeed(m[1]);
    } else if ((m = /^saving throws\s+(.+)$/i.exec(line))) {
      Object.entries(parseBonusList(m[1])).forEach(([k, v]) => {
        const key = statKey(k);
        if (key) block[`${STAT_FIELD[key]}_save`] = v;
      });
    } else if ((m = /^skills\s+(.+)$/i.exec(line))) {
      block.skills = parseBonusList(m[1]);
    } else if ((m = /^(?:damage\s+)?vulnerabilities\s+(.+)$/i.exec(line))) {
      block.damage_vulnerabilities = m[1].trim();
    } else if ((m = /^(?:damage\s+)?resistances\s+(.+)$/i.exec(line))) {
      block.damage_resistances = m[1].trim();
    } else if ((m = /^damage immunities\s+(.+)$/i.exec(line))) {
      block.damage_immunities = m[1].trim();
    } else if ((m = /^condition immunities\s+(.+)$/i.exec(line))) {
      block.condition_immunities = m[1].trim();
    } else if ((m = /^immunities\s+(.+)$/i.exec(line))) {
      // 2024 samler skade og tilstande: "Necrotic, Poison; Charmed, Poisoned".
      const parts = m[1].split(";").map((s) => s.trim()).filter(Boolean);
      const isConditions = (s) => s.split(",").every((w) => CONDITION_NAMES.includes(w.trim().toLowerCase()));
      if (parts.length > 1) {
        block.damage_immunities = parts.slice(0, -1).join("; ");
        block.condition_immunities = parts[parts.length - 1];
      } else if (parts.length && isConditions(parts[0])) {
        block.condition_immunities = parts[0];
      } else {
        block.damage_immunities = parts.join("; ");
      }
    } else if ((m = /^senses\s+(.+)$/i.exec(line))) {
      block.senses = m[1].trim();
    } else if ((m = /^languages\s+(.+)$/i.exec(line))) {
      block.languages = m[1].trim();
    } else if ((m = /^(?:challenge|cr)\s+([\d]+(?:\s*\/\s*\d+)?)/i.exec(line))) {
      block.challenge_rating = m[1].replace(/\s+/g, "");
      block.cr = crToNumber(block.challenge_rating);
    }
    if ((m = /initiative\s+([+−-]\s*\d+)/i.exec(line))) block.initiative = toNumber(m[1]);
  });

  // Evner: 2024-tabel ("STR 18 +4 +4" — værdi, mod, save), "STR 18 (+4)" (på én
  // eller to linjer) eller en række med alle seks forkortelser efterfulgt af seks tal.
  const joined = header.join(" ").replace(/\s+/g, " ");
  const table = /\b(str|dex|con|int|wis|cha)\s+(\d{1,2})\s+([+−-]\s*\d+)\s+([+−-]\s*\d+)/gi;
  let t;
  while ((t = table.exec(joined))) {
    const field = STAT_FIELD[t[1].toLowerCase()];
    block[field] = Number(t[2]);
    if (toNumber(t[4]) !== toNumber(t[3])) block[`${field}_save`] = toNumber(t[4]);
  }
  const row = /\bSTR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\b\s+((?:\d{1,2}\s*\(\s*[+−-]?\s*\d+\s*\)\s*){6})/i.exec(joined);
  if (row) {
    const scores = row[1].match(/\d{1,2}(?=\s*\()/g);
    STAT_ABBR.forEach((k, idx) => {
      if (block[STAT_FIELD[k]] == null) block[STAT_FIELD[k]] = Number(scores[idx]);
    });
  }
  const single = /\b(STR|DEX|CON|INT|WIS|CHA)\b\s+(\d{1,2})\s*\(\s*[+−-]?\s*\d+\s*\)/gi;
  let s;
  while ((s = single.exec(joined))) {
    const field = STAT_FIELD[s[1].toLowerCase()];
    if (block[field] == null) block[field] = Number(s[2]);
  }

  // --- Afsnit: Traits (eller det der står efter toppen), Actions, Legendary Actions … ---
  let key = "special_abilities";
  let current = null;
  const intros = {};
  const target = (k) => (block[k] = block[k] || []);
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    const heading = STAT_SECTIONS[line.toLowerCase()];
    if (heading) {
      key = heading;
      current = null;
      continue;
    }
    if (STAT_FOOTER.test(line)) continue;
    const entry = entryStart(line);
    if (entry) {
      current = entry;
      target(key).push(current);
    } else if (current) {
      current.desc += "\n" + line;
    } else {
      intros[key] = intros[key] ? `${intros[key]}\n${line}` : line;
    }
  }
  // Indledningen til legendariske handlinger bærer antallet ("can take 3 …" / "Uses: 3").
  if (intros.legendary_actions) block.legendary_desc = intros.legendary_actions;
  Object.entries(intros).forEach(([k, text]) => {
    if (k !== "legendary_actions") target(k).unshift({ name: "", desc: text });
  });
  return block;
}

// Hvad der mangler for at monsteret kan bruges i en kamp.
function statBlockWarnings(block) {
  const missing = [];
  if (!block.name) missing.push("navn");
  if (block.hit_points == null) missing.push("HP");
  if (block.armor_class == null) missing.push("AC");
  if (block.cr == null || Number.isNaN(block.cr)) missing.push("CR");
  if (STAT_ABBR.some((k) => block[STAT_FIELD[k]] == null)) missing.push("evneværdier");
  return missing;
}
