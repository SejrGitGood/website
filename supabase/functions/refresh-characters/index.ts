// Henter alle karakterer i "characters"-tabellen fra D&D Beyonds uofficielle
// character-service, og opdaterer hver række med et renset udsnit af data.
//
// Kaldes to veje:
//   1. Manuelt: "Opdater nu"-knappen på characters.html (bruger den delte
//      kontos session, verificeret normalt af Supabase).
//   2. Automatisk: et pg_cron-job i databasen kalder denne funktion med
//      service_role-nøglen med jævne mellemrum (se CRON_SETUP.md).
//
// Kører server-side, så D&D Beyonds manglende CORS-understøttelse er ligegyldig her.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STAT_NAMES: Record<number, string> = { 1: "STR", 2: "DEX", 3: "CON", 4: "INT", 5: "WIS", 6: "CHA" };
const ALIGNMENTS: Record<number, string> = {
  1: "Lovlig god", 2: "Neutral god", 3: "Kaotisk god",
  4: "Lovlig neutral", 5: "Neutral", 6: "Kaotisk neutral",
  7: "Lovlig ond", 8: "Neutral ond", 9: "Kaotisk ond",
};

function summarize(data: any) {
  const stats: Record<number, number> = {};
  (data.stats || []).forEach((s: any) => (stats[s.id] = s.value));
  const bonus: Record<number, number> = {};
  (data.bonusStats || []).forEach((s: any) => (bonus[s.id] = s.value || 0));
  const override: Record<number, number | null> = {};
  (data.overrideStats || []).forEach((s: any) => (override[s.id] = s.value));

  const finalStats = [1, 2, 3, 4, 5, 6].map((id) => {
    const val = override[id] ?? (stats[id] ?? 10) + (bonus[id] ?? 0);
    return { name: STAT_NAMES[id], score: val, mod: Math.floor((val - 10) / 2) };
  });

  const maxHp = data.overrideHitPoints ?? (data.baseHitPoints ?? 0) + (data.bonusHitPoints ?? 0);
  const currentHp = maxHp - (data.removedHitPoints ?? 0);

  const equipped = (data.inventory || [])
    .filter((it: any) => it.equipped)
    .map((it: any) => ({ name: it.definition?.name, type: it.definition?.type }));

  return {
    name: data.name,
    race: data.race?.fullName ?? null,
    classes: (data.classes || []).map((c: any) => ({
      name: c.definition?.name,
      level: c.level,
      subclass: c.subclassDefinition?.name ?? null,
    })),
    background: data.background?.definition?.name ?? null,
    alignment: ALIGNMENTS[data.alignmentId] ?? null,
    hp: { current: currentHp, max: maxHp, temp: data.temporaryHitPoints ?? 0 },
    stats: finalStats,
    portraitUrl: data.decorations?.avatarUrl ?? data.race?.avatarUrl ?? null,
    equipped,
    sheetUrl: data.readonlyUrl ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: rows, error: fetchErr } = await supabase.from("characters").select("id, ddb_character_id");
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const results: Record<string, string> = {};

  await Promise.all(
    (rows || []).map(async (row) => {
      try {
        const res = await fetch(
          `https://character-service.dndbeyond.com/character/v5/character/${row.ddb_character_id}`
        );
        if (!res.ok) {
          await supabase
            .from("characters")
            .update({ is_public: false, updated_at: new Date().toISOString() })
            .eq("id", row.id);
          results[row.ddb_character_id] = `privat (HTTP ${res.status})`;
          return;
        }
        const json = await res.json();
        const summary = summarize(json.data);
        await supabase
          .from("characters")
          .update({ is_public: true, data: summary, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        results[row.ddb_character_id] = "opdateret";
      } catch (err) {
        results[row.ddb_character_id] = `fejl: ${(err as Error).message}`;
      }
    })
  );

  return new Response(JSON.stringify({ results }), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
});
