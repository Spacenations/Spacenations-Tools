# Spacenations Tools

Inoffizielle Community-Werkzeuge für das Browserspiel **Spacenations** (beta4):
Kampf-/Raid-/Sabotage-Rechner, Proxima-Planetenliste, Allianz-Verwaltung,
Spionage-Datenbank und ein Admin-Bereich.

> Nicht mit den Machern von Spacenations verbunden.

## Architektur

- **Frontend:** statische HTML-Seiten + Vanilla-JavaScript. Die App spricht
  **direkt mit Firebase** (Authentication + Firestore). Es gibt **keine eigene
  REST-API** – Allianz-, Nutzer- und Spionagedaten laufen komplett über Firestore.
- **Server:** ein schlanker Python-Server (`app.py`, nur Standardbibliothek,
  keine externen Pakete) liefert die statischen Dateien aus und bietet ein paar
  JSON-Endpunkte. Läuft auf **Railway** (Docker, `Dockerfile.railway`,
  Startbefehl `python app.py`).
- **Optionaler Hintergrund-Job:** `proxima_discord.py` hält bei gesetztem
  Webhook eine Discord-Nachricht mit der aktuellen Proxima-Liste (+ Excel) aktuell.

### HTTP-Endpunkte (die es wirklich gibt)

| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/api/health` | Health-Check (JSON) |
| GET | `/api/status` | Laufzeit/Umgebung (JSON) |
| GET | `/api/firebase-config` | Firebase-Web-Konfiguration (öffentlich) |
| GET | `/api/proxima-discord/run` | Proxima-Liste sofort nach Discord posten |

Alle anderen Pfade werden als statische Datei ausgeliefert (mit Path-Traversal-
Schutz) bzw. auf `index.html` zurückgeführt (SPA-Fallback).

## Seiten (Auswahl)

- **Öffentlich (ohne Login):** `index.html`, `as-counter.html`,
  `battle-counter.html`, `raid-counter.html`, `sabo-counter.html`, `ProximaDB.html`
- **Mit Konto:** `user-dashboard.html`, `alliance-dashboard.html`,
  `spy-database.html`, `spy-report-input.html`, `spy-report-detail.html`,
  Dashboard-Varianten der Counter
- **Admin:** `admin-login.html`, `admin-dashboard.html`

## Datenmodell (Firestore)

- **`users/{uid}`** – `email, username, globalRole` (`'user'` \| `'global_admin'`),
  `isAllianceAdmin`, `permissions`, `createdAt`, `lastLogin`, …
  **Rollen sind das einzige Admin-Kriterium** (`globalRole === 'global_admin'`);
  es gibt keine E-Mail-Positivlisten oder Bootstrap-Backdoors mehr.
- **`alliances/{id}`**, **`allianceMembers`**, **`alliancePermissions`**,
  **`allianceChats/{id}/messages`**, **`allianceActivities`** – Allianz-System.
- **`allianceSpyReports`** – Spionageberichte (pro Allianz).
- **`userRaids` / `userSabotages` / `userBattles` / `userStats`,
  `users/{uid}/calculator_data`** – persönliche Auswertungen.
- **`analytics_events` / `analytics_sessions` / `analytics_pageViews`** – Telemetrie.

Der Zugriff wird serverseitig über **`firestore.rules`** durchgesetzt (u. a.:
niemand kann sein eigenes `globalRole` setzen). Regeltests:
`npm run test:rules` (Firestore-Emulator).

## Lokal starten

```bash
python app.py            # Server auf http://localhost:8000
```

Kein `pip install` nötig – die App nutzt ausschließlich die Standardbibliothek.

## Deployment

- **App (Railway):** Push bzw. `railway up`. Gebaut wird `Dockerfile.railway`
  (`python:3.9-slim`), gestartet mit `python app.py` (siehe `railway.json`).
- **Firestore-Regeln:** werden **separat** in der Firebase-Konsole veröffentlicht
  (Firestore → Regeln), nicht über Railway.
- **Umgebungsvariablen (Auswahl):**
  - `PORT` – von Railway gesetzt.
  - `DISCORD_PROXIMA_WEBHOOK` – aktiviert den Proxima→Discord-Job.
  - `PROXIMA_DISCORD_INTERVAL_MIN` (Default 10), `PROXIMA_DISCORD_MAX_ROWS` (30).
  - Optional `FIREBASE_*` zum Überschreiben der Firebase-Web-Konfiguration.
