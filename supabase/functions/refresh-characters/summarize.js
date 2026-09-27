// Omsætter D&D Beyonds rå karakter-JSON til det udsnit, siden bruger
// (characters.data). Ren JavaScript uden Deno-afhængigheder, så præcis den
// samme kode kan testes i en browser mod gemte ark.
//
// Reglerne er tjekket mod D&D Beyonds egne ark (AC, initiativ, evneværdier,
// angreb, spell DC). D&D Beyond gemmer ingen udregnet AC — den bygges her af
// udstyret rustning/skjold + DEX + modifikatorer.

const ABILITIES = [
  [1, "STR", "strength"],
  [2, "DEX", "dexterity"],
  [3, "CON", "constitution"],
  [4, "INT", "intelligence"],
  [5, "WIS", "wisdom"],
  [6, "CHA", "charisma"],
];
const ALIGNMENTS = {
  1: "Lovlig god", 2: "Neutral god", 3: "Kaotisk god",
  4: "Lovlig neutral", 5: "Neutral", 6: "Kaotisk neutral",
  7: "Lovlig ond", 8: "Neutral ond", 9: "Kaotisk ond",
};
const ACTIVATION = { 1: "action", 3: "bonus", 4: "reaction" };
const RESET = { 1: "kort hvil", 2: "langt hvil" };
// Spell slots pr. samlet caster-niveau (fuld caster) — bruges kun ved multiclass;
// en enkelt klasse bruger sin egen tabel fra D&D Beyond.
const FULL_CASTER_SLOTS = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const modOf = (score) => Math.floor((score - 10) / 2);

