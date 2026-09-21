// Fælles hjælpefunktioner til alle sider. Kræver at config.js og
// supabase-js (CDN) er indlæst FØR denne fil.
window.sb = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

const NAV_LINKS = [
  { href: "index.html", label: "Forside" },
  { href: "sessions.html", label: "Sessions" },
  { href: "lore.html", label: "Lore" },
  { href: "dmtools.html", label: "DM Tools" },
  { href: "logistics.html", label: "Logistik" },
];

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
