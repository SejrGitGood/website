// Fælles hjælpefunktioner til alle sider. Kræver at config.js og
// supabase-js (CDN) er indlæst FØR denne fil.
window.sb = supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

const NAV_LINKS = [
  { href: "index.html", label: "Forside" },
  { href: "sessions.html", label: "Sessioner" },
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

// --- Billeder: indsæt med Ctrl+V direkte i et tekstfelt ---

async function uploadPastedImage(blob) {
  const ext = (blob.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await window.sb.storage.from("photos").upload(path, blob, { contentType: blob.type });
  if (error) throw error;
  return window.sb.storage.from("photos").getPublicUrl(path).data.publicUrl;
}

function galleryStaticHtml(urls) {
  return (urls || [])
    .map(
      (u) => `<a href="${u}" target="_blank" rel="noopener" class="thumb"><img src="${u}" alt="Vedhæftet billede" loading="lazy"></a>`
    )
    .join("");
}

function galleryHtml(urls) {
  return (urls || [])
    .map(
      (u) => `
    <span class="thumb">
      <a href="${u}" target="_blank" rel="noopener"><img src="${u}" alt="Vedhæftet billede" loading="lazy"></a>
      <button type="button" class="thumb-remove" data-url="${u}" aria-label="Fjern billede">&times;</button>
    </span>`
    )
    .join("");
}

// Lytter efter Ctrl+V med et billede i `textareaEl`, uploader det, tilføjer
// URL'en til `urls` (en almindelig array, muteres direkte), og tegner en
// thumbnail i `galleryEl`. Kald `wireGalleryRemove` én gang pr. galleryEl.
function wirePasteUpload(textareaEl, galleryEl, urls) {
  textareaEl.addEventListener("paste", async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((it) => it.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const blob = imageItem.getAsFile();
    const placeholder = document.createElement("span");
    placeholder.className = "thumb-uploading";
    placeholder.textContent = "Uploader billede…";
    galleryEl.appendChild(placeholder);
    try {
      const url = await uploadPastedImage(blob);
      urls.push(url);
      placeholder.remove();
      galleryEl.insertAdjacentHTML(
        "beforeend",
        `<span class="thumb">
          <a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Vedhæftet billede" loading="lazy"></a>
          <button type="button" class="thumb-remove" data-url="${url}" aria-label="Fjern billede">&times;</button>
        </span>`
      );
    } catch (err) {
      placeholder.textContent = "Upload fejlede: " + err.message;
    }
  });
}

function wireGalleryRemove(galleryEl, urls) {
  galleryEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".thumb-remove");
    if (!btn) return;
    const idx = urls.indexOf(btn.dataset.url);
    if (idx > -1) urls.splice(idx, 1);
    btn.closest(".thumb").remove();
  });
}
