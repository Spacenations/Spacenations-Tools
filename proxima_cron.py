#!/usr/bin/env python3
"""
Externer Cron-Trigger fuer Railway (Absicherung, reine Standardbibliothek).

Der Web-Container erledigt den Mittwochs-Post (17:01) und die Archiv-Pflege
bereits selbst, solange er laeuft. Dieses Skript ist die zusaetzliche
Absicherung, falls der Container zwischendurch geschlafen hat: es ruft die
oeffentlichen Trigger-Endpunkte der App auf.

Als eigener Railway-Dienst (Cron) einrichten:
  * Startbefehl:  python proxima_cron.py
  * Cron-Zeitplan (Railway nutzt UTC!):  */15 15,16 * * 3
        -> feuert Mittwochs im UTC-Fenster; dieses Skript entscheidet anhand der
           BERLINER Zeit, was zu tun ist (sommerzeit-sicher):
             ~17:00-17:19 Berlin  -> Wochen-Post   (/api/proxima-discord/weekly)
             ~17:20-17:49 Berlin  -> Archiv-Abfrage (/api/proxima-archive/refresh)
  * Umgebungsvariable:
        PROXIMA_APP_URL = https://<deine-app>.up.railway.app   [PFLICHT]

Die Endpunkte sind idempotent: Mehrfachaufrufe im selben Zeitfenster posten
nicht doppelt (Wochen-Post ist pro ISO-Woche gesperrt).
"""
import os
import sys
import urllib.request
import urllib.error

# gleiche DST-sichere Berliner-Zeit-Logik wie im Hauptmodul
from proxima_discord import _berlin_now

WEEKLY_PATH = "/api/proxima-discord/weekly"
ARCHIVE_PATH = "/api/proxima-archive/refresh"


def _hit(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Spacenations-Cron/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status, resp.read().decode("utf-8", "replace")


def _slot(berlin_now):
    """Welche Aktion ist jetzt (Berliner Zeit) faellig? None = nichts tun."""
    if berlin_now.weekday() != 2:  # 2 = Mittwoch
        return None
    minutes = berlin_now.hour * 60 + berlin_now.minute
    if 17 * 60 + 0 <= minutes < 17 * 60 + 20:
        return WEEKLY_PATH
    if 17 * 60 + 20 <= minutes < 17 * 60 + 50:
        return ARCHIVE_PATH
    return None


def main():
    base = os.getenv("PROXIMA_APP_URL", "").strip().rstrip("/")
    if not base:
        print("FEHLER: PROXIMA_APP_URL nicht gesetzt.", file=sys.stderr)
        sys.exit(1)

    now = _berlin_now()
    path = _slot(now)
    if path is None:
        print(f"{now:%Y-%m-%d %H:%M} Berlin – ausserhalb der Slots, nichts zu tun.")
        return

    url = base + path
    try:
        status, body = _hit(url)
        print(f"{now:%Y-%m-%d %H:%M} Berlin -> {path}: HTTP {status} {body[:250]}")
        if status >= 400:
            sys.exit(1)
    except urllib.error.HTTPError as e:
        print(f"Cron-HTTP-Fehler {e.code} bei {path}: {e.reason}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Cron-Fehler bei {path}: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
