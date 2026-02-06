/* global lucide */

const PATH_DATA = "./data.json";
const PATH_BANANO = "./banano.json";

// Formatos (ajustados para parecerse a la maqueta del PDF)
const fmtEU = (n, decimals = 2) =>
  new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

const fmtUS = (n, decimals = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);

const fmtPercentUS = (n, decimals = 2) =>
  `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n)}%`;

// Helpers
function $(id) {
  return document.getElementById(id);
}

function safeLast(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[arr.length - 1];
}

function parseCommaDecimal(str) {
  // "10,20" -> 10.20
  if (typeof str === "number") return str;
  if (typeof str !== "string") return NaN;
  const normalized = str.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

function renderList(containerEl, items, valueColorKey, mapValueText) {
  containerEl.innerHTML = "";
  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "row";

    const d = document.createElement("div");
    d.className = "row-date";
    d.textContent = it.fecha ?? "—";

    const v = document.createElement("div");
    v.className = "row-val";
    v.setAttribute("data-color", valueColorKey);
    v.textContent = mapValueText(it);

    row.appendChild(d);
    row.appendChild(v);
    containerEl.appendChild(row);
  });
}

function randomThemeColor() {
  // colores variables (los mismos del CSS)
  const colors = [
    "var(--petroleo)",
    "var(--gasolina)",
    "var(--reservas)",
    "var(--riesgo)",
    "var(--oro)",
    "var(--inflacion)",
    "var(--banano)",
    "var(--cacao)",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

async function load() {
  const [dataRes, banRes] = await Promise.all([fetch(PATH_DATA), fetch(PATH_BANANO)]);
  if (!dataRes.ok) throw new Error(`No pude leer ${PATH_DATA}`);
  if (!banRes.ok) throw new Error(`No pude leer ${PATH_BANANO}`);

  const data = await dataRes.json();
  const banano = await banRes.json();

  // ========== TOP ROW ==========
  // WTI (data.manual.wti.precio_usd_barril)
  $("wti-fecha").textContent = data?.manual?.wti?.fecha ?? "—";
  const wti = data?.manual?.wti?.precio_usd_barril;
  $("wti-valor").textContent = Number.isFinite(wti) ? `$${fmtEU(wti, 2)}` : "—";

  // Gasolina (fecha tomada de super)
  $("gas-fecha").textContent = data?.manual?.gasolina_super?.fecha ?? "—";
  const gSup = data?.manual?.gasolina_super?.precio_usd_galon;
  const gExt = data?.manual?.gasolina_extra?.precio_usd_galon;
  const gDie = data?.manual?.gasolina_diesel?.precio_usd_galon;
  $("gas-super").textContent = Number.isFinite(gSup) ? `$${fmtEU(gSup, 2)}` : "—";
  $("gas-extra").textContent = Number.isFinite(gExt) ? `$${fmtEU(gExt, 2)}` : "—";
  $("gas-diesel").textContent = Number.isFinite(gDie) ? `$${fmtEU(gDie, 2)}` : "—";

  // Reservas (data.manual.reservas.valorR)
  $("res-fecha").textContent = data?.manual?.reservas?.fecha ?? "—";
  const res = data?.manual?.reservas?.valorR;
  $("res-valor").textContent = Number.isFinite(res) ? fmtEU(res, 0) : "—";

  // ========== BOTTOM ROW ==========
  // Riesgo país (bce.riesgo_pais_last5)
  const riesgoArr = data?.bce?.riesgo_pais_last5 ?? [];
  const riesgoLast = safeLast(riesgoArr);
  $("riesgo-fecha-last").textContent = riesgoLast?.fecha ?? "—";
  $("riesgo-valor-last").textContent =
    Number.isFinite(riesgoLast?.valor) ? `${fmtUS(riesgoLast.valor, 0)}` : "—";

  renderList($("riesgo-list"), riesgoArr, "riesgo", (it) =>
    Number.isFinite(it?.valor) ? `${fmtUS(it.valor, 0)}` : "—"
  );

  // Oro (bce.oro_last5)
  const oroArr = data?.bce?.oro_last5 ?? [];
  const oroLast = safeLast(oroArr);
  $("oro-fecha-last").textContent = oroLast?.fecha ?? "—";
  $("oro-valor-last").textContent =
    Number.isFinite(oroLast?.valor) ? `$${fmtEU(oroLast.valor, 2)}` : "—";

  renderList($("oro-list"), oroArr, "oro", (it) =>
    Number.isFinite(it?.valor) ? `$${fmtEU(it.valor, 2)}` : "—"
  );

  // Inflación (bce.inflacion_last5): usamos "mensual"
  const inflArr = data?.bce?.inflacion_last5 ?? [];
  const inflLast = safeLast(inflArr);
  $("infl-fecha-last").textContent = inflLast?.fecha ?? "—";
  $("infl-valor-last").textContent =
    Number.isFinite(inflLast?.mensual) ? fmtPercentUS(inflLast.mensual, 2) : "—";

  renderList($("infl-list"), inflArr, "inflacion", (it) =>
    Number.isFinite(it?.mensual) ? fmtPercentUS(it.mensual, 2) : "—"
  );

  // Banano (banano.json)
  $("ban-fecha").textContent = banano?.fecha ?? "—";
  const banPrice = parseCommaDecimal(banano?.precio);
  $("ban-valor").textContent = Number.isFinite(banPrice) ? `$${fmtEU(banPrice, 2)}` : "—";

  // Cacao (data.manual.cacao.valorC)
  $("cacao-fecha").textContent = data?.manual?.cacao?.fecha ?? "—";
  const cacao = data?.manual?.cacao?.valorC;
  // En el PDF se ve con miles y decimales tipo US ($4,154.00), lo replico así.
  $("cacao-valor").textContent = Number.isFinite(cacao) ? `$${fmtUS(cacao, 2)}` : "—";

  // Iconos
  if (window.lucide?.createIcons) lucide.createIcons();

  // Hover instagram: random color (sin escala)
  const ig = document.querySelector(".ig");
  if (ig) {
    ig.addEventListener("mouseenter", () => {
      ig.style.color = randomThemeColor();
    });
    ig.addEventListener("mouseleave", () => {
      ig.style.color = "var(--white)";
    });
  }
}

load().catch((err) => {
  console.error(err);
  // fallback visual mínimo
  const title = document.querySelector(".app-title");
  if (title) title.textContent = "593Datos / Dashboard (Error cargando JSON)";
});

function fitDashboard() {
  const app = document.querySelector(".app");
  if (!app) return;

  const baseW = 1885;
  const baseH = 823;

  const scale = Math.min(window.innerWidth / baseW, window.innerHeight / baseH);

  app.style.transform = `scale(${Math.min(scale, 1)})`; // nunca agrandar > 1
}

window.addEventListener("resize", fitDashboard);
window.addEventListener("load", fitDashboard);
