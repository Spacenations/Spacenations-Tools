#!/usr/bin/env python3
"""
Proxima -> Discord Poster (reine Standardbibliothek, keine externen Pakete).

Holt in einem festen Intervall die aktuelle Proxima-Planetenliste von der
Spiel-API und haelt damit EINE Nachricht in einem Discord-Kanal aktuell
(per Webhook). Es wird bewusst nur eine Nachricht bearbeitet statt bei jedem
Lauf eine neue zu posten - so bleibt der Kanal sauber und zeigt trotzdem immer
die neueste Liste.

Die Nachricht enthaelt:
  * eine kompakte Embed-Tabelle, sortiert nach PUNKTEN (hoechste zuerst);
  * eine angehaengte, stets aktuelle Excel-Datei (.xlsx) mit ALLEN Feldern
    aller Planeten - selbst gebaut mit der Standardbibliothek (zipfile),
    also ohne zusaetzliche Abhaengigkeiten fuer das Railway-Deployment.

Zusaetzlich:
  * Fester Wochen-Post jeden Mittwoch 17:01 Europe/Berlin (DST-sicher): dann
    wird bewusst eine NEUE Discord-Nachricht angelegt (loest den Webhook/Ping
    aus). Unter der Woche wird diese Nachricht nur noch aktualisiert.
  * Ein Archiv (proxima_archive.json) haelt fest, welche Planeten wann und wo
    (Koordinaten) verschwunden sind. Es wird bei jeder Abfrage aktualisiert und
    ueber /api/proxima-archive bereitgestellt.

Konfiguration ausschliesslich ueber Umgebungsvariablen (keine Secrets im Code):
  DISCORD_PROXIMA_WEBHOOK        Discord-Webhook-URL des Zielkanals (PFLICHT).
  PROXIMA_DISCORD_INTERVAL_MIN   Aktualisierungs-Intervall in Minuten (Default 10).
  PROXIMA_API_URL                Proxima-API (Default beta4).
  PROXIMA_DISCORD_MAX_ROWS       Max. Zeilen in der Embed-Tabelle (Default 30).
                                 Die Excel-Datei enthaelt immer ALLE Planeten.
  PROXIMA_ARCHIVE_PATH           Pfad der Archiv-Datei. Fuer Dauerhaftigkeit auf
                                 ein Railway-Volume legen (z. B. /data/...json).

Aktiviert wird der Job aus app.py heraus (start_proxima_discord()). Ist die
Webhook-URL nicht gesetzt, passiert nichts - der Webserver laeuft normal weiter.
"""

import os
import re
import io
import json
import time
import zipfile
import hashlib
import logging
import threading
import tempfile
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta

logger = logging.getLogger("proxima_discord")

DEFAULT_API_URL = "https://beta4.game.spacenations.eu/api/proxima"
REQUEST_TIMEOUT = 20
DISCORD_DESC_LIMIT = 4000
XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
STATE_FILE = os.path.join(tempfile.gettempdir(), "proxima_discord_state.json")

# Archiv: haelt fest, welche Planeten wann/wo verschwunden sind. Fuer echte
# Dauerhaftigkeit auf Railway ein Volume mounten und PROXIMA_ARCHIVE_PATH auf
# einen Pfad darauf setzen (z. B. /data/proxima_archive.json); sonst best effort.
ARCHIVE_FILE = os.getenv("PROXIMA_ARCHIVE_PATH", "").strip() or os.path.join(
    tempfile.gettempdir(), "proxima_archive.json"
)

# Woechentlicher fester Post (loest den Webhook/Ping aus). Default: Mittwoch 17:01
# Europe/Berlin, nachdem die neuen Proximas erstellt wurden.
WEEKLY_DAY = 2       # 0=Mo .. 6=So  -> 2 = Mittwoch
WEEKLY_HOUR = 17
WEEKLY_MINUTE = 1


