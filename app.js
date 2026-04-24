"use strict";

const WEEKS_PER_YEAR = 52;

const state = {
  baseAmount: 20,
  baseType: "hourly",
  hoursPerWeek: 40,
  otHours: 0,
  otMultiplier: 1.5,
  unitsSold: 25,
  perUnit: 50,
  totalRevenue: 0,
  revenuePct: 0,
  salesInputPeriod: "monthly",
  salesPeriod: "monthly",
  addOns: [{ id: uid(), name: "Protection plan", qty: 5, payout: 25 }],
  tiers: [
    { id: uid(), threshold: 10, bonus: 100 },
    { id: uid(), threshold: 25, bonus: 300 },
  ],
  spiffs: [],
  showTaxes: false,
  baseTaxPct: 22,
  commTaxPct: 22,
};

function uid() { return Math.random().toString(36).slice(2, 9); }
function fmt(n) { return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }); }
function num(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }

function annualizeBase() {
  const amt = state.baseAmount;
  switch (state.baseType) {
    case "hourly": {
      const regular = amt * state.hoursPerWeek * WEEKS_PER_YEAR;
      const overtime = amt * state.otMultiplier * state.otHours * WEEKS_PER_YEAR;
      return regular + overtime;
    }
    case "weekly": return amt * WEEKS_PER_YEAR;
    case "biweekly": return amt * 26;
    case "monthly": return amt * 12;
    case "annual": return amt;
  }
  return 0;
}
function periodScaleFactor(from, to) {
  const map = { hourly: 1 / (WEEKS_PER_YEAR * 40), weekly: 1 / WEEKS_PER_YEAR, biweekly: 1 / 26, monthly: 1 / 12, annual: 1 };
  return map[to] / map[from];
}

// ---------- Bind simple inputs (allow blank → 0 in state, but don't force "0" back) ----------
function bindNum(id, key) {
  const el = document.getElementById(id);
  el.addEventListener("input", () => { state[key] = num(el.value); render(); });
  el.addEventListener("focus", () => { if (el.value === "0") el.value = ""; });
  el.addEventListener("blur", () => { if (el.value === "") { el.value = "0"; state[key] = 0; } });
}
function bindSel(id, key, numeric) {
  const el = document.getElementById(id);
  el.addEventListener("change", () => { state[key] = numeric ? num(el.value) : el.value; render(); });
}

bindNum("baseAmount", "baseAmount");
bindSel("baseType", "baseType");
bindNum("hoursPerWeek", "hoursPerWeek");
bindNum("otHours", "otHours");
bindSel("otMultiplier", "otMultiplier", true);
bindNum("unitsSold", "unitsSold");
bindNum("perUnit", "perUnit");
bindNum("totalRevenue", "totalRevenue");
bindNum("revenuePct", "revenuePct");
bindSel("salesInputPeriod", "salesInputPeriod");
bindSel("salesPeriod", "salesPeriod");
bindNum("baseTaxPct", "baseTaxPct");
bindNum("commTaxPct", "commTaxPct");

document.getElementById("toggleTaxes").addEventListener("click", () => {
  state.showTaxes = !state.showTaxes;
  render();
});

// ---------- Add buttons ----------
document.querySelectorAll("[data-add]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const t = btn.dataset.add;
    if (t === "addon") state.addOns.push({ id: uid(), name: "", qty: 0, payout: 0 });
    if (t === "tier") state.tiers.push({ id: uid(), threshold: 0, bonus: 0 });
    if (t === "spiff") state.spiffs.push({ id: uid(), name: "", amount: 0 });
    render();
  });
});

// ---------- Helpers for row inputs that can be blanked ----------
function attachClearableNumber(inp, obj, field) {
  inp.addEventListener("input", () => {
    obj[field] = num(inp.value);
    compute();
  });
  inp.addEventListener("focus", () => { if (inp.value === "0") inp.value = ""; });
  inp.addEventListener("blur", () => { if (inp.value === "") { inp.value = "0"; obj[field] = 0; } });
}

