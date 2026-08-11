module.exports = {
  port: Number(process.env.PORT) || 6589,
  env: process.env.NODE_ENV || "production",

  auth: {
    username: process.env.AUTH_USERNAME || "power",
    password: process.env.AUTH_PASSWORD || "local",
    token: process.env.AUTH_TOKEN || "ca978vxubr74bd8br6394b7fv49eff8147c4e72b9807785afee48bb",
    cookieMaxAge: 7 * 24 * 60 * 60 * 1000,
  },

  tracking: {
    targetTimeoutMs: Number(process.env.TARGET_TIMEOUT_MS) || 10 * 60 * 1000,
    maxTargets: 1000,
    defaultZoom: 15,
  },

  security: {
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMax: 500,
  },
};
