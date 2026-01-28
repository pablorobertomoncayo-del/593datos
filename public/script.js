
lucide.createIcons();

const dateEl = document.getElementById("date");
const riesgoEl = document.getElementById("riesgo-value");
const oroEl = document.getElementById("oro-value");

function formatNumber(value, decimals = 0) {
    return Number(value).toLocaleString("es-EC", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
}

function easeOutQuint(x) {
    return 1 - Math.pow(1 - x, 5);
}

function animateNumber({ to, el, duration = 1400, decimals = 0 }) {
    if (!el || !Number.isFinite(Number(to))) {
        if (el) el.textContent = "0";
        return;
    }

    const start = performance.now();
    const from = 0;

    function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const eased = easeOutQuint(p);
        const current = from + (to - from) * eased;
        const shown = decimals === 0 ? Math.round(current) : current;

        el.textContent = formatNumber(shown, decimals);

        if (p < 1) requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
}

fetch("datos_latest.json?v=" + Date.now(), { cache: "no-store" })

    .then(res => res.json())
    .then(data => {
        const riesgo = data?.riesgo_pais?.latest;
        const oro = data?.oro?.latest;
        const petroleo = data?.petroleo?.latest;

        if (riesgo) {
            animateNumber({ to: riesgo.valor, el: riesgoEl, decimals: 0 });
            dateEl.textContent = riesgo.fecha_display;
        }

        if (oro) {
            animateNumber({ to: oro.valor, el: oroEl, decimals: 2 });
        }

        if (petroleo && petroleo.valor) {
            const petroleoEl = document.getElementById("petroleoValue");
            petroleoEl.textContent = petroleo.valor.toLocaleString("es-EC", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }

        if (petroleo) {
            animateNumber({
                el: document.getElementById("petroleoValue"),
                to: petroleo.valor,
                decimals: 2
            });
        }

    })
    .catch(err => {
        console.error("Error leyendo datos_latest.json:", err);
    });