# ----------------------------------------------------------------------------
# Datenbeschaffung
# ----------------------------------------------------------------------------
def _fetch_proxima(api_url):
    """Laedt die Proxima-Liste und gibt normalisierte Dicts zurueck (inkl. Rohdaten)."""
    req = urllib.request.Request(
        api_url,
        headers={
            "Accept": "application/json",
            "User-Agent": "Spacenations-Tools/1.0 (+proxima-discord)",
        },
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        raw = resp.read().decode("utf-8", "replace")
    data = json.loads(raw)
    if not isinstance(data, list):
        raise ValueError("Unerwartetes Datenformat (keine Liste)")

    planets = []
    for p in data:
        source = p if isinstance(p, dict) else {}
        name = str(source.get("name", "") or "")
        m = re.search(r"Proxima (\d+)-(\d+)", name)
        planets.append({
            "name": name,
            "coordinates": str(source.get("coordinates", "") or ""),
            "score": _to_int(source.get("score", 0)),
            "deleteOn": str(source.get("deleteOn", "") or ""),
            "week": int(m.group(1)) if m else 0,
            "index": int(m.group(2)) if m else 0,
            "raw": dict(source),
        })
    return planets


def _to_int(value):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def _format_delete(delete_on):
    if not delete_on:
        return "-"
    s = delete_on.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s).strftime("%d.%m. %H:%M")
    except ValueError:
        return delete_on[:16]


def _delete_epoch(delete_on):
    if not delete_on:
        return -1.0
    s = delete_on.strip().replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        return -1.0


def _recency_key(p):
    """Neueste zuerst: hoehere Woche, dann hoehere laufende Nummer, dann spaetere Loeschung."""
    return (p.get("week", 0), p.get("index", 0), _delete_epoch(p.get("deleteOn", "")))


def _score_key(p):
    """Hoechste Punkte zuerst; bei Gleichstand die neueren Planeten oben."""
    return (p.get("score", 0), p.get("week", 0), p.get("index", 0))


# ----------------------------------------------------------------------------
# Discord-Embed
# ----------------------------------------------------------------------------
def _build_payload(planets, max_rows):
    total = len(planets)
    weeks = [p["week"] for p in planets]
    latest_week = max(weeks) if weeks else "-"

    ordered = sorted(planets, key=_score_key, reverse=True)
    shown = ordered[:max_rows]

    header = f"{'Punkte':>7}  {'Koordinaten':<13} {'Loeschung':<12} Name"
    lines = [header, "-" * len(header)]
    for p in shown:
        score = f"{p['score']:,}".replace(",", ".")
        lines.append(
            f"{score:>7}  {p['coordinates']:<13} {_format_delete(p['deleteOn']):<12} {p['name']}"
        )
    table = "\n".join(lines)
    if len(table) > DISCORD_DESC_LIMIT:
        table = table[:DISCORD_DESC_LIMIT - 20].rsplit("\n", 1)[0] + "\n..."

    rest = total - len(shown)
    if rest > 0:
        note = f"\n\n… und {rest} weitere Planeten – **vollstaendige Liste in der angehaengten Excel-Datei**."
    else:
        note = "\n\n**Vollstaendige Liste (alle Felder) in der angehaengten Excel-Datei.**"
    description = f"```\n{table}\n```{note}"
    stand = datetime.now(timezone.utc).astimezone().strftime("%d.%m.%Y %H:%M")

    return {
        "embeds": [{
            "title": "🌌 Proxima – Nach Punkten sortiert",
            "description": description,
            "color": 0x00A878,
            "footer": {
                "text": f"Woche {latest_week} · {total} Planeten · hoechste Punkte zuerst · Stand {stand} · Excel angehaengt"
            },
        }]
    }


def _content_hash(planets):
    basis = [
        (p["name"], p["coordinates"], p["score"], p["deleteOn"])
        for p in sorted(planets, key=lambda x: (x["name"], x["coordinates"]))
    ]
    return hashlib.sha256(json.dumps(basis, ensure_ascii=False).encode("utf-8")).hexdigest()


# ----------------------------------------------------------------------------
# Excel (.xlsx) - reine Standardbibliothek (zipfile), keine Pakete.
# ----------------------------------------------------------------------------
_XLSX_CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    '</Types>'
)
_XLSX_ROOT_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    '</Relationships>'
)
_XLSX_WORKBOOK = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    '<sheets><sheet name="Proxima" sheetId="1" r:id="rId1"/></sheets></workbook>'
)
_XLSX_WORKBOOK_RELS = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    '</Relationships>'
)
_XLSX_STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>'
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    '<fills count="2"><fill><patternFill patternType="none"/></fill>'
    '<fill><patternFill patternType="gray125"/></fill></fills>'
    '<borders count="1"><border/></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="2">'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    '</cellXfs></styleSheet>'
)
_XLSX_SHEET_HEAD = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'
)
_XLSX_SHEET_TAIL = '</sheetData></worksheet>'