// ---------- Row renderers ----------
function renderAddOns() {
  const list = document.getElementById("addOnsList");
  list.innerHTML = "";
  if (!state.addOns.length) {
    list.innerHTML = '<p class="muted small">No add-ons yet.</p>';
    return;
  }
  state.addOns.forEach((a) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="col-name"><label>Name</label><input type="text" data-f="name" value="${escapeAttr(a.name)}" placeholder="e.g. Warranty" /></div>
      <div class="col-num"><label>Qty sold</label><input type="number" min="0" data-f="qty" value="${a.qty}" /></div>
      <div class="col-num"><label>$ per sale</label><input type="number" min="0" data-f="payout" value="${a.payout}" /></div>
      <div class="col-del"><button class="btn btn-icon" data-del aria-label="Delete">🗑</button></div>`;
    row.querySelectorAll("[data-f]").forEach((inp) => {
      const f = inp.dataset.f;
      if (f === "name") {
        inp.addEventListener("input", () => { a.name = inp.value; compute(); });
      } else {
        attachClearableNumber(inp, a, f);
      }
    });
    row.querySelector("[data-del]").addEventListener("click", () => {
      state.addOns = state.addOns.filter((x) => x.id !== a.id);
      render();
    });
    list.appendChild(row);
  });
}

function renderTiers() {
  const list = document.getElementById("tiersList");
  list.innerHTML = "";
  state.tiers.forEach((t) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="col-num" style="grid-column:span 5"><label>At units sold ≥</label><input type="number" min="0" data-f="threshold" value="${t.threshold}" /></div>
      <div class="col-num" style="grid-column:span 5"><label>Bonus ($)</label><input type="number" min="0" data-f="bonus" value="${t.bonus}" /></div>
      <div class="col-del" style="grid-column:span 2"><button class="btn btn-icon" data-del aria-label="Delete">🗑</button></div>`;
    row.querySelectorAll("[data-f]").forEach((inp) => attachClearableNumber(inp, t, inp.dataset.f));
    row.querySelector("[data-del]").addEventListener("click", () => {
      state.tiers = state.tiers.filter((x) => x.id !== t.id); render();
    });
    list.appendChild(row);
  });
}

