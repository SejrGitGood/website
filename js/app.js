// Fælles hjælpefunktioner til alle sider. Kræver at config.js og
// supabase-js (CDN) er indlæst FØR denne fil.
window.sb = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

const NAV_LINKS = [
  { href: "index.html", label: "Forside" },
  { href: "sessions.html", label: "Sessions" },
  { href: "lore.html", label: "Lore" },
  { href: "logistics.html", label: "Logistik" },
];

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

  mount.innerHTML = `
    <div class="wrap">
      <a class="brand" href="index.html">${navSvg()}Blessings of Valkyriegade</a>
      <div class="nav-links">${links}</div>
      <div class="nav-auth">${authHtml}</div>
    </div>
  `;

  const signOutBtn = document.getElementById("signOutBtn");
  if (signOutBtn) {
    signOutBtn.addEventListener("click", async () => {
      await window.sb.auth.signOut();
      location.href = "login.html";
    });
  }
}

// --- Billeder: indsæt med Ctrl+V direkte i teksten, der hvor markøren står ---

async function uploadPastedImage(blob) {
  const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await window.sb.storage.from("photos").upload(path, blob, { contentType: blob.type });
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