function cleanText(html) {
  return String(html || "")
    .replace(/<\/?(p|br|div|li|ul|ol|h\d|tr|td|table)\b[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&[lr]squo;|&#39;/g, "'")
    .replace(/&[lr]dquo;|&quot;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Lille regnestykke-parser (+ - * / og parenteser) til skabelonerne nedenfor.
function evalArithmetic(expr) {
  const tokens = expr.match(/\d+(?:\.\d+)?|[+\-*/()]/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function factor() {
    const t = next();
    if (t === "(") {
      const v = sum();
      if (next() !== ")") throw new Error("mangler )");
      return v;
    }
    if (t === "-") return -factor();
    if (t === "+") return factor();
    const n = Number(t);
    if (t === undefined || Number.isNaN(n)) throw new Error("ugyldigt tal");
    return n;
  }
  function product() {
    let v = factor();
    while (peek() === "*" || peek() === "/") v = next() === "*" ? v * factor() : v / factor();
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + product() : v - product();
    return v;
  }
  const v = sum();
  if (i !== tokens.length) throw new Error("overskydende tegn");
  return v;
}

// D&D Beyonds beskrivelser indeholder skabeloner som {{modifier:cha@min:1#unsigned}},
// {{savedc:wis}}, {{limiteduse}} eller {{1+(classlevel/7)@rounddown,max:...}}.
// De almindelige udregnes; resten fjernes.
function renderTemplates(text, ctx, dice, usesMax) {
  const subst = (expr) =>
    expr
      .replace(/modifier:(str|dex|con|int|wis|cha)/g, (_m, a) => String(ctx.mods[a]))
      .replace(/savedc:(str|dex|con|int|wis|cha)/g, (_m, a) => String(8 + ctx.pb + ctx.mods[a]))
      .replace(/proficiency/g, String(ctx.pb))
      .replace(/(classlevel|characterlevel)/g, String(ctx.level))
      .replace(/limiteduse/g, usesMax != null ? String(usesMax) : "x");
  const evaluate = (expr) => {
    const e = subst(expr).trim();
    if (!e || !/^[\d+\-*/().\s]+$/.test(e)) return NaN;
    try {
      return evalArithmetic(e);
    } catch (_e) {
      return NaN;
    }
  };
  return text.replace(/\{\{([^}]*)\}\}/g, (_, raw, offset, whole) => {
    const explicitSigned = raw.includes("#signed");
    const explicitUnsigned = raw.includes("#unsigned");
    const min = /@min:(-?\d+)/.exec(raw);
    const roundUp = raw.includes("@roundup");
    const body = raw.replace(/#\w+/g, "").replace(/@min:-?\d+/g, "").replace(/@round(down|up)/g, "");
    const [main, ...options] = body.split(",");
    // Uden terning er "scalevalue" antallet (f.eks. Channel Divinity: "2 times").
    if (main.trim() === "scalevalue") return dice || (usesMax != null ? String(usesMax) : "");
    let value = evaluate(main);
    if (!Number.isFinite(value)) return "";
    value = roundUp ? Math.ceil(value) : Math.floor(value);
    options.forEach((opt) => {
      const m = /^\s*(max|min):(.*)$/.exec(opt);
      const cap = m ? Math.floor(evaluate(m[2])) : NaN;
      if (Number.isFinite(cap)) value = m[1] === "max" ? Math.min(value, cap) : Math.max(value, cap);
    });
    if (min) value = Math.max(Number(min[1]), value);
    // Står værdien lige efter en terning ("1d8{{modifier:wis}}"), er det et tillæg: +3.
    const afterDice = /\d$/.test(whole.slice(0, offset));
    const signed = explicitSigned || (!explicitUnsigned && afterDice);
    return signed && value >= 0 ? `+${value}` : String(value);
  });
}

// Alle modifikatorer, der faktisk gælder: magiske genstande kun når de er
// udstyret (og attuned, hvis det kræves).
function activeModifiers(data) {
  const itemsById = new Map((data.inventory || []).map((it) => [it.definition && it.definition.id, it]));
  const out = [];
  Object.entries(data.modifiers || {}).forEach(([source, mods]) => {
    (mods || []).forEach((m) => {
      if (source === "item") {
        const it = itemsById.get(m.componentId);
        if (!it || !it.equipped) return;
        if (m.requiresAttunement && !it.isAttuned) return;
      }
      out.push({ ...m, source });
    });
  });
  return out;
}

function abilityScores(data, mods, featsById) {
  const base = {};
  (data.stats || []).forEach((s) => (base[s.id] = s.value ?? 10));
  const bonus = {};
  (data.bonusStats || []).forEach((s) => (bonus[s.id] = s.value || 0));
  const override = {};
  (data.overrideStats || []).forEach((s) => (override[s.id] = s.value));

  // 2024-reglerne: evneforøgelser kommer fra baggrunden. Har baggrunden givet
  // nogen, ignorerer D&D Beyond artens (valgfrie) forøgelser.
  const backgroundAsi = mods.some(
    (m) => m.source === "feat" && /-score$/.test(m.subType || "") && /Ability Score Improvements$/.test(featsById.get(m.componentId) || "")
  );

  return ABILITIES.map(([id, name, long]) => {
    if (override[id] != null) return { name, score: override[id], mod: modOf(override[id]) };
    let score = (base[id] ?? 10) + (bonus[id] ?? 0);
    let setTo = null;
    mods.forEach((m) => {
      if (m.subType !== `${long}-score`) return;
      if (m.type === "bonus" && !(backgroundAsi && m.source === "race")) score += m.value || 0;
      if (m.type === "set") setTo = Math.max(setTo ?? 0, m.value || 0);
    });
    score = Math.min(score, 20);
    if (setTo != null) score = Math.max(score, setTo);
    return { name, score, mod: modOf(score) };
  });
}

function armorClass(data, mods, abil) {
  const equipped = (data.inventory || []).filter((it) => it.equipped && it.definition);
  const armor = equipped.find((it) => [1, 2, 3].includes(it.definition.armorTypeId));
  const shield = equipped.find((it) => it.definition.armorTypeId === 4);
  const dex = abil.DEX;
  let ac;
  if (armor) {
    const type = armor.definition.armorTypeId;
    ac = (armor.definition.armorClass || 0) + (type === 1 ? dex : type === 2 ? Math.min(dex, 2) : 0);
  } else {
    // Ubevæbnet: 10 + DEX, eller en "unarmored defense" (Barbar: +CON, Munk: +WIS).
    ac = 10 + dex;
    mods
      .filter((m) => m.type === "set" && m.subType === "unarmored-armor-class")
      .forEach((m) => {
        const extra = m.statId ? abil[ABILITIES[m.statId - 1][1]] : 0;
        ac = Math.max(ac, 10 + dex + extra + (m.value || 0));
      });
  }
  if (shield) ac += shield.definition.armorClass || 0;
  mods
    .filter((m) => m.type === "bonus")
    .forEach((m) => {
      if (m.subType === "armor-class") ac += m.value || 0;
      else if (m.subType === "armored-armor-class" && armor) ac += m.value || 0;
      else if (m.subType === "unarmored-armor-class" && !armor) ac += m.value || 0;
    });
  return ac;
}

function initiativeBonus(mods, abil, pb) {
  let bonus = abil.DEX;
  let proficient = false;
  mods
    .filter((m) => m.type === "bonus" && m.subType === "initiative")
    .forEach((m) => {
      if ((m.bonusTypes || []).includes(1)) proficient = true; // f.eks. Alert (2024): + proficiency bonus
      bonus += m.value || 0;
    });
  if (proficient) bonus += pb;
  else if (mods.some((m) => m.type === "half-proficiency" && ["initiative", "ability-checks"].includes(m.subType))) {
    bonus += Math.floor(pb / 2); // Jack of All Trades
  }
  return bonus;
}

function weaponAttacks(data, mods, abil, pb) {
  const rangedBonus = mods.filter((m) => m.type === "bonus" && m.subType === "ranged-weapon-attacks").reduce((s, m) => s + (m.value || 0), 0);
  return (data.inventory || [])
    .filter((it) => it.equipped && it.definition && it.definition.filterType === "Weapon")
    .map((it) => {
      const def = it.definition;
      const props = (def.properties || []).map((p) => p.name);
      const ranged = def.attackType === 2;
      const ability = props.includes("Finesse") ? Math.max(abil.STR, abil.DEX) : ranged ? abil.DEX : abil.STR;
      const magic = (def.grantedModifiers || [])
        .filter((m) => m.type === "bonus" && m.subType === "magic")
        .reduce((s, m) => s + (m.value || 0), 0);
      // D&D Beyond regner udstyrede våben som nogle, karakteren kan bruge.
      const toHit = ability + pb + magic + (ranged ? rangedBonus : 0);
      const dmgBonus = ability + magic;
      const dice = (def.damage && def.damage.diceString) || "1";
      const range = ranged || props.includes("Thrown")
        ? `${def.range}/${def.longRange} ft.`
        : `${props.includes("Reach") ? 10 : 5} ft.`;
      return {
        name: def.name,
        toHit,
        damage: dmgBonus ? `${dice}${dmgBonus > 0 ? "+" : ""}${dmgBonus}` : dice,
        damageType: def.damageType || "",
        range,
        properties: props,
      };
    });
}

function classActions(data, ctx) {
  const out = [];
  Object.values(data.actions || {}).forEach((list) => {
    (list || []).forEach((a) => {
      const act = a.activation || {};
      const lu = a.limitedUse;
      let uses = null;
      if (lu && (lu.maxUses || lu.statModifierUsesId || lu.useProficiencyBonus)) {
        let max = lu.maxUses || 0;
        if (lu.statModifierUsesId) max += Math.max(1, ctx.modsById[lu.statModifierUsesId]);
        if (lu.useProficiencyBonus) max += ctx.pb;
        uses = { max, used: lu.numberUsed || 0, reset: RESET[lu.resetType] || null };
      }
      const dice = a.dice && a.dice.diceString;
      out.push({
        name: a.name,
        kind: ACTIVATION[act.activationType] || "other",
        text: renderTemplates(cleanText(a.snippet || a.description), ctx, dice, uses && uses.max).slice(0, 320),
        uses,
      });
    });
  });
  return out;
}

function spellcasting(data, abil, pb) {
  const classes = data.classes || [];
  const casters = classes
    .map((c) => {
      const abilityId = (c.subclassDefinition && c.subclassDefinition.spellCastingAbilityId) || c.definition.spellCastingAbilityId;
      return abilityId ? { c, abilityId } : null;
    })
    .filter(Boolean);

  const info = casters.map(({ c, abilityId }) => {
    const abbr = ABILITIES[abilityId - 1][1];
    return { className: c.definition.name, ability: abbr, attack: pb + abil[abbr], dc: 8 + pb + abil[abbr] };
  });

  let slotCounts = [];
  if (casters.length === 1) {
    const { c } = casters[0];
    slotCounts = ((c.definition.spellRules && c.definition.spellRules.levelSpellSlots) || [])[c.level] || [];
  } else if (casters.length > 1) {
    const casterLevel = casters.reduce((sum, { c }) => {
      const r = c.definition.spellRules || {};
      const div = r.multiClassSpellSlotDivisor || 1;
      return sum + (r.multiClassSpellSlotRounding === 2 ? Math.ceil(c.level / div) : Math.floor(c.level / div));
    }, 0);
    slotCounts = FULL_CASTER_SLOTS[Math.min(20, casterLevel)] || [];
  }
  const used = {};
  (data.spellSlots || []).forEach((s) => (used[s.level] = s.used || 0));
  const slots = slotCounts
    .map((max, i) => ({ level: i + 1, max, used: used[i + 1] || 0 }))
    .filter((s) => s.max > 0);

  const spells = [];
  const seen = new Set();
  const add = (s, always) => {
    const d = s.definition;
    if (!d || seen.has(d.name)) return;
    seen.add(d.name);
    spells.push({
      name: d.name,
      level: d.level,
      kind: ACTIVATION[(d.activation || s.activation || {}).activationType] || "other",
      concentration: !!d.concentration,
      ritual: !!d.ritual,
      always: !!always,
    });
  };
  (data.classSpells || []).forEach((cs) => {
    const list = cs.spells || [];
    // Klasser der forbereder besværgelser (f.eks. Cleric) har nogle markeret
    // "prepared" — så vises kun dem; ellers er alle på listen kendte.
    const prepares = list.some((s) => s.prepared);
    list.forEach((s) => {
      if (!prepares || s.definition.level === 0 || s.prepared || s.alwaysPrepared) add(s, s.alwaysPrepared);
    });
  });
  Object.values(data.spells || {}).forEach((list) => (list || []).forEach((s) => add(s, true)));
  spells.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return { info, slots, spells };
}

function defenses(mods) {
  const pick = (type) => [...new Set(mods.filter((m) => m.type === type).map((m) => m.friendlySubtypeName || m.subType))];
  return { resistances: pick("resistance"), immunities: pick("immunity"), vulnerabilities: pick("vulnerability") };
}

export function summarize(data) {
  const mods = activeModifiers(data);
  const featsById = new Map((data.feats || []).map((f) => [f.definition && f.definition.id, f.definition && f.definition.name]));
  const stats = abilityScores(data, mods, featsById);
  const abil = Object.fromEntries(stats.map((s) => [s.name, s.mod]));
  const level = (data.classes || []).reduce((sum, c) => sum + (c.level || 0), 0);
  const pb = 2 + Math.floor((Math.max(level, 1) - 1) / 4);

  // `baseHitPoints` er KUN summen af hit dice — Konstitution pr. niveau og
  // "hit-points-per-level" (f.eks. Tough) lægges til her.
  const hpPerLevel = mods
    .filter((m) => m.subType === "hit-points-per-level" && m.isGranted !== false)
    .reduce((sum, m) => sum + (m.value || 0), 0);
  const maxHp =
    data.overrideHitPoints ??
    (data.baseHitPoints ?? 0) + (data.bonusHitPoints ?? 0) + abil.CON * level + hpPerLevel * level;

  const proficient = (subType) => mods.some((m) => (m.type === "proficiency" || m.type === "expertise") && m.subType === subType);
  const expertise = (subType) => mods.some((m) => m.type === "expertise" && m.subType === subType);
  const ctx = {
    pb,
    level,
    mods: { str: abil.STR, dex: abil.DEX, con: abil.CON, int: abil.INT, wis: abil.WIS, cha: abil.CHA },
    modsById: { 1: abil.STR, 2: abil.DEX, 3: abil.CON, 4: abil.INT, 5: abil.WIS, 6: abil.CHA },
  };
  const casting = spellcasting(data, abil, pb);
  const ds = data.deathSaves || {};

  return {
    name: data.name,
    race: (data.race && data.race.fullName) || null,
    classes: (data.classes || []).map((c) => ({
      name: c.definition && c.definition.name,
      level: c.level,
      subclass: (c.subclassDefinition && c.subclassDefinition.name) || null,
    })),
    background: (data.background && data.background.definition && data.background.definition.name) || null,
    alignment: ALIGNMENTS[data.alignmentId] || null,
    hp: { current: maxHp - (data.removedHitPoints ?? 0), max: maxHp, temp: data.temporaryHitPoints ?? 0 },
    stats,
    ac: armorClass(data, mods, abil),
    initiative: initiativeBonus(mods, abil, pb),
    speed: (data.race && data.race.weightSpeeds && data.race.weightSpeeds.normal && data.race.weightSpeeds.normal.walk) || 30,
    proficiencyBonus: pb,
    saves: ABILITIES.map(([, name, long]) => ({
      name,
      mod: abil[name] + (proficient(`${long}-saving-throws`) ? pb : 0),
      proficient: proficient(`${long}-saving-throws`),
    })),
    passivePerception: 10 + abil.WIS + (expertise("perception") ? 2 * pb : proficient("perception") ? pb : 0),
    attacks: weaponAttacks(data, mods, abil, pb),
    actions: classActions(data, ctx),
    spellcasting: casting.info,
    spellSlots: casting.slots,
    spells: casting.spells,
    defenses: defenses(mods),
    deathSaves: { fail: ds.failCount || 0, success: ds.successCount || 0, stable: !!ds.isStabilized },
    portraitUrl: (data.decorations && data.decorations.avatarUrl) || (data.race && data.race.avatarUrl) || null,
    equipped: (data.inventory || [])
      .filter((it) => it.equipped)
      .map((it) => ({ name: it.definition && it.definition.name, type: it.definition && it.definition.type })),
    sheetUrl: data.readonlyUrl || null,
  };
}
