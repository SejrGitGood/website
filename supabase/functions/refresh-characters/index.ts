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
// Selve udtrækket (AC, initiativ, angreb, handlinger, besværgelser ...) ligger
// i summarize.js, så det kan testes i en browser mod gemte ark.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { summarize } from "./summarize.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