_CORE_COLUMNS = [
    ("Name", "name"),
    ("Nr.", "index"),
    ("Koordinaten", "coordinates"),
    ("Punkte", "score"),
    ("Loeschung (UTC)", "deleteOn"),
    ("Loeschung (lokal)", "_delete_local"),
    ("Woche", "week"),
]
_CORE_RAW_KEYS = {"name", "coordinates", "score", "deleteOn"}


def _col_letter(idx):
    result = ""
    idx += 1
    while idx:
        idx, rem = divmod(idx - 1, 26)
        result = chr(65 + rem) + result
    return result


def _xml_escape(value):
    s = "" if value is None else str(value)
    s = "".join(ch for ch in s if ch >= " " or ch in "\t\n\r")
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _xlsx_cell(ref, value, bold=False):
    style = ' s="1"' if bold else ""
    if isinstance(value, bool):
        value = "WAHR" if value else "FALSCH"
    if isinstance(value, (int, float)):
        return f'<c r="{ref}"{style}><v>{value}</v></c>'
    text = _xml_escape(value)
    return f'<c r="{ref}"{style} t="inlineStr"><is><t xml:space="preserve">{text}</t></is></c>'


def _build_xlsx(planets):
    ordered = sorted(planets, key=_score_key, reverse=True)
    extra_keys = []
    for p in ordered:
        for key in p.get("raw", {}):
            if key not in _CORE_RAW_KEYS and key not in extra_keys:
                extra_keys.append(key)
    headers = [title for title, _ in _CORE_COLUMNS] + [str(k) for k in extra_keys]

    rows_xml = []
    header_cells = [_xlsx_cell(f"{_col_letter(ci)}1", title, bold=True) for ci, title in enumerate(headers)]
    rows_xml.append(f'<row r="1">{"".join(header_cells)}</row>')

    for ri, p in enumerate(ordered, start=2):
        raw = p.get("raw", {})
        values = [
            p.get("name", ""),
            p.get("index", 0),
            p.get("coordinates", ""),
            p.get("score", 0),
            p.get("deleteOn", ""),
            _format_delete(p.get("deleteOn", "")),
            p.get("week", 0),
        ] + [raw.get(k, "") for k in extra_keys]
        cells = [_xlsx_cell(f"{_col_letter(ci)}{ri}", val) for ci, val in enumerate(values)]
        rows_xml.append(f'<row r="{ri}">{"".join(cells)}</row>')

    sheet_xml = _XLSX_SHEET_HEAD + "".join(rows_xml) + _XLSX_SHEET_TAIL
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", _XLSX_CONTENT_TYPES)
        zf.writestr("_rels/.rels", _XLSX_ROOT_RELS)
        zf.writestr("xl/workbook.xml", _XLSX_WORKBOOK)
        zf.writestr("xl/_rels/workbook.xml.rels", _XLSX_WORKBOOK_RELS)
        zf.writestr("xl/styles.xml", _XLSX_STYLES)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)
    return buffer.getvalue()


def _xlsx_filename():
    stamp = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d")
    return f"Proxima_Liste_{stamp}.xlsx"


# ----------------------------------------------------------------------------
# Discord-Kommunikation (Webhook: Nachricht anlegen bzw. bearbeiten, mit Datei)
# ----------------------------------------------------------------------------
def _multipart_body(payload, file_bytes, filename):
    digest = hashlib.sha256(file_bytes + filename.encode("utf-8")).hexdigest()[:24]
    boundary = "----Proxima" + digest
    payload_json = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    parts = [
        ("--" + boundary).encode("utf-8"),
        b'Content-Disposition: form-data; name="payload_json"',
        b"Content-Type: application/json",
        b"",
        payload_json,
        ("--" + boundary).encode("utf-8"),
        f'Content-Disposition: form-data; name="files[0]"; filename="{filename}"'.encode("utf-8"),
        ("Content-Type: " + XLSX_CONTENT_TYPE).encode("utf-8"),
        b"",
        file_bytes,
        ("--" + boundary + "--").encode("utf-8"),
        b"",
    ]
    return "multipart/form-data; boundary=" + boundary, b"\r\n".join(parts)


