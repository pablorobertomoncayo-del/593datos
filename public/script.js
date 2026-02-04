async function loadData() {
  const res = await fetch("./data.json", { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudo cargar data.json");
  return await res.json();
}

/* =======================
   Helpers
======================= */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatDateDMY(isoDate) {
  if (!isoDate) return "-- / -- / ----";
  const d = new Date(isoDate + "T00:00:00");
  return `${pad2(d.getDate())} / ${pad2(d.getMonth() + 1)} / ${d.getFullYear()}`;
}

function formatMonthYear(isoDate) {
  if (!isoDate) return "--/----";
  const d = new Date(isoDate + "T00:00:00");
  return `${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatShortDayMonthES(isoDate) {
  if (!isoDate) return "--";
  const d = new Date(isoDate + "T00:00:00");
  const day = d.getDate();
  const mon = d
    .toLocaleString("es-EC", { month: "short" })
    .replace(".", "");
  return `${day} ${mon}.`;
}

function formatPrice(num, digits = 2) {
  if (num === null || num === undefined || isNaN(num)) return "--";
  return Number(num).toLocaleString("es-EC", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatPercent(num) {
  if (num === null || num === undefined || isNaN(num)) return "--";
  return `${Number(num).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

function byFechaAsc(a, b) {
  return new Date(a.fecha) - new Date(b.fecha);
}

function last5Sorted(arr) {
  if (!Array.isArray(arr)) return [];
  return [...arr].sort(byFechaAsc).slice(-5);
}

function lastItemSorted(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return [...arr].sort(byFechaAsc).pop();
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* =======================
   Render lista genérica
======================= */

function renderList(id, items, valueFormatter) {
  const ul = document.getElementById(id);
  if (!ul) return;

  ul.innerHTML = "";

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "mini-item";

    li.innerHTML = `
      ${formatShortDayMonthES(item.fecha)} <span class="v">${valueFormatter(item)}</span>
    `;

    ul.appendChild(li);
  });
}

/* =======================
   Init
======================= */

(async function init() {
  try {
    const data = await loadData();

    /* ========= WTI ========= */
    setText("wti-fecha", formatDateDMY(data?.manual?.wti?.fecha));
    setText(
      "wti-precio",
      formatPrice(data?.manual?.wti?.precio_usd_barril)
    );

    /* ========= Gasolina ========= */
    setText(
      "gas-fecha",
      `${formatDateDMY(
        data?.manual?.gasolina_super?.fecha
      )} - por galón`
    );

    setText(
      "gas-super",
      formatPrice(data?.manual?.gasolina_super?.precio_usd_galon)
    );
    setText(
      "gas-extra",
      formatPrice(data?.manual?.gasolina_extra?.precio_usd_galon)
    );
    setText(
      "gas-diesel",
      formatPrice(data?.manual?.gasolina_diesel?.precio_usd_galon)
    );

    /* ========= BCE ========= */
    const riesgo5 = last5Sorted(data?.bce?.riesgo_pais_last5);
    const oro5 = last5Sorted(data?.bce?.oro_last5);
    const inflacion5 = last5Sorted(data?.bce?.inflacion_last5);

    const riesgoLast = lastItemSorted(riesgo5);
    const oroLast = lastItemSorted(oro5);
    const inflacionLast = lastItemSorted(inflacion5);

    /* Riesgo país */
    setText("riesgo-fecha", formatDateDMY(riesgoLast?.fecha));
    setText(
      "riesgo-valor",
      riesgoLast ? Math.round(riesgoLast.valor) : "--"
    );

    renderList("riesgo-list", riesgo5, (it) =>
      Math.round(Number(it.valor))
    );

    /* Oro */
    setText("oro-fecha", formatDateDMY(oroLast?.fecha));
    setText(
      "oro-valor",
      oroLast ? formatPrice(oroLast.valor) : "--"
    );

    renderList("oro-list", oro5, (it) =>
      formatPrice(it.valor)
    );

    /* Inflación */
    setText(
      "inf-fecha",
      formatMonthYear(inflacionLast?.fecha)
    );
    setText(
      "inf-valor",
      inflacionLast ? formatPercent(inflacionLast.mensual) : "--"
    );

    renderList("inf-list", inflacion5, (it) =>
      formatPercent(it.mensual)
    );

  } catch (err) {
    console.error(err);
    alert(
      "Error cargando el dashboard. Verifica que data.json esté junto al index.html"
    );
  }
})();

(function instagramRandomColor() {
  const ig = document.querySelector(".footer a");
  if (!ig) return;

  const colors = [
    "var(--wti)",
    "var(--gas)",
    "var(--riesgo)",
    "var(--oro)",
    "var(--inf)"
  ];

  ig.addEventListener("mouseenter", () => {
    const random = colors[Math.floor(Math.random() * colors.length)];
    ig.style.color = random;
  });

  ig.addEventListener("mouseleave", () => {
    ig.style.color = "#ffffff";
  });
})();
