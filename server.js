/* Glintvex backend rails: static hosting + lead/subscribe/booking API.
   Zero external dependencies (Node built-ins only). Data persists to ./data/*.json.
   Optional email: set SMTP via env + install nodemailer; otherwise notifications
   are appended to data/outbox.log so nothing is silently lost. */
"use strict";

const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

// Load .env (KEY=VALUE lines) without a dependency, so SMTP/MAIL settings are picked up.
(function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(__dirname, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const i = t.indexOf("=");
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {/* no .env file: rely on real environment variables */}
})();

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PORT = process.env.PORT || 8099;
const HOST = process.env.HOST || "127.0.0.1";

// Bookable configuration
const ALLOWED_SLOTS = ["10:00", "11:00", "12:00", "14:00", "15:00", "16:00"]; // GST
const TIMEZONE_LABEL = "GST";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
};

/* ----------------------------- data store ----------------------------- */
// Serialize all writes through a single promise chain to avoid lost updates.
// enqueue() isolates failures so one rejected write can never poison the chain.
let writeChain = Promise.resolve();
function enqueue(task) {
  const run = writeChain.then(task, task); // run after prior settles, regardless of outcome
  writeChain = run.then(() => {}, () => {}); // swallow so the chain never stays rejected
  return run; // caller still sees this task's result/error
}

async function ensureData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
}

async function readJSON(file, fallback) {
  try {
    const raw = await fsp.readFile(path.join(DATA_DIR, file), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function appendJSON(file, record) {
  return enqueue(async () => {
    const list = await readJSON(file, []);
    list.push(record);
    await fsp.writeFile(path.join(DATA_DIR, file), JSON.stringify(list, null, 2));
  });
}

async function logOutbox(line) {
  try {
    await fsp.appendFile(path.join(DATA_DIR, "outbox.log"), line + "\n");
  } catch {/* best effort */}
}

/* ----------------------------- email (optional) ----------------------------- */
// Build a nodemailer transport from either a single SMTP_URL or discrete fields
// (SMTP_HOST/PORT/SECURE/USER/PASS). Discrete fields avoid URL-encoding pitfalls
// with passwords/usernames that contain "@", spaces, or other special characters.
function buildTransport(nodemailer) {
  if (process.env.SMTP_URL) return nodemailer.createTransport(process.env.SMTP_URL);
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 465);
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== "false" : port === 465,
      auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || "").replace(/\s+/g, "") },
    });
  }
  return null;
}
function emailConfigured() { return !!(process.env.SMTP_URL || process.env.SMTP_HOST); }

// opts: { to, ics }  — ics, when present, is attached as a calendar invite.
async function notify(subject, body, opts = {}) {
  const recipient = opts.to || process.env.MAIL_TO || "hello@glintvex.com";
  if (emailConfigured()) {
    try {
      // Lazy require so the server still boots if the dependency is missing.
      const nodemailer = require("nodemailer");
      const transport = buildTransport(nodemailer);
      const mail = {
        from: process.env.MAIL_FROM || "no-reply@glintvex.com",
        to: recipient,
        subject,
        text: body,
      };
      if (opts.ics) {
        // invite:true -> set icalEvent so it renders as a calendar card (auto-adds for the booker).
        // invite:false -> attach the .ics as a regular file so the email stays a normal, readable message.
        if (opts.invite) mail.icalEvent = { method: "REQUEST", content: opts.ics };
        mail.attachments = [{ filename: "glintvex-demo.ics", content: opts.ics, contentType: "text/calendar; method=REQUEST; charset=utf-8" }];
      }
      await transport.sendMail(mail);
      return "sent";
    } catch (e) {
      await logOutbox(`[${new Date().toISOString()}] EMAIL FAILED to ${recipient} (${e.message}) :: ${subject} :: ${body.replace(/\n/g, " | ")}`);
      return "queued";
    }
  }
  await logOutbox(`[${new Date().toISOString()}] to=${recipient}${opts.ics ? " (+invite.ics)" : ""} :: ${subject} :: ${body.replace(/\n/g, " | ")}`);
  return "logged";
}