def _discord_multipart_request(url, content_type, body, method):
    req = urllib.request.Request(
        url, data=body, method=method,
        headers={"Content-Type": content_type, "User-Agent": "Spacenations-Tools/1.0"},
    )
    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


def _post_or_edit(webhook_url, payload, state, file_bytes, filename):
    payload = dict(payload)
    payload["attachments"] = [{"id": 0, "filename": filename}]
    content_type, body = _multipart_body(payload, file_bytes, filename)
    message_id = state.get("message_id")

    if message_id:
        edit_url = f"{webhook_url}/messages/{message_id}"
        try:
            _discord_multipart_request(edit_url, content_type, body, "PATCH")
            return message_id
        except urllib.error.HTTPError as e:
            if e.code == 404:
                logger.info("Discord-Nachricht %s nicht mehr vorhanden - lege neue an", message_id)
                message_id = None
            elif e.code == 429:
                logger.warning("Discord Rate-Limit (429) beim Bearbeiten - ueberspringe Lauf")
                return message_id
            else:
                raise

    sep = "&" if "?" in webhook_url else "?"
    status, text = _discord_multipart_request(f"{webhook_url}{sep}wait=true", content_type, body, "POST")
    try:
        return json.loads(text).get("id")
    except (ValueError, AttributeError):
        return None


# ----------------------------------------------------------------------------
# Zustands-Persistenz (best effort)
# ----------------------------------------------------------------------------
def _load_state():
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def _save_state(state):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump(state, f)
    except OSError as e:
        logger.debug("State konnte nicht gespeichert werden: %s", e)


# ----------------------------------------------------------------------------
# Proxima-Archiv: haelt fest, welche Planeten wann/wo verschwunden sind.
# ----------------------------------------------------------------------------
def _planet_key(p):
    return f"{p.get('name', '')}|{p.get('coordinates', '')}"


def _load_archive():
    try:
        with open(ARCHIVE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("planets"), dict):
            return data
    except (OSError, ValueError):
        pass
    return {"planets": {}, "updatedAt": None}


def _save_archive(archive):
    try:
        folder = os.path.dirname(ARCHIVE_FILE)
        if folder:
            os.makedirs(folder, exist_ok=True)
        tmp = ARCHIVE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(archive, f, ensure_ascii=False)
        os.replace(tmp, ARCHIVE_FILE)
    except OSError as e:
        logger.debug("Archiv konnte nicht gespeichert werden: %s", e)


def _update_archive(planets):
    """Neue Planeten anlegen, vorhandene auffrischen, fehlende als 'verschwunden'
    markieren (mit Zeitpunkt + zuletzt bekannter Koordinate/Punktzahl)."""
    archive = _load_archive()
    store = archive.setdefault("planets", {})
    now_iso = datetime.now(timezone.utc).isoformat()
    current = set()
    for p in planets:
        key = _planet_key(p)
        current.add(key)
        entry = store.get(key)
        if entry is None:
            store[key] = {
                "name": p.get("name", ""), "coordinates": p.get("coordinates", ""),
                "score": p.get("score", 0), "week": p.get("week", 0), "index": p.get("index", 0),
                "deleteOn": p.get("deleteOn", ""), "firstSeen": now_iso, "lastSeen": now_iso,
                "status": "active", "disappearedAt": None,
            }
        else:
            entry.update({
                "score": p.get("score", 0), "week": p.get("week", 0), "index": p.get("index", 0),
                "deleteOn": p.get("deleteOn", ""), "lastSeen": now_iso,
                "status": "active", "disappearedAt": None,
            })
    for key, entry in store.items():
        if key not in current and entry.get("status") == "active":
            entry["status"] = "gone"
            entry["disappearedAt"] = now_iso
    archive["updatedAt"] = now_iso
    _save_archive(archive)
    return archive


