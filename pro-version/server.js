const cookieParser = require("cookie-parser");
const socketIO = require("socket.io");
const config = require("./config");
const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);

const io = new socketIO.Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"],
  allowEIO3: true
});

const PORT = process.env.PORT || config.port;

global.remoteURL = null;
global.IO = io;
global.targets = {};
global.targetLastSeen = {};

app.use(cookieParser());
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10mb" }));

const webDir = path.resolve(__dirname, "..", "web");
if (fs.existsSync(webDir)) {
  app.use(express.static(webDir, { index: false, maxAge: "1h" }));
  console.log(`[Static] Serving frontend from: ${webDir}`);
}

const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use("/", require("./router"));

function cleanupInactiveTargets() {
  const now = Date.now();
  const timeout = config.tracking.targetTimeoutMs;
  for (const id in global.targetLastSeen) {
    if (now - global.targetLastSeen[id] > timeout) {
      delete global.targets[id];
      delete global.targetLastSeen[id];
      io.emit("target-disconnected", id);
    }
  }
}

setInterval(cleanupInactiveTargets, 60 * 1000);

server.listen(PORT, () => {
  const host = `0.0.0.0:${PORT}`;
  console.log(`═══════════════════════════════════════════`);
  console.log(`  🚀 SkyAdmin Live Tracker v2.0`);
  console.log(`═══════════════════════════════════════════`);
  console.log(`  Local   : http://localhost:${PORT}`);
  console.log(`  Login   : http://localhost:${PORT}/login`);
  console.log(`  Tracker : http://localhost:${PORT}/tracker.html`);
  console.log(`  Socket  : Ready (WS + Polling)`);
  console.log(`  Env     : ${config.env}`);
  console.log(`═══════════════════════════════════════════`);
});
