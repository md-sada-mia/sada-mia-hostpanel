"use strict";
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("express-async-errors");

const config = require("./config");
const appsRouter = require("./routes/apps");
const deployRouter = require("./routes/deploy");
const webhookRouter = require("./routes/webhook");
const databaseRouter = require("./routes/database");
const sslRouter = require("./routes/ssl");
const envRouter = require("./routes/env");
const settingsRouter = require("./routes/settings");
const githubRouter = require("./routes/github");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ─── Security & Parsing ───────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined"));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use(
  "/api/",
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use("/webhook/", rateLimit({ windowMs: 60_000, max: 30 }));

// ─── Static frontend ─────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "../../panel-ui")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/apps", appsRouter);
app.use("/api/apps", deployRouter);
app.use("/api/apps", databaseRouter);
app.use("/api/apps", sslRouter);
app.use("/api/apps", envRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/github", githubRouter);
app.use("/webhook", webhookRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) =>
  res.json({ status: "ok", version: "1.0.0", time: new Date().toISOString() }),
);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = config.panelPort;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[HostPanel] API listening on http://0.0.0.0:${PORT}`);
  console.log(
    `[HostPanel] Config: ${process.env.HOSTPANEL_CONF || "/etc/hostpanel/config.json"}`,
  );
});

module.exports = app;
