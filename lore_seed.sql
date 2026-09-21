-- Blessings of Valkyriegade: lore udtrukket fra Session 1-referaterne.
-- Kør i Supabase -> SQL Editor -> New query -> Run. Trygt at køre igen
-- (matcher på titel, så du ikke får dubletter).

insert into lore_entries (title, category, body, created_by)
select v.title, v.category, v.body, 'Fra sessionsnotaterne'
from (values
  ('Hertuginde Morwen', 'NPC', 'Daggerfords hertuginde og selskabets vigtigste allierede i byen. Har tidligere betalt godt for at få sit oldeforældres diadem tilbage fra en flok goblins. Ved et middagsselskab bad hun om hjælp til at få en gruppe omrejsende (Vistani) til at forlade området fredeligt — noget selskabet i sidste ende ikke fik gjort, da de i stedet fulgte de rejsende til Barovia.'),
  ('Jimothy', 'NPC', 'Hertuginde Morwens nervøse butler på manoren. Åbner dørene, tager imod, og virker altid en anelse ilde til mode.'),
  ('Albert', 'NPC', 'Bartenderen på selskabets faste kro i Daggerford. Kender dem godt og sætter gerne drinks og solsikkefrø frem "på huset".'),
  ('Vagten Moliyr', 'NPC', 'En af hertugindens vagter, sendt ud for at tale de omrejsende Vistani til fornuft. Kom tilbage underligt sympatisk over for dem og kunne bagefter ikke huske, hvad der egentlig blev sagt — en stærk indikation af, at nogen eller noget påvirkede ham.'),
  ('Stanimir', 'NPC', 'Lederen af den Vistani-karavane, selskabet mødte uden for Daggerfords mure. Fortalte historien om en forbandet prins i Barovia og inviterede selskabet med for at hjælpe. Lovede Troelius hjælp til at spore Baltazar Saheir og Mario, når prinsen er reddet.'),
  ('Madam Eva', 'NPC', 'En synsk kvinde blandt Vistani-folket i Barovia. Skal angiveligt allerede have forudset selskabets ankomst og menes at kunne hjælpe med at bryde forbandelsen over Barovias prins. Endnu ikke mødt.'),
  ('Den Forbandede Prins', 'NPC', 'En navnløs prins af Barovia. Reddet af Vistani-folket efter et blodigt slag, men siden forvandlet af en forbandelse til en tyran i sit eget rige. Formodes at være målet for hele rejsen til Barovia.'),
  ('Mario', 'NPC', 'Troelius'' tidligere højre hånd, som forrådte ham fuldstændig i deres hjemby. Troelius søger magt nok til for alvor at gøre op med ham. Ikke fysisk til stede — men aldrig langt fra Troelius'' tanker.'),
  ('Baltazar Saheir', 'NPC', 'Et navn, Troelius har hvisket for sig selv i årevis. Stanimir har lovet at hjælpe med at spore ham, når selskabet har hjulpet med at redde Barovias prins. Endnu et mysterium.'),
  ('Troelbot', 'NPC', 'Troelius'' trofaste konstrukt-følgesvend. Går forrest med faklen gennem tåge og mørke og fungerer som selskabets fyrtårn, når overblikket forsvinder.'),
  ('Daggerford', 'Sted', 'Solbeskinnet, muret handelsby i Faerûn, hvor selskabet mødtes og tilbragte deres første to til fire uger sammen. Hjemsted for hertuginde Morwen og udgangspunktet for hele rejsen mod Barovia.'),
  ('Barovia', 'Sted', 'Det forbandede land, Vistani-folket rejser mod, og hvor deres prins er blevet forvandlet til en tyran. Selskabet er på vej dertil, men nåede aldrig frem før tågen greb dem.'),
  ('Den Uendelige Tåge', 'Sted', 'En overnaturlig, ikke-endende tåge, selskabet vågnede fanget i efter deres første nat med Vistani-karavanen. Telte, heste og rejsefæller var alle sporløst forsvundet.'),
  ('De Hovedløse Vogtere', 'Sted', 'To kæmpestore, hovedløse stenstatuer, der flankerer en massiv stendør dybt i tågen. Døren åbnede sig selv og førte selskabet ind i en mørk skov — lige inden ulvene angreb.'),
  ('Diademet og Goblinerne', 'Begivenhed', 'Selskabets forudgående bedrift, som vandt dem hertuginde Morwens tillid: generobringen af hendes oldeforældres stjålne diadem fra en flok goblins. Det var denne bedrift, middagsinvitationen og hele rejsen udsprang af.'),
  ('Ulveangrebet ved Vogterporten', 'Begivenhed', 'Kampen, der afsluttede Session 1. Lige efter De Hovedløse Vogteres dør åbnede sig, blev selskabet overfaldet af en flok ulve i den mørke skov. De vandt — forpustede, men sejrende — og står nu et godt stykke fra alt, hvad der ligner sikkerhed.'),
  ('De To Krigshamre', 'Genstand', 'Både Frank og Clarence bærer en tung krigshammer med adskillige navne indridset i asksort stål — påfaldende ens beskrivelser, ingen af dem har forklaret sammenhængen på. Værd at holde øje med.')
) as v(title, category, body)
where not exists (
  select 1 from lore_entries le where le.title = v.title
);
