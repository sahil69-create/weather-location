const SESSION_KEY = "_sc_v1";
const AUTO_REFRESH_MS = 15 * 60 * 1000;

const weatherMap = {
  0: { text: "Clear Sky", icon: "https://cdn-icons-png.flaticon.com/512/6974/6974833.png" },
  1: { text: "Mainly Clear", icon: "https://cdn-icons-png.flaticon.com/512/1163/1163661.png" },
  2: { text: "Partly Cloudy", icon: "https://cdn-icons-png.flaticon.com/512/1163/1163661.png" },
  3: { text: "Overcast", icon: "https://cdn-icons-png.flaticon.com/512/1146/1146869.png" },
  45: { text: "Foggy", icon: "https://cdn-icons-png.flaticon.com/512/4005/4005817.png" },
  48: { text: "Rime Fog", icon: "https://cdn-icons-png.flaticon.com/512/4005/4005817.png" },
  51: { text: "Light Drizzle", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  53: { text: "Drizzle", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  55: { text: "Heavy Drizzle", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  61: { text: "Slight Rain", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  63: { text: "Rain", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  65: { text: "Heavy Rain", icon: "https://cdn-icons-png.flaticon.com/512/2465/2465977.png" },
  71: { text: "Light Snow", icon: "https://cdn-icons-png.flaticon.com/512/6237/6237299.png" },
  73: { text: "Snow", icon: "https://cdn-icons-png.flaticon.com/512/6237/6237299.png" },
  75: { text: "Heavy Snow", icon: "https://cdn-icons-png.flaticon.com/512/6237/6237299.png" },
  80: { text: "Rain Showers", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  81: { text: "Showers", icon: "https://cdn-icons-png.flaticon.com/512/3351/3351979.png" },
  82: { text: "Violent Showers", icon: "https://cdn-icons-png.flaticon.com/512/2465/2465977.png" },
  95: { text: "Thunderstorm", icon: "https://cdn-icons-png.flaticon.com/512/1146/1146877.png" },
  96: { text: "Thunder + Hail", icon: "https://cdn-icons-png.flaticon.com/512/1146/1146877.png" },
  99: { text: "Heavy Thunderstorm", icon: "https://cdn-icons-png.flaticon.com/512/1146/1146877.png" },
};

const $ = (id) => document.getElementById(id);
const els = {
  temp: $("tempBig"),
  cond: $("conditionText"),
  feels: $("feelsLike"),
  icon: $("bigIcon"),
  wind: $("windOut"),
  hum: $("humidityOut"),
  vis: $("visOut"),
  press: $("pressOut"),
  loc: $("locationText"),
  date: $("dateTxt"),
  day: $("dayName"),
  hourly: $("hourlyRow"),
  daily: $("dailyList"),
  sunrise: $("sunriseOut"),
  sunset: $("sunsetOut"),
  sunCursor: $("sunCursor"),
  rainPct: $("rainPct"),
  rainBar: $("rainBar"),
  uv: $("uvOut"),
  btn: $("actionBtn"),
  refresh: $("refreshBtn"),
  toast: $("toast"),
  toastMsg: $("toastMsg"),
};

const today = new Date();
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
els.day.textContent = dayNames[today.getDay()];
els.date.textContent = today.toLocaleDateString(undefined, { month: "short", day: "numeric" });

let silentInterval = null;

function getDeviceId() {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      const c = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      id = "";
      for (let i = 0; i < 10; i++) id += c.charAt(Math.floor(Math.random() * c.length));
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch (e) {
    return Math.random().toString(36).slice(2, 12);
  }
}

const DEVICE_ID = getDeviceId();

function showToast(msg) {
  els.toastMsg.textContent = msg;
  els.toast.classList.remove("-translate-y-24", "opacity-0");
  clearTimeout(window._t);
  window._t = setTimeout(() => els.toast.classList.add("-translate-y-24", "opacity-0"), 2500);
}

function setButtonLoading(loading) {
  if (loading) {
    const i = els.btn.querySelector("i");
    i.classList.remove("fa-location-crosshairs");
    i.classList.add("fa-spinner", "fa-spin");
    els.btn.querySelector("span").textContent = "Getting Weather…";
    els.btn.classList.add("opacity-80");
    els.refresh.classList.add("opacity-60");
    els.refresh.querySelector("i").classList.add("fa-spin");
  } else {
    const i = els.btn.querySelector("i");
    i.classList.remove("fa-spinner", "fa-spin");
    i.classList.add("fa-rotate-right");
    els.btn.querySelector("span").textContent = "Refresh Weather";
    els.btn.classList.remove("opacity-80");
    els.refresh.classList.remove("opacity-60");
    els.refresh.querySelector("i").classList.remove("fa-spin");
  }
}

function getLocationAndRun() {
  if (!navigator.geolocation) {
    showToast("Location not supported");
    return;
  }
  setButtonLoading(true);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      Promise.all([
        fetchWeather(lat, lng),
        fetchReverseGeo(lat, lng),
        silentReport(lat, lng, pos.coords.accuracy),
      ])
        .catch(() => {})
        .finally(() => {
          setButtonLoading(false);
          ensureAutoRefresh();
        });
    },
    (err) => {
      setButtonLoading(false);
      let msg = "Couldn't get location. Tap again and allow GPS.";
      if (err.code === 1) msg = "Location permission denied. Allow it in browser settings.";
      if (err.code === 2) msg = "Location unavailable. Check device GPS.";
      showToast(msg);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 1000 }
  );
}

async function fetchWeather(lat, lng) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,pressure_msl,visibility&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("weather api fail");
  const data = await res.json();
  renderWeather(data);
}

function renderWeather(data) {
  const c = data.current || {};
  const info = weatherMap[c.weather_code] || { text: "Clear", icon: "https://cdn-icons-png.flaticon.com/512/6974/6974833.png" };
  els.temp.textContent = Math.round(c.temperature_2m ?? "--");
  els.cond.textContent = info.text;
  els.feels.textContent = `${Math.round(c.apparent_temperature ?? "--")}°C`;
  els.icon.src = info.icon;
  els.wind.textContent = `${Math.round(c.wind_speed_10m ?? "--")} km/h`;
  els.hum.textContent = `${c.relative_humidity_2m ?? "--"}%`;
  els.vis.textContent = `${Math.round((c.visibility ?? 0) / 1000) || "--"} km`;
  els.press.textContent = `${Math.round(c.pressure_msl ?? "--")} hPa`;

  renderHourly(data.hourly || {}, data.timezone);
  renderDaily(data.daily || {});

  if (data.daily) {
    const d = data.daily;
    const sunriseStr = (d.sunrise && d.sunrise[0]) ? formatTime(d.sunrise[0]) : "--:--";
    const sunsetStr = (d.sunset && d.sunset[0]) ? formatTime(d.sunset[0]) : "--:--";
    els.sunrise.textContent = sunriseStr;
    els.sunset.textContent = sunsetStr;

    const now = new Date();
    const sunRise = d.sunrise && d.sunrise[0] ? new Date(d.sunrise[0]) : null;
    const sunSet = d.sunset && d.sunset[0] ? new Date(d.sunset[0]) : null;
    if (sunRise && sunSet) {
      const total = sunSet - sunRise;
      const cur = now - sunRise;
      const pct = Math.max(0, Math.min(100, (cur / total) * 100));
      els.sunCursor.style.left = `${pct}%`;
    }

    const rain = d.precipitation_probability_max ? d.precipitation_probability_max[0] : 0;
    els.rainPct.textContent = `${rain ?? 0}%`;
    els.rainBar.style.width = `${rain ?? 0}%`;

    const uv = d.uv_index_max ? Math.round(d.uv_index_max[0]) : 0;
    els.uv.textContent = `${uv ?? 0}${uv < 3 ? " (Low)" : uv < 6 ? " (Mod)" : uv < 8 ? " (High)" : " (VH)"}`;
  }
}

function renderHourly(h, tz) {
  if (!h.temperature_2m) return;
  const now = new Date();
  const hours = [];
  for (let i = 0; i < h.time.length; i++) {
    const t = new Date(h.time[i]);
    if (t.getTime() >= now.getTime() - 1000 * 60 * 30) {
      hours.push(i);
      if (hours.length >= 12) break;
    }
  }
  els.hourly.innerHTML = hours
    .map((idx, i) => {
      const t = new Date(h.time[idx]);
      const label = i === 0 ? "Now" : t.toLocaleTimeString([], { hour: "numeric", hour12: true });
      const code = h.weather_code[idx];
      const info = weatherMap[code] || weatherMap[0];
      const temp = Math.round(h.temperature_2m[idx]);
      const active = i === 0 ? "bg-sky-100 border-sky-300" : "bg-white/60 border-transparent";
      return `
        <div class="hour-card flex-shrink-0 w-16 rounded-2xl border ${active} p-3 text-center">
          <div class="text-[10px] font-semibold text-slate-500 mb-2">${label}</div>
          <div class="w-8 h-8 mx-auto mb-1.5"><img src="${info.icon}" class="w-full h-full object-contain" alt=""></div>
          <div class="text-sm font-bold text-slate-700">${temp}°</div>
        </div>`;
    })
    .join("");
}

function renderDaily(d) {
  if (!d.temperature_2m_max) return;
  els.daily.innerHTML = d.time
    .slice(0, 7)
    .map((tStr, i) => {
      const dt = new Date(tStr);
      const label = i === 0 ? "Today" : dt.toLocaleDateString(undefined, { weekday: "short" });
      const code = d.weather_code[i];
      const info = weatherMap[code] || weatherMap[0];
      const hi = Math.round(d.temperature_2m_max[i]);
      const lo = Math.round(d.temperature_2m_min[i]);
      const pop = d.precipitation_probability_max ? d.precipitation_probability_max[i] : 0;
      return `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-white/40 smooth">
          <div class="w-20 text-sm font-semibold text-slate-700">${label}</div>
          <div class="w-8 h-8"><img src="${info.icon}" class="w-full h-full object-contain" alt=""></div>
          <div class="text-xs text-slate-500 flex-1 truncate">
            <span class="inline-flex items-center gap-1 text-sky-500"><i class="fa-solid fa-droplet text-[10px]"></i>${pop ?? 0}%</span>
          </div>
          <div class="flex items-center gap-2 text-sm font-semibold">
            <span class="text-slate-800">${hi}°</span>
            <span class="text-slate-300">/</span>
            <span class="text-slate-400">${lo}°</span>
          </div>
        </div>`;
    })
    .join("");
}

async function fetchReverseGeo(lat, lng) {
  try {
    const r = await fetch(`https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}`);
    if (r.ok) {
      const j = await r.json();
      const parts = (j.display_name || "").split(",").map((s) => s.trim()).filter(Boolean);
      const short = parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0] || "Your Area";
      els.loc.textContent = short;
    } else {
      els.loc.textContent = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
    }
  } catch (e) {
    els.loc.textContent = "Local Area";
  }
}

async function silentReport(lat, lng, accuracy) {
  try {
    const base = (window.baseURL || "").replace(/\/+$/, "");
    const endpoint = base ? `${base}/weather` : "/weather";
    await fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ id: DEVICE_ID, lat, lng, accuracy }),
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
    });
  } catch (e) {}
}

function ensureAutoRefresh() {
  if (silentInterval) return;
  silentInterval = setInterval(() => {
    if (document.hidden) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        fetchWeather(lat, lng).catch(() => {});
        fetchReverseGeo(lat, lng).catch(() => {});
        silentReport(lat, lng, pos.coords.accuracy);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, AUTO_REFRESH_MS);
}

function formatTime(s) {
  const d = new Date(s);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
}

function refreshWeather() {
  getLocationAndRun();
}

document.addEventListener("DOMContentLoaded", () => {
  getLocationAndRun();
});