def load_archive_public():
    """Fuer den HTTP-Endpunkt /api/proxima-archive: Archiv als Liste zurueckgeben."""
    archive = _load_archive()
    planets = sorted(
        archive.get("planets", {}).values(),
        key=lambda e: (1 if e.get("status") == "active" else 0, e.get("score", 0)),
        reverse=True,
    )
    gone = sum(1 for e in planets if e.get("status") == "gone")
    return {
        "updatedAt": archive.get("updatedAt"),
        "total": len(planets),
        "active": len(planets) - gone,
        "gone": gone,
        "planets": planets,
    }


# ----------------------------------------------------------------------------
# Zeit/Woche: fester Wochen-Post Mittwoch 17:01 Europe/Berlin (DST-sicher)
# ----------------------------------------------------------------------------
def _last_sunday(year, month):
    if month == 12:
        first_next = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        first_next = datetime(year, month + 1, 1, tzinfo=timezone.utc)
    last = first_next - timedelta(days=1)
    return last - timedelta(days=(last.weekday() + 1) % 7)


def _berlin_offset(dt_utc):
    """+1h (CET), im Sommer +2h (CEST). DST: letzter So Maerz 01:00 UTC .. letzter So Okt 01:00 UTC."""
    start = _last_sunday(dt_utc.year, 3).replace(hour=1)
    end = _last_sunday(dt_utc.year, 10).replace(hour=1)
    return timedelta(hours=2) if start <= dt_utc < end else timedelta(hours=1)


def _berlin_now():
    now_utc = datetime.now(timezone.utc)
    return now_utc + _berlin_offset(now_utc)


def _iso_week_id(dt):
    y, w, _ = dt.isocalendar()
    return f"{y}-W{w:02d}"


def _seconds_until_weekly(berlin_now):
    """Sekunden bis zum naechsten Mittwoch 17:01 (Berlin-Ortszeit)."""
    days_ahead = (WEEKLY_DAY - berlin_now.weekday()) % 7
    target = berlin_now.replace(hour=WEEKLY_HOUR, minute=WEEKLY_MINUTE, second=0, microsecond=0)
    target += timedelta(days=days_ahead)
    if target <= berlin_now:
        target += timedelta(days=7)
    return max(1.0, (target - berlin_now).total_seconds())


def _weekly_due(berlin_now, state):
    """True, wenn jetzt (Mittwoch >= 17:01) der feste Wochen-Post faellig ist
    und in dieser ISO-Woche noch nicht gepostet wurde."""
    if berlin_now.weekday() != WEEKLY_DAY:
        return False
    if (berlin_now.hour, berlin_now.minute) < (WEEKLY_HOUR, WEEKLY_MINUTE):
        return False
    return state.get("weekly_week") != _iso_week_id(berlin_now)


# ----------------------------------------------------------------------------
# Ein Sync-Zyklus (von Schleife UND manuellem Trigger gemeinsam genutzt)
# ----------------------------------------------------------------------------
def _sync_once(webhook_url, api_url, max_rows, state, force):
    planets = _fetch_proxima(api_url)
    _update_archive(planets)  # Archiv bei jeder Abfrage auffrischen (auch ohne Discord-Post)
    new_hash = _content_hash(planets)
    if not force and state.get("message_id") and new_hash == state.get("hash"):
        return False, len(planets)
    payload = _build_payload(planets, max_rows)
    xlsx_bytes = _build_xlsx(planets)
    filename = _xlsx_filename()
    message_id = _post_or_edit(webhook_url, payload, state, xlsx_bytes, filename)
    if message_id:
        state["message_id"] = message_id
    state["hash"] = new_hash
    _save_state(state)
    return True, len(planets)


