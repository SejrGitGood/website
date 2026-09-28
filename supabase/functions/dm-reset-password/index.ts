// DM'en nulstiller en spillers adgangskode (spillere.html → "Nulstil adgangskode").
//
// Supabase's indbyggede mailafsender når ikke spillernes mails, så "Glemt
// adgangskode?" virker ikke for dem. I stedet laver DM'en en midlertidig
// adgangskode her og giver den videre ved bordet; spilleren bliver bedt om at
// vælge sin egen, næste gang de logger ind (konto.html).
//
// Kræver admin-rettigheder til Supabase Auth, derfor en Edge Function: den
// bruger service_role-nøglen, som kun findes her på serveren (miljøvariabel),
// og tjekker selv, at den, der kalder, er en godkendt DM.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });

// Uden tegn, der let forveksles (0/o, 1/l/i), så den er nem at læse højt ved bordet.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function tempPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Hvem kalder? Kun en godkendt DM må nulstille.
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !caller?.user) return json({ error: "Du er ikke logget ind." }, 401);
  const { data: me } = await admin.from("members").select("role, status").eq("user_id", caller.user.id).maybeSingle();
  if (!me || me.role !== "dm" || me.status !== "approved") {
    return json({ error: "Kun DM'en kan nulstille adgangskoder." }, 403);
  }

  const body = await req.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) return json({ error: "Ingen konto valgt." }, 400);
  if (userId === caller.user.id) return json({ error: "Din egen adgangskode skifter du under Min konto." }, 400);
  const { data: target } = await admin.from("members").select("email, display_name").eq("user_id", userId).maybeSingle();
  if (!target) return json({ error: "Kontoen findes ikke." }, 404);

  const password = tempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
    // Login-siden sender spilleren videre til Min konto for at vælge sin egen.
    user_metadata: { must_change_password: true },
  });
  if (error) return json({ error: error.message }, 500);

  return json({ password, email: target.email, name: target.display_name });
});
