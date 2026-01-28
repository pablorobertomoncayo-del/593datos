import json
from datetime import datetime
from pathlib import Path
import requests

SRC = "https://contenido.bce.fin.ec/documentos/informacioneconomica/indicadores/general/datos_formulario.json"
OUT = Path("./public/datos_latest.json")


# ---------- Helpers ----------
def parse_date(s: str) -> datetime:
  return datetime.strptime(s.strip(), "%Y-%m-%d")


def normalize_text(s: str) -> str:
  # normaliza acentos + casos raros tipo "paÃ­s"
  s = (s or "").strip().lower()
  s = (s.replace("á", "a").replace("í", "i")
         .replace("ã", "a").replace("â", "a")
         .replace("Ã", "a").replace("Â", "a"))
  return s


def to_number_bce(v):
  """
  Convierte valores tipo:
  - "462" -> 462
  - "4.611,05" -> 4611.05
  - "4,80" -> 4.8
  """
  try:
    s = str(v).strip()

    # Si trae formato europeo (miles con '.' y decimal con ',')
    # Ej: "4.611,05" => "4611.05"
    if "," in s:
      s = s.replace(".", "").replace(",", ".")
      num = float(s)
      # recuerda: si es 462.0 -> int
      return int(num) if num.is_integer() else num

    # Si no trae coma, puede ser entero o float normal
    num = float(s)
    return int(num) if num.is_integer() else num

  except Exception:
    return None


def find_records(obj):
  """
  El JSON del BCE a veces viene como lista directa,
  a veces viene como dict con listas adentro.
  Aquí buscamos recursivamente una lista de dicts
  que tenga llaves Indicador/Fecha/Valor.
  """
  if isinstance(obj, list):
    if obj and isinstance(obj[0], dict):
      keys = set(obj[0].keys())
      if {"Indicador", "Fecha", "Valor"}.issubset(keys):
        return obj
    # si no, busca dentro
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
  Extrae última serie de N días (ordenada por Fecha) de un indicador.
  - indicator_match_fn: función que recibe item['Indicador'] y retorna True/False
  - measure_match_fn: opcional, para filtrar por item['Medida']
  """
  serie = []

  for item in records:
    if not isinstance(item, dict):
      continue

    indicador = item.get("Indicador", "")
    if not indicator_match_fn(indicador):
      continue

    if measure_match_fn is not None:
      medida = item.get("Medida", "")
      if not measure_match_fn(medida:=(medida or "")):
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

  if len(serie) == 0:
    raise RuntimeError("No encontré datos para este indicador (filtrado demasiado estricto).")

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


# ---------- Main ----------
def main():
  r = requests.get(SRC, timeout=30)
  r.raise_for_status()
  data = r.json()

  records = find_records(data)
  if records is None:
    raise RuntimeError("No pude encontrar la lista de registros dentro del JSON del BCE.")

  # Riesgo País (acepta variaciones por encoding)
  riesgo_pais = extract_last_days(
    records,
    indicator_match_fn=lambda s: normalize_text(s) in ["riesgo pais", "riesgo paã­s", "riesgo paÃ­s"],
    limit=5
  )

  # Precio del Oro (filtrando por la medida exacta)
  oro = extract_last_days(
    records,
    indicator_match_fn=lambda s: normalize_text(s) == "precio del oro",
    measure_match_fn=lambda m: (m or "").strip() == "USD / Onza Troy",
    limit=5
  )

  payload = {
    "riesgo_pais": riesgo_pais,
    "oro": oro,
    "source": SRC,
    "generated_at_utc": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
  }

  OUT.parent.mkdir(parents=True, exist_ok=True)
  OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
  print("✅ OK ->", OUT.as_posix())
  print("Riesgo País latest:", payload["riesgo_pais"]["latest"])
  print("Oro latest:", payload["oro"]["latest"])


if __name__ == "__main__":
  main()