function renderSpiffs() {
  const list = document.getElementById("spiffsList");
  list.innerHTML = "";
  if (!state.spiffs.length) {
    list.innerHTML = '<p class="muted small">No spiffs added.</p>';
    return;
  }
  state.spiffs.forEach((s) => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="col-name" style="grid-column:span 7"><label>Description</label><input type="text" data-f="name" value="${escapeAttr(s.name)}" placeholder="e.g. Contest winner" /></div>
      <div class="col-num" style="grid-column:span 4"><label>Amount ($)</label><input type="number" min="0" data-f="amount" value="${s.amount}" /></div>
      <div class="col-del" style="grid-column:span 1"><button class="btn btn-icon" data-del aria-label="Delete">🗑</button></div>`;
    row.querySelectorAll("[data-f]").forEach((inp) => {
      const f = inp.dataset.f;
      if (f === "name") {
        inp.addEventListener("input", () => { s.name = inp.value; compute(); });
      } else {
        attachClearableNumber(inp, s, f);
      }
    });
    row.querySelector("[data-del]").addEventListener("click", () => {
      state.spiffs = state.spiffs.filter((x) => x.id !== s.id); render();
    });
    list.appendChild(row);
  });
}

function escapeAttr(s) { return String(s).replace(/"/g, "&quot;"); }

// ---------- Compute & paint outputs ----------
function compute() {
  // Show/hide hourly-only fields
  const isHourly = state.baseType === "hourly";
  document.getElementById("hoursRow").style.display = isHourly ? "" : "none";
  document.getElementById("otRow").style.display = isHourly ? "" : "none";
  document.getElementById("otMultRow").style.display = isHourly ? "" : "none";

  const annualBase = annualizeBase();
  const unitCommissionTotal = state.unitsSold * state.perUnit;
  const revenueCommissionTotal = state.totalRevenue * (state.revenuePct / 100);
  const addOnTotal = state.addOns.reduce((s, a) => s + a.qty * a.payout, 0);
  const sortedTiers = [...state.tiers].sort((a, b) => a.threshold - b.threshold);
  let tieredBonusTotal = 0;
  for (const t of sortedTiers) if (state.unitsSold >= t.threshold) tieredBonusTotal = t.bonus;
  const spiffTotal = state.spiffs.reduce((s, x) => s + x.amount, 0);

  const scale = periodScaleFactor(state.salesInputPeriod, state.salesPeriod);
  const unitCommissionScaled = unitCommissionTotal * scale;
  const revenueCommissionScaled = revenueCommissionTotal * scale;
  const addOnScaled = addOnTotal * scale;
  const tieredBonusScaled = tieredBonusTotal * scale;
  const spiffScaled = spiffTotal * scale;

  let basePerPeriod = 0;
  switch (state.salesPeriod) {
    case "hourly": basePerPeriod = annualBase / (WEEKS_PER_YEAR * (state.hoursPerWeek || 40)); break;
    case "weekly": basePerPeriod = annualBase / WEEKS_PER_YEAR; break;
    case "biweekly": basePerPeriod = annualBase / 26; break;
    case "monthly": basePerPeriod = annualBase / 12; break;
    case "annual": basePerPeriod = annualBase; break;
  }

  const items = [
    { label: "Base pay", value: basePerPeriod },
    { label: "Per-unit commission", value: unitCommissionScaled },
    { label: "Revenue %", value: revenueCommissionScaled },
    { label: "Add-ons", value: addOnScaled },
    { label: "Tiered bonus", value: tieredBonusScaled },
    { label: "Spiffs", value: spiffScaled },
  ].filter((i) => i.value > 0);
  const totalForPeriod = items.reduce((s, i) => s + i.value, 0);

  // Paint inline outputs
  document.querySelectorAll('[data-out="unitCommissionScaled"]').forEach(e => e.textContent = fmt(unitCommissionScaled));
  document.querySelectorAll('[data-out="revenueCommissionScaled"]').forEach(e => e.textContent = fmt(revenueCommissionScaled));
  document.querySelectorAll('[data-out="addOnScaled"]').forEach(e => e.textContent = fmt(addOnScaled));
  document.querySelectorAll('[data-out="tieredBonusScaled"]').forEach(e => e.textContent = fmt(tieredBonusScaled));
  document.querySelectorAll('[data-out="spiffScaled"]').forEach(e => e.textContent = fmt(spiffScaled));
  document.querySelectorAll('[data-out="totalForPeriod"]').forEach(e => e.textContent = fmt(totalForPeriod));

  // Period text bindings
  document.querySelectorAll('[data-bind="salesPeriod"]').forEach(e => e.textContent = state.salesPeriod);
  document.querySelectorAll('[data-bind="salesInputPeriod"]').forEach(e => e.textContent = state.salesInputPeriod);

  // Breakdown
  const breakdown = document.getElementById("breakdown");
  document.getElementById("totalDivider").hidden = items.length === 0;
  if (items.length === 0) {
    breakdown.innerHTML = '<p class="muted" style="color:rgba(255,255,255,.7)">Enter values above to watch your money grow. 🌱</p>';
  } else {
    breakdown.innerHTML = items.map(i => `<div class="row-out"><span>${i.label}</span><strong>${fmt(i.value)}</strong></div>`).join("");
  }

  // Taxes
  const taxesPanel = document.getElementById("taxesPanel");
  taxesPanel.hidden = items.length === 0;
  const toggleBtn = document.getElementById("toggleTaxes");
  toggleBtn.textContent = state.showTaxes ? "On" : "Off";
  toggleBtn.className = state.showTaxes ? "btn btn-gold" : "btn btn-ghost-light";
  document.getElementById("taxesBody").hidden = !state.showTaxes;

  if (state.showTaxes && items.length > 0) {
    const baseAmt = basePerPeriod;
    const commAmt = totalForPeriod - baseAmt;
    const baseTax = baseAmt * (state.baseTaxPct / 100);
    const commTax = commAmt * (state.commTaxPct / 100);
    const totalTax = baseTax + commTax;
    const takeHome = totalForPeriod - totalTax;
    document.getElementById("baseTaxRow").hidden = !(baseAmt > 0);
    document.getElementById("commTaxRow").hidden = !(commAmt > 0);
    const tb = document.getElementById("taxBreakdown");
    let html = "";
    if (baseAmt > 0) html += `<div class="row-out"><span>Base tax</span><strong>- ${fmt(baseTax)}</strong></div>`;
    if (commAmt > 0) html += `<div class="row-out"><span>Commission tax</span><strong>- ${fmt(commTax)}</strong></div>`;
    html += `<div class="row-out"><span>Total tax</span><strong>- ${fmt(totalTax)}</strong></div>`;
    tb.innerHTML = html;
    document.querySelectorAll('[data-out="takeHome"]').forEach(e => e.textContent = fmt(takeHome));
  }
}

function render() {
  renderAddOns();
  renderTiers();
  renderSpiffs();
  compute();
}

render();