def _run_loop(webhook_url, api_url, interval_seconds, max_rows):
    logger.info(
        "Proxima→Discord aktiv (Intervall %d min, fester Wochen-Post Mi %02d:%02d Europe/Berlin, Quelle %s)",
        interval_seconds // 60, WEEKLY_HOUR, WEEKLY_MINUTE, api_url,
    )
    while True:
        try:
            state = _load_state()  # jeden Durchlauf frisch (koordiniert mit run_once)
            berlin = _berlin_now()
            if _weekly_due(berlin, state):
                # Fester Wochen-Post: bewusst eine NEUE Nachricht anlegen, damit der
                # Webhook/Ping ausgeloest wird. Unter der Woche wird sie danach nur
                # noch aktualisiert (bearbeitet).
                logger.info("Fester Wochen-Post (Mi %02d:%02d) – neue Discord-Nachricht", WEEKLY_HOUR, WEEKLY_MINUTE)
                state["message_id"] = None
                state["weekly_week"] = _iso_week_id(berlin)
                _save_state(state)
                _posted, count = _sync_once(webhook_url, api_url, max_rows, state, force=True)
                logger.info("Wochen-Post gesendet (%d Planeten)", count)
            else:
                posted, count = _sync_once(webhook_url, api_url, max_rows, state, force=False)
                if posted:
                    logger.info("Proxima-Liste aktualisiert (%d Planeten, Excel angehaengt)", count)
                else:
                    logger.debug("Proxima-Liste unveraendert")
        except urllib.error.HTTPError as e:
            logger.warning("Proxima→Discord HTTP-Fehler: %s", _http_error_detail(e))
        except urllib.error.URLError as e:
            logger.warning("Proxima→Discord Netzwerk-Fehler: %s", e)
        except Exception as e:
            logger.warning("Proxima→Discord unerwarteter Fehler: %s", e)
        # Normal bis zum naechsten Intervall schlafen – aber rechtzeitig zum
        # Mittwochs-Post aufwachen (auf die Minute genau).
        try:
            wait = min(float(interval_seconds), _seconds_until_weekly(_berlin_now()))
        except Exception:
            wait = float(interval_seconds)
        time.sleep(max(5.0, wait))


# ----------------------------------------------------------------------------
# Hilfen / Einstiegspunkte
# ----------------------------------------------------------------------------
def _http_error_detail(e):
    try:
        body = e.read().decode("utf-8", "replace")
    except Exception:
        body = ""
    return f"{e.code} {getattr(e, 'reason', '')} {body}".strip()


def _env_int(name, default):
    try:
        return max(1, int(os.getenv(name, str(default))))
    except (TypeError, ValueError):
        return default


def _get_webhook_url():
    for key in ("DISCORD_PROXIMA_WEBHOOK", "DISCORD_PROXIMA_WEBHOOKS", "DISCORD_WEBHOOK"):
        value = os.getenv(key, "").strip()
        if value:
            return value
    return ""


