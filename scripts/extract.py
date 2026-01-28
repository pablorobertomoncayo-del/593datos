import json
import os
from datetime import datetime
from pathlib import Path

import requests

# --- Fuentes ---
BCE_SRC = "https://contenido.bce.fin.ec/documentos/informacioneconomica/indicadores/general/datos_formulario.json"
FRED_URL = "https://api.stlouisfed.org/fred/series/observations"

# --- Output ---
OUT = Path("public/datos_latest.json")


# -----------------------------
# Helpers
# -----------------------------
def parse_date(s: str) -> datetime:
  return datetime.strptime(s.strip(), "%Y-%m-%d")


def normalize_text(s: str) -> str:
  s = (s or "").strip().lower()
  # normaliza acentos y el caso raro "paÃ­s"
  s = (s.replace("á", "a").replace("í", "i")
         .replace("ã", "a").replace("â", "a")
         .replace("Ã", "a").replace("Â", "a"))
  return s


def to_number_bce(v):
  """
  Convierte valores del BCE:
  - "462" -> 462
  - "4.611,05" -> 4611.05
  - "4,80" -> 4.8
  """
  try:
    s = str(v).strip()
    if "," in s:
      # Formato europeo: miles '.' y decimales ','
      s = s.replace(".", "").replace(",", ".")
      num = float(s)
      return int(num) if num.is_integer() else num

    num = float(s)
    return int(num) if num.is_integer() else num
  except Exception:
    return None


def find_records(obj):
  """
  Busca recursivamente una lista de dicts que tenga llaves Indicador/Fecha/Valor.
  El JSON del BCE a veces viene anidado.
  """
  if isinstance(obj, list):
    if obj and isinstance(obj[0], dict):
      keys = set(obj[0].keys())
      if {"Indicador", "Fecha", "Valor"}.issubset(keys):
        return obj
    for item in obj:
      found = find_records(item)
      if found:
        return found

  if isinstance(obj, dict):
    for v in obj.values():
      found = find_records(v)
      if found:
        return found

  return None


def extract_last_days(records, indicator_match_fn, measure_match_fn=None, limit=5):
  """
  Extrae últimos N días (ordenado por Fecha) de un indicador del BCE.
  """
  serie = []

  for item in records:
    if not isinstance(item, dict):
      continue

    indicador = item.get("Indicador", "")
    if not indicator_match_fn(indicador):
      continue

    if measure_match_fn is not None:
      medida = (item.get("Medida") or "").strip()
      if not measure_match_fn(medida):
        continue

    fecha = item.get("Fecha")
    valor_raw = item.get("Valor")

    if not fecha or valor_raw is None:
      continue

    try:
      dt = parse_date(fecha)
    except Exception:
      continue

    valor = to_number_bce(valor_raw)
    if valor is None:
      continue

    serie.append((dt, valor))

  serie.sort(key=lambda x: x[0])

  if not serie:
    raise RuntimeError("No encontré datos para el indicador (filtro demasiado estricto o cambió el nombre).")

  last = serie[-limit:]
  latest_dt, latest_val = last[-1]

  return {
    "latest": {
      "valor": latest_val,
      "fecha_iso": latest_dt.strftime("%Y-%m-%d"),
      "fecha_display": latest_dt.strftime("%d / %m / %Y"),
    },
    "series_5d": [
      {
        "fecha_iso": dt.strftime("%Y-%m-%d"),
        "fecha_display": dt.strftime("%d / %m / %Y"),
        "valor": val
      }
      for (dt, val) in last
    ]
  }


# -----------------------------
# FRED - WTI latest
# -----------------------------
def latest_wti_fred():
  api_key = os.getenv("FRED_API_KEY")
  if not api_key:
    return None

  params = {
    "series_id": "DCOILWTICO",
    "api_key": api_key,
    "file_type": "json",
    "sort_order": "desc",
    "limit": 1
  }

  r = requests.get(FRED_URL, params=params, timeout=20)
  r.raise_for_status()
  observations = r.json().get("observations", [])
  if not observations:
    return None

  obs = observations[0]
  if obs.get("value") in (None, "", "."):
    return None

  dt = datetime.strptime(obs["date"], "%Y-%m-%d")
  return {
    "valor": float(obs["value"]),
    "fecha_iso": dt.strftime("%Y-%m-%d"),
    "fecha_display": dt.strftime("%d / %m / %Y"),
    "unit": "USD/barril",
    "source": "FRED: DCOILWTICO"
  }


# -----------------------------
# Main
# -----------------------------
def main():
  # 1) Descargar BCE
  r = requests.get(BCE_SRC, timeout=30)
  r.raise_for_status()
  data = r.json()

  records = find_records(data)
  if records is None:
    raise RuntimeError("No pude encontrar la lista de registros dentro del JSON del BCE.")

  # 2) Riesgo País (acepta variaciones por encoding)
  riesgo_pais = extract_last_days(
    records,
    indicator_match_fn=lambda s: normalize_text(s) in ["riesgo pais", "riesgo paã­s", "riesgo paÃ­s"],
    limit=5
  )

  # 3) Oro (filtra por medida exacta)
  oro = extract_last_days(
    records,
    indicator_match_fn=lambda s: normalize_text(s) == "precio del oro",
    measure_match_fn=lambda m: m == "USD / Onza Troy",
    limit=5
  )

  # 4) Petróleo (WTI latest desde FRED)
  wti_latest = latest_wti_fred()

  payload = {
    "riesgo_pais": riesgo_pais,
    "oro": oro,
    "source_bce": BCE_SRC,
    "generated_at_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
  }

  # Solo incluir petróleo si existe (si no hay API key, no rompe)
  if wti_latest:
    payload["petroleo"] = {"latest": wti_latest}

  OUT.parent.mkdir(parents=True, exist_ok=True)
  OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

  print("✅ OK ->", OUT.as_posix())
  print("Riesgo País latest:", payload["riesgo_pais"]["latest"])
  print("Oro latest:", payload["oro"]["latest"])
  if "petroleo" in payload:
    print("WTI latest:", payload["petroleo"]["latest"])
  else:
    print("WTI latest: (no incluido - falta FRED_API_KEY)")


if __name__ == "__main__":
  main()
