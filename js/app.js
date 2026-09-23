// Fælles hjælpefunktioner til alle sider. Kræver at config.js og
// supabase-js (CDN) er indlæst FØR denne fil.
window.sb = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

// Gør siden installerbar som app (Føj til hjemmeskærm) — se sw.js for hvorfor
// den ikke cacher noget. Fejler stille hvis browseren ikke understøtter det.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

const NAV_LINKS = [
  { href: "index.html", label: "Forside" },
  { href: "historien.html", label: "Historien" },
  { href: "dmtools.html", label: "DM Tools" },
  { href: "logistics.html", label: "Logistik" },
];

// --- Forfatter-tilskrivning: hvem skrev/redigerede en session eller
// lore-indgang. `created_by` kan ikke komme fra login'et (alle fem deler én
// konto), så brugeren vælger selv sit navn — huskes pr. browser bagefter. ---
function getStoredAuthorName() {
  try {
    return localStorage.getItem("authorName") || "";
  } catch (e) {
    return "";
  }
}
function wireAuthorField(inputEl) {
  if (!inputEl.value) inputEl.value = getStoredAuthorName();
  inputEl.addEventListener("change", () => {
    try {
      localStorage.setItem("authorName", inputEl.value.trim());
    } catch (e) {
      // ignoreres — feltet virker stadig, huskes bare ikke til næste gang
    }
  });
}

// Bygger en lille "Skrevet af X · Oprettet ... · Redigeret ..."-linje.
// `created_by`, der ligner en email, er fra før dette fandtes (den delte
// konto alene) og siger intet brugbart, så den udelades.
function attributionLine(item) {
  const parts = [];
  if (item.created_by && !item.created_by.includes("@")) {
    parts.push(`Skrevet af ${escapeHtml(item.created_by)}`);
  }
  if (item.created_at) {
    parts.push(`Oprettet ${formatDate(item.created_at)}`);
  }
  if (item.updated_at && item.created_at && new Date(item.updated_at) - new Date(item.created_at) > 60000) {
    parts.push(`Redigeret ${formatDate(item.updated_at)}`);
  }
  return parts.join(" &middot; ");
}

// --- Tema: Auto følger systemet, de andre tilsidesætter det. Rent
// visningsvalg pr. browser — gemmes kun lokalt, aldrig i databasen. ---
function getStoredTheme() {
  try {
    return localStorage.getItem("theme") || "auto";
  } catch (e) {
    return "auto";
  }
}
function setStoredTheme(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch (e) {
    // ignoreres — temaet virker stadig for denne visning, gemmes bare ikke
  }
}
function applyTheme(theme) {
  if (theme && theme !== "auto") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}