def run_once():
    """Ein Fetch-+-Post-Zyklus (fuer den HTTP-Trigger). Gibt (ok, message) zurueck."""
    webhook_url = _get_webhook_url()
    if not webhook_url:
        return False, "Discord-Webhook nicht gesetzt (DISCORD_PROXIMA_WEBHOOK in Railway anlegen)."
    api_url = os.getenv("PROXIMA_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL
    max_rows = _env_int("PROXIMA_DISCORD_MAX_ROWS", 30)
    try:
        state = _load_state()
        _posted, count = _sync_once(webhook_url, api_url, max_rows, state, force=True)
        return True, f"{count} Planeten nach Discord gepostet (inkl. aktueller Excel-Datei)."
    except urllib.error.HTTPError as e:
        return False, f"HTTP-Fehler: {_http_error_detail(e)}"
    except urllib.error.URLError as e:
        return False, f"Netzwerk-Fehler (API/Discord nicht erreichbar): {e}"
    except Exception as e:
        return False, f"Unerwarteter Fehler: {e}"


def start_proxima_discord():
    """Startet den Hintergrund-Thread, sofern eine Webhook-URL konfiguriert ist."""
    webhook_url = _get_webhook_url()
    if not webhook_url:
        logger.info("Proxima→Discord deaktiviert (DISCORD_PROXIMA_WEBHOOK nicht gesetzt).")
        return False
    api_url = os.getenv("PROXIMA_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL
    interval_min = _env_int("PROXIMA_DISCORD_INTERVAL_MIN", 10)
    max_rows = _env_int("PROXIMA_DISCORD_MAX_ROWS", 30)
    thread = threading.Thread(
        target=_run_loop,
        args=(webhook_url, api_url, interval_min * 60, max_rows),
        name="proxima-discord",
        daemon=True,
    )
    thread.start()
    return True


# ----------------------------------------------------------------------------
# Lokaler Selbsttest (ohne Netzwerk): python proxima_discord.py --selftest
# ----------------------------------------------------------------------------
if __name__ == "__main__":
    import sys
    if "--selftest" in sys.argv:
        demo_raw = [
            {"name": "Proxima 0-160", "coordinates": "666:214:3", "score": 63, "deleteOn": "2026-08-07T17:00:00.000000Z", "distance": 14},
            {"name": "Proxima 0-3", "coordinates": "555:123:3", "score": 120, "deleteOn": "2026-08-07T17:00:00.000000Z", "distance": 31},
            {"name": "Proxima 0-77", "coordinates": "555:626:9", "score": 45, "deleteOn": "2026-08-07T17:00:00.000000Z", "distance": 8},
        ]
        demo = []
        for src in demo_raw:
            m = re.search(r"Proxima (\d+)-(\d+)", src["name"])
            demo.append({
                "name": src["name"], "coordinates": src["coordinates"], "score": _to_int(src["score"]),
                "deleteOn": src["deleteOn"], "week": int(m.group(1)) if m else 0,
                "index": int(m.group(2)) if m else 0, "raw": dict(src),
            })

        # 1) Sortierung nach Punkten (hoechste zuerst)
        ordered = sorted(demo, key=_score_key, reverse=True)
        assert [p["score"] for p in ordered] == [120, 63, 45], "Punkte-Sortierung falsch"
        print("Sortierung nach Punkten OK:", [p["score"] for p in ordered])

        print(json.dumps(_build_payload(demo, 30), ensure_ascii=False, indent=2))
        xlsx = _build_xlsx(demo)
        with zipfile.ZipFile(io.BytesIO(xlsx)) as zf:
            bad = zf.testzip()
            names = zf.namelist()
        print(f"\nXLSX: {len(xlsx)} Bytes, ZIP-OK={bad is None}, Teile={names}")
        ct, body = _multipart_body({"attachments": [{"id": 0, "filename": "x.xlsx"}]}, xlsx, "x.xlsx")
        print(f"Multipart: {len(body)} Bytes, Content-Type={ct}")

        # 2) Archiv: erst 3 Planeten aktiv, dann verschwindet einer
        globals()["ARCHIVE_FILE"] = os.path.join(tempfile.gettempdir(), "proxima_archive_selftest.json")
        try:
            os.remove(ARCHIVE_FILE)
        except OSError:
            pass
        _update_archive(demo)
        arch1 = load_archive_public()
        _update_archive(demo[:2])  # der dritte (0-77) verschwindet
        arch2 = load_archive_public()
        gone = [p for p in arch2["planets"] if p["status"] == "gone"]
        assert arch1["active"] == 3 and arch2["active"] == 2 and len(gone) == 1, "Archiv-Logik falsch"
        assert gone[0]["name"] == "Proxima 0-77" and gone[0]["disappearedAt"], "Verschwundener Planet falsch"
        print(f"Archiv OK: aktiv {arch2['active']}, verschwunden {arch2['gone']} "
              f"(zuletzt {gone[0]['name']} @ {gone[0]['coordinates']})")
        try:
            os.remove(ARCHIVE_FILE)
        except OSError:
            pass

        # 3) Wochen-Logik: Mittwoch 17:01 faellig, 17:00 nicht
        wed_1701 = datetime(2026, 9, 23, 17, 1, tzinfo=timezone.utc)  # 2026-09-23 = Mittwoch
        wed_1700 = datetime(2026, 9, 23, 17, 0, tzinfo=timezone.utc)
        assert _weekly_due(wed_1701, {}) is True, "Mi 17:01 sollte faellig sein"
        assert _weekly_due(wed_1700, {}) is False, "Mi 17:00 sollte NICHT faellig sein"
        assert _weekly_due(wed_1701, {"weekly_week": _iso_week_id(wed_1701)}) is False, "schon gepostet -> nicht faellig"
        assert _seconds_until_weekly(datetime(2026, 9, 23, 17, 0, tzinfo=timezone.utc)) == 60.0, "Sekunden bis 17:01 falsch"
        print("Wochen-Logik OK (Mi 17:01 faellig, 17:00 nicht, 60s bis 17:01)")

        print("Selbsttest OK")
