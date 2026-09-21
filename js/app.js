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
      <a class="brand" href="index.html">${navSvg()}Daggerford-Krøniken</a>
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