applyTheme(getStoredTheme());

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleDateString("da-DK", { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d)) return value;
  return d.toLocaleString("da-DK", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// Genererer og downloader en .ics-fil for en enkelt begivenhed — rent
// klient-side, ingen backend nødvendig. `durationHours` antager en typisk
// session-længde, da vi kun kender starttidspunktet.
function downloadIcs({ title, description, start, durationHours = 4 }) {
  const startDate = new Date(start);
  if (isNaN(startDate)) return;
  const endDate = new Date(startDate.getTime() + durationHours * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const escapeIcs = (s) => (s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Blessings of Valkyriegade//DA",
    "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2, 8)}@blessingsofvalkyriegade`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startDate)}`,
    `DTEND:${fmt(endDate)}`,
    `SUMMARY:${escapeIcs(title)}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeIcs(description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "session.ics";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Deaktiverer `btn` og viser `busyLabel`, mens `fn` kører — forhindrer
// dobbelt-indsendelse og giver et tegn på, at noget sker, på en langsom
// forbindelse. Gendanner altid knappen bagefter, uanset om fn fejler.
async function withBusy(btn, busyLabel, fn) {
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = busyLabel;
  try {
    await fn();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function currentSession() {
  const { data } = await window.sb.auth.getSession();
  return data.session;
}

// Kaldes øverst på beskyttede sider. Sender til login.html hvis ingen er logget ind.
async function guardPage() {
  const session = await currentSession();
  if (!session) {
    const here = encodeURIComponent(location.pathname.split("/").pop());
    location.href = `login.html?redirect=${here}`;
    return null;
  }
  return session;
}

function navSvg() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"/></svg>`;
}

async function renderNav(activeHref) {
  const mount = document.getElementById("site-nav");
  if (!mount) return;
  const session = await currentSession();
  const links = NAV_LINKS.map(
    (l) => `<a href="${l.href}" class="${l.href === activeHref ? "active" : ""}">${l.label}</a>`
  ).join("");

  let authHtml;
  if (session) {
    authHtml = `<span>Logget ind</span><button class="linklike" id="signOutBtn">Log ud</button>`;
  } else {
    authHtml = `<a href="login.html">Log ind</a>`;
  }

  const currentQ = new URLSearchParams(location.search).get("q") || "";

  mount.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html">${navSvg()}Blessings of Valkyriegade</a>
      <div class="nav-links">${links}</div>
      <form class="nav-search" id="navSearchForm">
        <input type="search" id="navSearchInput" placeholder="Søg…" aria-label="Søg i sessions og lore" value="${escapeHtml(currentQ)}">
      </form>
      <div class="nav-auth">
        <select class="theme-select" id="themeSelect" aria-label="Tema">
          <option value="auto">Auto</option>
          <option value="light">Lys</option>
          <option value="dark">Mørk</option>
          <option value="blood">Blodmåne</option>
        </select>
        ${authHtml}
      </div>
    </div>
  `;

  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await window.sb.auth.signOut();
      location.href = "login.html";
    });
  }

  const themeSelect = document.getElementById("themeSelect");
  themeSelect.value = getStoredTheme();
  themeSelect.addEventListener("change", () => {
    setStoredTheme(themeSelect.value);
    applyTheme(themeSelect.value);
  });

  document.getElementById("navSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = document.getElementById("navSearchInput").value.trim();
    if (!q) return;
    location.href = `search.html?q=${encodeURIComponent(q)}`;
  });
}

// --- Billeder: indsæt med Ctrl+V direkte i teksten, der hvor markøren står ---

// Skalerer ned til maks `maxDim` px på den lange led og genkoder som JPEG,
// så en telefonskærmbillede ikke fylder unødigt i Supabase's gratis lager.
// Er billedet allerede lille nok, sendes det uændret videre.
function compressImage(blob, maxDim = 1600, quality = 0.85) {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { width, height } = img;
      if (width <= maxDim && height <= maxDim) {
        resolve(blob);
        return;
      }
      const scale = maxDim / Math.max(width, height);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((out) => resolve(out || blob), "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(blob);
    };
    img.src = objectUrl;
  });
}

async function uploadPastedImage(blob) {
  const compressed = await compressImage(blob);
  const mime = compressed.type || blob.type || "image/png";
  const ext = (mime.split("/")[1] || "png").replace("jpeg", "jpg");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await window.sb.storage.from("photos").upload(path, compressed, { contentType: mime });
  if (error) throw error;
  return window.sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

function insertAtCursor(textareaEl, text) {
  const start = textareaEl.selectionStart ?? textareaEl.value.length;
  const end = textareaEl.selectionEnd ?? textareaEl.value.length;
  textareaEl.value = textareaEl.value.slice(0, start) + text + textareaEl.value.slice(end);
  const newPos = start + text.length;
  textareaEl.selectionStart = textareaEl.selectionEnd = newPos;
}

// Lytter efter Ctrl+V med et billede i `textareaEl`. Indsætter et
// midlertidigt "uploader..."-mærke ved markøren, uploader billedet, og
// erstatter mærket med `![billede](url)` samme sted i teksten.
function wireInlinePasteUpload(textareaEl) {
  textareaEl.addEventListener("paste", async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    const token = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const marker = `[uploader billede ${token}…]`;
    insertAtCursor(textareaEl, marker);
    try {
      const url = await uploadPastedImage(blob);
      textareaEl.value = textareaEl.value.replace(marker, `![billede](${url})`);
    } catch (err) {
      textareaEl.value = textareaEl.value.replace(marker, `[billede-upload fejlede: ${err.message}]`);
    }
  });
}

const IMAGE_MARKDOWN_RE = /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g;

// Escaper almindelig tekst, men gengiver `![billede](url)`-mærker som rigtige
// billeder, der hvor de står i teksten. Ingen href/URL ender i det synlige
// eller kopierbare indhold — klik håndteres af wireLightbox() i stedet.
function renderBodyHtml(text) {
  const parts = (text || "").split(new RegExp(`(${IMAGE_MARKDOWN_RE.source})`, "g"));
  return parts
    .map((part) => {
      const m = part.match(/^!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)$/);
      if (m) {
        const url = m[1];
        return `<img class="inline-thumb" src="${escapeHtml(url)}" alt="Vedhæftet billede" loading="lazy">`;
      }
      return escapeHtml(part);
    })
    .join("");
}

// Til korte, afkortede tekstuddrag (forsiden): fjern billedmærker helt.
function stripImageMarkdown(text) {
  return (text || "").replace(IMAGE_MARKDOWN_RE, "[billede]");
}

// Ét delt lightbox-overlay pr. side. Klik på et .inline-thumb-billede åbner
// det forstørret i stedet for at navigere til en ny fane.
function wireLightbox() {
  if (document.getElementById("lightbox")) return;
  const box = document.createElement("div");
  box.id = "lightbox";
  box.className = "lightbox";
  box.hidden = true;
  box.innerHTML = `<button type="button" class="lightbox-close" aria-label="Luk">&times;</button><img alt="Forstørret billede">`;
  document.body.appendChild(box);
  const img = box.querySelector("img");

  function close() {
    box.hidden = true;
    img.src = "";
  }
  box.addEventListener("click", close);
  box.querySelector(".lightbox-close").addEventListener("click", (e) => {
    e.stopPropagation();
    close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !box.hidden) close();
  });
  document.addEventListener("click", (e) => {
    const thumb = e.target.closest(".inline-thumb");
    if (!thumb) return;
    e.preventDefault();
    img.src = thumb.src;
    box.hidden = false;
  });
}

// --- Automatisk sammenkædning af kendte lore-titler i tekst, med preview ---

const ATTITUDE_CLASS = {
  Fjendtlig: "hostile",
  Uvenlig: "unfriendly",
  Ligegyldig: "indifferent",
  Venlig: "friendly",
  Hjælpsom: "helpful",
};
const STATUS_CLASS = {
  Levende: "alive",
  Død: "dead",
  Forsvundet: "missing",
  Ukendt: "unknown",
};

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Omslutter forekomster af kendte lore-titler i allerede-renderet HTML (fra
// renderBodyHtml) med links til den pågældende lore-indgang. Køres EFTER
// renderBodyHtml — rører aldrig <img>-tags, da deres alt-tekst altid er fast
// ("Vedhæftet billede"), ingen titel kan matche den ved et uheld.
// `excludeId` lader en lore-indgang undgå at linke til sig selv.
function linkifyLoreMentions(html, loreEntries, excludeId) {
  const candidates = (loreEntries || [])
    .filter((l) => l.id !== excludeId && l.title && l.title.trim())
    .sort((a, b) => b.title.length - a.title.length); // længste titel først, så "Ireena Kolyana" ikke bliver til "Ireena" + " Kolyana"
  if (!candidates.length) return html;

  const idByTitle = new Map();
  candidates.forEach((l) => {
    if (!idByTitle.has(l.title)) idByTitle.set(l.title, l.id);
  });

  const pattern = candidates.map((l) => escapeRegExp(l.title)).join("|");
  // Unicode-bevidste ordgrænser i stedet for \b, som ikke regner æ/ø/å for ordtegn.
  const re = new RegExp(`(?<![\\p{L}\\p{N}_])(${pattern})(?![\\p{L}\\p{N}_])`, "gu");

  return html.replace(re, (match) => {
    const id = idByTitle.get(match);
    if (id === undefined) return match;
    return `<a href="lore.html?id=${id}" class="lore-mention" data-lore-id="${id}">${match}</a>`;
  });
}

const LORE_PREVIEW_DATA = new Map();

// Kaldes med alle lore-indgange, siden allerede har hentet, så preview-boksen
// aldrig behøver sit eget kald til Supabase.
function setLorePreviewData(entries) {
  LORE_PREVIEW_DATA.clear();
  (entries || []).forEach((l) => LORE_PREVIEW_DATA.set(l.id, l));
}

// Ét delt preview-popover pr. side, ligesom lightboxen. Hover (eller
// tastatur-fokus) over et .lore-mention-link viser kategori, holdning/status
// og et uddrag — uden at forlade siden. Rører aldrig touch-enheder, da
// mouseover/mouseout ikke udløses af et tryk; der navigerer linket bare normalt.
function wireLoreMentionPreviews() {
  if (document.getElementById("lorePreview")) return;
  const box = document.createElement("div");
  box.id = "lorePreview";
  box.className = "lore-preview";
  box.hidden = true;
  document.body.appendChild(box);

  let hideTimer = null;

  function show(link) {
    clearTimeout(hideTimer);
    const entry = LORE_PREVIEW_DATA.get(link.dataset.loreId);
    if (!entry) return;
    const attitudeBadge =
      entry.category === "NPC" && entry.relationship
        ? `<span class="attitude ${ATTITUDE_CLASS[entry.relationship] || ""}">${escapeHtml(entry.relationship)}</span>`
        : "";
    const statusBadge =
      entry.category === "NPC" && entry.status
        ? `<span class="status-badge ${STATUS_CLASS[entry.status] || ""}">${escapeHtml(entry.status)}</span>`
        : "";
    const excerpt = stripImageMarkdown(entry.body || "").slice(0, 140);
    box.innerHTML = `
      <span class="badge">${escapeHtml(entry.category)}</span>${attitudeBadge}${statusBadge}
      <h4>${escapeHtml(entry.title)}</h4>
      ${excerpt ? `<p>${escapeHtml(excerpt)}${excerpt.length >= 140 ? "…" : ""}</p>` : ""}`;
    const rect = link.getBoundingClientRect();
    box.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 300))}px`;
    box.style.top = `${rect.bottom + window.scrollY + 8}px`;
    box.hidden = false;
  }

  function scheduleHide() {
    hideTimer = setTimeout(() => {
      box.hidden = true;
    }, 150);
  }

  document.addEventListener("mouseover", (e) => {
    const link = e.target.closest(".lore-mention");
    if (link) show(link);
  });
  document.addEventListener("mouseout", (e) => {
    if (e.target.closest(".lore-mention")) scheduleHide();
  });
  document.addEventListener("focusin", (e) => {
    const link = e.target.closest(".lore-mention");
    if (link) show(link);
  });
  document.addEventListener("focusout", (e) => {
    if (e.target.closest(".lore-mention")) scheduleHide();
  });
  box.addEventListener("mouseover", () => clearTimeout(hideTimer));
  box.addEventListener("mouseout", scheduleHide);
}
