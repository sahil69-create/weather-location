const displayId = document.getElementById("displayId");
const statusContainer = document.getElementById("statusContainer");
const latVal = document.getElementById("latVal");
const lngVal = document.getElementById("lngVal");
const timeVal = document.getElementById("timeVal");
const followBtn = document.getElementById("followBtn");

const BASE = (window.baseURL || "").replace(/\/+$/, "") || "";
const params = new URLSearchParams(location.search);
const targetId = (typeof window.targetId !== "undefined" && window.targetId) || params.get("id") || "demo-target";

displayId.textContent = targetId;

const injected = typeof window.initialCoords !== "undefined" ? window.initialCoords : null;
const existing = typeof initialCoords !== "undefined" ? initialCoords : null;
let latLng = injected || existing || [20.5937, 78.9629];
let followMarker = true;

const customIcon = L.divIcon({
  className: "custom-marker",
  html: `
    <div class="pulse-ring"></div>
    <div class="marker-pin">
      <div class="marker-pin-inner"></div>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 36],
});

const map = L.map("map", {
  zoomControl: false,
  worldCopyJump: true,
}).setView(latLng, 15);

L.control.zoom({ position: "bottomright" }).addTo(map);

const googleStreets = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
  {
    maxZoom: 22,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Maps",
  }
).addTo(map);

const googleSat = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  {
    maxZoom: 22,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
    attribution: "&copy; Google Satellite",
  }
);

L.control
  .layers(
    { "Streets View": googleStreets, "Satellite View": googleSat },
    {},
    { position: "topright", collapsed: window.innerWidth < 640 }
  )
  .addTo(map);

const marker = L.marker(latLng, { icon: customIcon }).addTo(map);
const accuracyCircle = L.circle(latLng, {
  color: "rgba(59, 130, 246, 0.6)",
  fillColor: "rgba(59, 130, 246, 0.1)",
  fillOpacity: 0.3,
  radius: 20,
  weight: 1,
}).addTo(map);

updateCoords(latLng[0], latLng[1]);

map.on("dragstart", () => {
  if (followMarker) toggleFollow();
});

function toggleFollow() {
  followMarker = !followMarker;
  const icon = followBtn.querySelector("i");
  if (followMarker) {
    followBtn.classList.add("bg-blue-500/20", "text-blue-400");
    followBtn.classList.remove("text-white");
    icon.classList.remove("fa-location-slash");
    icon.classList.add("fa-location-crosshairs");
    map.panTo(marker.getLatLng(), { animate: true, duration: 0.8 });
  } else {
    followBtn.classList.remove("bg-blue-500/20", "text-blue-400");
    followBtn.classList.add("text-white");
    icon.classList.remove("fa-location-crosshairs");
    icon.classList.add("fa-location-slash");
  }
}

function updateCoords(lat, lng) {
  latVal.textContent = parseFloat(lat).toFixed(5);
  lngVal.textContent = parseFloat(lng).toFixed(5);
  const now = new Date();
  timeVal.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const socket = io(BASE || undefined, {
  path: "/socket.io",
  transports: ["websocket", "polling"],
  reconnection: true,
});

socket.on("connect", () => {
  console.log("[Map] Socket connected");
});

let updateTimeout = null;

socket.on("map-data", (data) => {
  if (data.id !== targetId) return;

  statusContainer.classList.add("status-updating");
  clearTimeout(updateTimeout);

  const newPos = [data.lat, data.lng];
  marker.setLatLng(newPos);
  accuracyCircle.setLatLng(newPos);
  updateCoords(data.lat, data.lng);

  if (followMarker) {
    map.panTo(newPos, { animate: true, duration: 1.0 });
  }

  updateTimeout = setTimeout(() => {
    statusContainer.classList.remove("status-updating");
  }, 1500);
});
