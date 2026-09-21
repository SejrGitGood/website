-- Blessings of Valkyriegade: karakterroster fra D&D Beyond.
-- Kør i Supabase -> SQL Editor -> New query -> Run. Trygt at køre igen.

insert into characters (player_name, character_name, ddb_character_id, sort_order, is_public)
values
  ('Emil', 'Frank Blækfløjte', 170733855, 1, false),
  ('Jacob', 'Troelius Richter', 169495304, 2, false),
  ('Markus', 'Abbas Ibn Al-Salah', 169928283, 3, false),
  ('Sejr', 'Clarence Claymore', 169495720, 4, false),
  ('Thomas', 'Mick Jaggstone', 167825352, 5, false)
on conflict (ddb_character_id) do nothing;

-- Clarence er gjort offentlig og hentet (2026-09-21).
update characters set
  is_public = true,
  updated_at = now(),
  data = $json$
{
  "name": "Clarence Claymore",
  "race": "Human",
  "classes": [
    { "name": "Cleric", "level": 3, "subclass": "War Domain" }
  ],
  "background": "Guard",
  "alignment": "Lovlig neutral",
  "hp": { "current": 15, "max": 18, "temp": 2 },
  "stats": [
    { "name": "STR", "score": 14, "mod": 2 },
    { "name": "DEX", "score": 8, "mod": -1 },
    { "name": "CON", "score": 13, "mod": 1 },
    { "name": "INT", "score": 10, "mod": 0 },
    { "name": "WIS", "score": 15, "mod": 2 },
    { "name": "CHA", "score": 12, "mod": 1 }
  ],
  "portraitUrl": "https://www.dndbeyond.com/avatars/17/225/636377843761000977.jpeg?width=350&height=350&fit=crop&quality=95&auto=webp",
  "equipped": [
    { "name": "Shield", "type": "Shield" },
    { "name": "Chain Mail", "type": "Heavy Armor" },
    { "name": "Warhammer", "type": "Warhammer" }
  ],
  "sheetUrl": "https://dndbeyond.com/characters/169495720"
}
$json$::jsonb
where ddb_character_id = 169495720;
