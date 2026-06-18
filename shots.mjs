import puppeteer from "puppeteer-core";
import fs from "node:fs";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.env.URL || "http://localhost:8099/";
const OUT = "/tmp/glintvex_shots";
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"],
});

const logs = [];
const errors = [];

async function newPage(w, h, dpr = 2) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
  page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("requestfailed", (r) => errors.push(`REQFAIL: ${r.url()} ${r.failure()?.errorText}`));
  return page;
}

const viewports = [
  { name: "desktop", w: 1440, h: 900 },
  { name: "laptop", w: 1280, h: 800 },
  { name: "tablet", w: 820, h: 1100 },
  { name: "mobile", w: 390, h: 844 },
];

// Full-page + above-the-fold per viewport
for (const v of viewports) {
  const page = await newPage(v.w, v.h);
  await page.goto(URL, { waitUntil: "networkidle0", timeout: 30000 });
  await sleep(900);
  await page.screenshot({ path: `${OUT}/${v.name}-fold.png` });
  // scroll through to trigger reveals
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        y += window.innerHeight * 0.8;
        window.scrollTo(0, y);
        if (y < document.body.scrollHeight) setTimeout(step, 120);
        else res();
      };
      step();
    });
  });
  await sleep(700);
  await page.screenshot({ path: `${OUT}/${v.name}-full.png`, fullPage: true });
  await page.close();
}

// Interactivity tests on desktop
const page = await newPage(1440, 900);
await page.goto(URL, { waitUntil: "networkidle0" });
await sleep(800);

const results = {};

// 1. dashboard tab switching changes chart path AND all KPIs/total
const before = await page.evaluate(() => ({
  path: document.querySelector(".spark-line").getAttribute("d"),
  rev: document.querySelector("#kpi-revenue").textContent.trim(),
  tx: document.querySelector("#kpi-tx").textContent.trim(),
  cust: document.querySelector("#kpi-customers").textContent.trim(),
  total: document.querySelector("#chart-total").textContent.trim(),
}));
await page.click('.dash-tab[data-range="This Month"]');
await sleep(1500);
const after = await page.evaluate(() => ({
  path: document.querySelector(".spark-line").getAttribute("d"),
  rev: document.querySelector("#kpi-revenue").textContent.trim(),
  tx: document.querySelector("#kpi-tx").textContent.trim(),
  cust: document.querySelector("#kpi-customers").textContent.trim(),
  total: document.querySelector("#chart-total").textContent.trim(),
  pressed: document.querySelector('.dash-tab[data-range="This Month"]').getAttribute("aria-pressed"),
}));
results.chartTabSwitch = before.path !== after.path ? "PASS (path changed)" : "FAIL";
results.kpisChanged = (before.rev !== after.rev && before.tx !== after.tx && before.cust !== after.cust && before.total !== after.total) ? "PASS (all KPIs+total changed)" : `FAIL ${JSON.stringify({ before, after })}`;
results.ariaPressed = after.pressed === "true" ? "PASS" : "FAIL";
results.monthValues = `rev=${after.rev} tx=${after.tx} cust=${after.cust} total=${after.total}`;
const activeTab = await page.$eval(".dash-tab.is-active", (el) => el.textContent.trim());
results.activeTab = activeTab;
await page.screenshot({ path: `${OUT}/interact-tab-month.png` });

// 2. count-up produced non-zero KPI
const kpi = await page.$eval(".kpi-value", (el) => el.textContent.trim());
results.kpiValue = kpi;
const statNum = await page.$eval(".stat-num", (el) => el.textContent.trim());
results.firstStat = statNum;

// 3. contact form validation
await page.type("#contact-form input", "not-an-email");
await page.click("#contact-form button[type=submit]");
await sleep(300);
results.invalidEmailHint = await page.$eval("#form-hint", (el) => el.textContent.trim());
await page.$eval("#contact-form input", (el) => (el.value = ""));
await page.type("#contact-form input", "founder@acme.com");
await page.click("#contact-form button[type=submit]");
await sleep(300);
results.validEmailHint = await page.$eval("#form-hint", (el) => el.textContent.trim());

// 4. footer clock populated
results.clock = await page.$eval("#clock", (el) => el.textContent.trim());

// 5. mobile menu toggle (switch to mobile)
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await sleep(300);
await page.click(".menu-toggle");
await sleep(400);
results.mobileMenuOpen = await page.$eval(".mobile-nav", (el) => el.classList.contains("open"));
await page.screenshot({ path: `${OUT}/interact-mobile-menu.png` });

// 6. hover state on capability card (desktop)
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(URL, { waitUntil: "networkidle0" });
await page.evaluate(() => document.querySelector("#capabilities").scrollIntoView());
await sleep(500);
await page.hover(".cap-card");
await sleep(300);
await page.screenshot({ path: `${OUT}/interact-cap-hover.png` });

await page.close();
await browser.close();

console.log("=== INTERACTIVITY RESULTS ===");
console.log(JSON.stringify(results, null, 2));
console.log("\n=== CONSOLE LOGS ===");
console.log(logs.length ? logs.join("\n") : "(none)");
console.log("\n=== ERRORS ===");
console.log(errors.length ? errors.join("\n") : "(none)");