// Build an RFC-5545 iCalendar VEVENT for a booking. Times are GST (UTC+4); emitted as UTC.
function buildIcs({ ref, name, email, date, time }) {
  const p = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s).replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
  const [Y, M, D] = date.split("-").map(Number);
  const [h, m] = time.split(":").map(Number);
  const startUTC = new Date(Date.UTC(Y, M - 1, D, h - 4, m, 0)); // GST -> UTC
  const endUTC = new Date(startUTC.getTime() + 30 * 60000);
  const fmt = (d) => `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00Z`;
  // Organizer = the Glintvex inbox, so the event lands on the studio's own calendar;
  // the client is invited as an attendee, so it lands on theirs too.
  const organizer = process.env.MAIL_TO || process.env.MAIL_FROM || "hello@glintvex.com";
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Glintvex//Demo Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${ref}@glintvex`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(startUTC)}`,
    `DTEND:${fmt(endUTC)}`,
    `SUMMARY:${esc("Glintvex demo (" + ref + ")")}`,
    `DESCRIPTION:${esc("30-minute product demo with the Glintvex team. Confirmation ref " + ref + ".")}`,
    `ORGANIZER;CN=Glintvex:mailto:${organizer}`,
    `ATTENDEE;CN=Glintvex;ROLE=CHAIR;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${organizer}`,
    `ATTENDEE;CN=${esc(name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/* ----------------------------- helpers ----------------------------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmail(v) { return typeof v === "string" && EMAIL_RE.test(v.trim()); }
// trim, strip control chars (prevents log/line injection), and cap length
function clean(v, max = 500) {
  if (typeof v !== "string") return "";
  // strip ASCII control chars (prevents log/line injection), then trim + cap
  return v.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, max);
}

// "Today" pinned to Gulf Standard Time (UTC+4, no DST) so client and server agree.
function gstTodayISO() {
  const g = new Date(Date.now() + 4 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${g.getUTCFullYear()}-${p(g.getUTCMonth() + 1)}-${p(g.getUTCDate())}`;
}

function isValidFutureWeekday(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + "T00:00:00Z");
  if (isNaN(d.getTime())) return false;
  const day = d.getUTCDay(); // weekday of the calendar date (tz-independent)
  if (day === 0 || day === 6) return false;
  // must be a future day (earliest = next business day), and within a 90-day horizon
  const today = gstTodayISO();
  if (dateStr <= today) return false;
  const maxDate = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  return dateStr <= maxDate;
}

function makeRef() {
  return "GVX-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) { reject(new Error("payload too large")); req.destroy(); return; }
      data += chunk;
    });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}

/* ----------------------------- API handlers ----------------------------- */
async function handleSubscribe(req, res) {
  const body = await readBody(req);
  const email = clean(body.email, 120);
  if (!isEmail(email)) return sendJSON(res, 400, { ok: false, error: "Please provide a valid email." });
  await appendJSON("subscribers.json", { email, at: new Date().toISOString(), ip: req.socket.remoteAddress });
  await notify("New whitepaper subscriber", `Email: ${email}`);
  return sendJSON(res, 200, { ok: true, message: "Subscribed. Welcome aboard." });
}

async function handleLead(req, res) {
  const body = await readBody(req);
  const email = clean(body.email, 120);
  const message = clean(body.message, 2000);
  if (!isEmail(email)) return sendJSON(res, 400, { ok: false, error: "Please provide a valid email." });
  await appendJSON("leads.json", { email, message, at: new Date().toISOString(), ip: req.socket.remoteAddress });
  await notify("New project enquiry", `Email: ${email}\nMessage: ${message || "(none)"}`);
  return sendJSON(res, 200, { ok: true, message: "Thanks, we'll be in touch within one business day." });
}

async function handleAvailability(req, res, url) {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const bookings = await readJSON("bookings.json", []);
  const booked = bookings
    .filter((b) => (!from || b.date >= from) && (!to || b.date <= to))
    .map((b) => `${b.date}|${b.time}`);
  return sendJSON(res, 200, { ok: true, slots: ALLOWED_SLOTS, timezone: TIMEZONE_LABEL, booked });
}

async function handleBook(req, res) {
  const body = await readBody(req);
  const name = clean(body.name, 120);
  const email = clean(body.email, 120);
  const date = clean(body.date, 10);
  const time = clean(body.time, 5);
  const notes = clean(body.notes, 1000);

  if (!name) return sendJSON(res, 400, { ok: false, error: "Please enter your name." });
  if (!isEmail(email)) return sendJSON(res, 400, { ok: false, error: "Please enter a valid email." });
  if (!isValidFutureWeekday(date)) return sendJSON(res, 400, { ok: false, error: "Pick a valid future weekday." });
  if (!ALLOWED_SLOTS.includes(time)) return sendJSON(res, 400, { ok: false, error: "Pick a valid time slot." });

  // Reserve atomically through the write chain to prevent double-booking.
  let result;
  await (writeChain = writeChain.then(async () => {
    const bookings = await readJSON("bookings.json", []);
    if (bookings.some((b) => b.date === date && b.time === time)) {
      result = { ok: false, status: 409, error: "That slot was just taken. Please choose another." };
      return;
    }
    const ref = makeRef();
    const record = { ref, name, email, date, time, notes, at: new Date().toISOString() };
    bookings.push(record);
    await fsp.writeFile(path.join(DATA_DIR, "bookings.json"), JSON.stringify(bookings, null, 2));
    result = { ok: true, ref, date, time };
  }));

  if (!result.ok) return sendJSON(res, result.status || 400, { ok: false, error: result.error });
  const ics = buildIcs({ ref: result.ref, name, email, date: result.date, time: result.time });
  // 1. single readable notification email to the studio inbox, with the .ics attached
  //    so you can add it to your calendar from the attachment (no duplicate invite email)
  await notify(
    `New demo booking: ${name} (${result.date} ${result.time} ${TIMEZONE_LABEL})`,
    `New demo booking.\n\nName: ${name}\nEmail: ${email}\nWhen: ${result.date} at ${result.time} ${TIMEZONE_LABEL}\nRef: ${result.ref}\nNotes: ${notes || "(none)"}\n\nThe calendar invite is attached — open it to add the meeting to your calendar.`,
    { to: process.env.MAIL_TO, ics, invite: false }
  );
  // 2. calendar invite + confirmation to the booker
  await notify(
    `Your Glintvex demo is booked (${result.ref})`,
    `Hi ${name},\n\nYou're booked in for a 30-minute demo on ${result.date} at ${result.time} ${TIMEZONE_LABEL}.\nConfirmation ref: ${result.ref}\n\nThe calendar invite is attached. We'll send a join link before the call.\n\nGlintvex`,
    { to: email, ics, invite: true }
  );
  return sendJSON(res, 200, { ok: true, ref: result.ref, date: result.date, time: result.time, timezone: TIMEZONE_LABEL, message: "Booking confirmed." });
}

/* ----------------------------- static files ----------------------------- */
async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/" || rel === "") rel = "/index.html";
  // resolve and guard against path traversal
  const filePath = path.normalize(path.join(ROOT, rel));
  if (!filePath.startsWith(ROOT)) { sendJSON(res, 403, { ok: false, error: "forbidden" }); return; }
  // never serve the data dir, server source, dotfiles (.env), or the outbox log
  const base = path.basename(filePath);
  if (filePath.startsWith(DATA_DIR) || base === "server.js" || base.startsWith(".") || base.endsWith(".log")) {
    sendJSON(res, 403, { ok: false, error: "forbidden" }); return;
  }
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) return serveStatic(req, res, path.join(rel, "index.html"));
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Content-Length": stat.size });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>404 Not Found</h1>");
  }
}

/* ----------------------------- router ----------------------------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || HOST}`);
  const { pathname } = url;

  try {
    if (pathname.startsWith("/api/")) {
      if (req.method === "POST" && pathname === "/api/subscribe") return await handleSubscribe(req, res);
      if (req.method === "POST" && pathname === "/api/lead") return await handleLead(req, res);
      if (req.method === "POST" && pathname === "/api/book") return await handleBook(req, res);
      if (req.method === "GET" && pathname === "/api/availability") return await handleAvailability(req, res, url);
      return sendJSON(res, 404, { ok: false, error: "Unknown endpoint." });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      return sendJSON(res, 405, { ok: false, error: "Method not allowed." });
    }
    return await serveStatic(req, res, pathname);
  } catch (err) {
    const msg = err && err.message === "invalid JSON" ? "Invalid request body." : "Something went wrong.";
    return sendJSON(res, err.message === "invalid JSON" ? 400 : 500, { ok: false, error: msg });
  }
});

// Only start the server when run directly; allows importing helpers in tests.
if (require.main === module) {
  ensureData().then(() => {
    server.listen(PORT, HOST, () => {
      console.log(`Glintvex server running at http://${HOST}:${PORT}`);
      console.log(`Static root: ${ROOT}`);
      console.log(`Data dir:    ${DATA_DIR}`);
      console.log(`Notifications inbox (MAIL_TO): ${process.env.MAIL_TO || "hello@glintvex.com (default)"}`);
      console.log(emailConfigured() ? "Email: SMTP configured, sending live (with .ics invites)" : "Email: SMTP not set, notifications logged to data/outbox.log");
    });
  });
}

module.exports = { buildIcs, isValidFutureWeekday, clean, isEmail, gstTodayISO, buildTransport, emailConfigured };
