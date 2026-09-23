# Spacenations-Tools

Tool-Sammlung für Space-Nations-Spieler: Kampf-Rechner, ein Allianz-System mit
Chat und Rollen, eine geteilte Spionage-Datenbank und ein Live-Tracker für
Proxima-Planeten.

## Hauptfunktionen

### Kampf- & Strategie-Tools
- **AS Counter** (`as-counter.html`, `dashboard-as-counter.html`) — Angriffsstärke-Berechnung
- **Battle Counter** (`battle-counter.html`) — Kampf-Vorhersage
- **Raid Counter** (`raid-counter.html`, `dashboard-raid-counter.html`) — Überfallplanung, Ergebnisse werden pro Nutzer in `userRaids` gespeichert
- **Sabo Counter** (`sabo-counter.html`, `dashboard-sabo-counter.html`) — Sabotageplanung, Ergebnisse in `userSabotages`

### Allianz-System
Gründung (wartet auf Freigabe durch einen Global-Admin), Mitgliederverwaltung
mit granularen Berechtigungen (Chat schreiben / Mitglieder verwalten /
Spionage-Datenbank), Echtzeit-Chat, Aktivitätsprotokoll. Siehe
[`DATABASE_STRUCTURE.md`](DATABASE_STRUCTURE.md) für das genaue Schema.

### Spionage-Datenbank (`spy-database.html`)
Geteilte, allianzweite Sammlung von Spionageberichten (Gebäude, Schiffstypen,
Angriffs-/Verteidigungswerte pro Spieler/Planet). Berichte werden über
`spy-report-input.html` erfasst und in Firestore geparst
(`js/spy-report-parser.js`).

### Proxima-Tracker (`ProximaDB.html`)
Ruft die Proxima-Planetenliste direkt im Browser von der Space-Nations-API ab
(alle 60 Sekunden). Details in [`PROXIMA_SYSTEM_README.md`](PROXIMA_SYSTEM_README.md).

### Admin-Dashboard (`admin-dashboard.html`)
Für Nutzer mit `globalRole: "global_admin"`: Allianzen freigeben/ablehnen,
Nutzerrollen verwalten, ProximaDB-Ansicht, System-Übersicht.

### Session-Verwaltung
30 Minuten Inaktivitäts-Timeout mit Warnung kurz vor Ablauf
(`js/session-manager.js`), automatischer Logout danach.

### Sonstiges
Dark/Light-Theme (`js/theme-manager.js`), Analytics-Tracking
(`js/analytics-tracker.js`, siehe [`ANALYTICS_SETUP.md`](ANALYTICS_SETUP.md)).

## Architektur

Es gibt **keine eigene REST-API für Allianz-/Nutzeraktionen** — das ist die
größte Abweichung von älteren Beschreibungen dieses Projekts. Der komplette
Anwendungszustand lebt in Firebase; die Web-Seiten schreiben und lesen direkt
per Firebase-SDK gegen Firestore, abgesichert durch `firestore.rules`.

```
┌──────────────────────────────────────────────────────────┐
│  Statische Seiten (HTML + js/*.js, Firebase-SDK v9 compat) │
│  Dashboards · Kampf-Tools · Allianz · Spionage-DB · Admin  │
└───────────────────────────┬────────────────────────────────┘
                             │ Firebase JS SDK (Client)
                             ▼
┌──────────────────────────────────────────────────────────┐
│  Firebase                                                  │
│  Auth (E-Mail/Passwort)  │  Firestore (siehe firestore.rules) │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  app.py (Python-Standardbibliothek, kein Framework)        │
│  Liefert die statischen Dateien aus + 3 kleine             │
│  Hilfs-Endpunkte: /api/health, /api/status,                │
│  /api/firebase-config (Docker-Healthcheck bzw. Debug-Tools, │
│  von der eigentlichen App nicht benötigt — die App lädt    │
│  ihre Firebase-Konfiguration fest aus js/firebase-config.js)│
└──────────────────────────────────────────────────────────┘
```

`functions/adminOverview.js` und die Seiten unter `examples/` sind
Referenzbeispiele für eine mögliche künftige Cloud-Function-Erweiterung — sie
sind nicht deployed und nicht Teil des laufenden Systems.

## Sicherheitsmodell

Rollen und Mitgliedschaft sind ausschließlich serverseitig über
`firestore.rules` durchgesetzt, nicht durch Client-Code:

- **`globalRole`** auf `users/{uid}` kann ein Nutzer bei sich selbst nur lesen,
  nie setzen — nur ein bestehender `global_admin` darf das Feld (bei
  beliebigen Nutzern) ändern. Ohne diese Regel könnte sich jeder per
  Browser-Konsole selbst zum Admin machen.
- Allianz-Mitgliedschaft/-Rolle lebt in `allianceMembers/{allianceId}_{uid}`
  und wird beim Anlegen serverseitig gegen das zugehörige
  `alliances`-Dokument verifiziert (nur der tatsächliche Gründer darf sich
  selbst als `founder` eintragen).
- Alle Regeln sind über `tests/firestore-rules-simulator.js` gegen den
  Firebase-Emulator abgesichert (`npm run test:rules`), inklusive
  Negativ-Tests (z. B. "Nutzer kann NICHT das eigene `globalRole` setzen").

## Datenmodell

Siehe [`DATABASE_STRUCTURE.md`](DATABASE_STRUCTURE.md) für alle Collections,
Felder und Zugriffsregeln im Detail.

## Projektstruktur

```
Spacenations-Tools/
├── *.html                   # Seiten (Dashboards, Tools, Allianz, Admin, Login/Registrierung)
├── js/                      # Client-Logik (auth-manager, alliance-*, spy-*, session-manager, ...)
├── css/                     # Geteilte Styles (Theme, Navigation, Dashboard-Komponenten)
├── tests/                   # Firestore-Regel-Tests (gegen den Firebase-Emulator)
├── functions/               # Referenzbeispiel für eine Cloud Function (nicht deployed)
├── examples/                # Referenzbeispiel-Seiten für das aktuelle Schema
├── firestore.rules          # Einzige Quelle der Wahrheit für Zugriffsregeln
├── firestore.indexes.json   # Composite Indexes
├── app.py                   # Statischer Dateiserver + 3 Hilfs-Endpunkte (Python-Standardbibliothek)
├── Dockerfile.railway / railway.json / railway.toml / Procfile / nixpacks.toml
└── package.json             # Nur für die Firestore-Regel-Tests (firebase-tools, Emulator)
```

## Lokale Entwicklung

### App lokal starten (Python, keine Abhängigkeiten nötig)
```bash
python app.py
# öffnet auf Port 8000 (oder $PORT), z.B. http://localhost:8000
```

Die App verbindet sich dabei mit dem echten, produktiven Firebase-Projekt
(Konfiguration ist in `js/firebase-config.js` fest hinterlegt) — es gibt
aktuell keine automatische Emulator-Umschaltung für den App-Server selbst.

### Firestore-Regeln testen (Firebase-Emulator, keine echten Daten)
```bash
npm install
npm run test:rules
```
Startet den lokalen Firestore-Emulator und führt
`tests/firestore-rules-simulator.js` dagegen aus — verändert nie die echte
Datenbank.

## Deployment

Läuft auf Railway, gebaut aus `Dockerfile.railway` (Python 3.9,
`pip install -r requirements.txt`, Start via `python app.py`), automatisch bei
Push auf den Standard-Branch. `railway.json`/`railway.toml`/`Procfile`/
`nixpacks.toml` sind zueinander konsistent konfiguriert. GitHub-Pages-Workflows
sind bewusst deaktiviert (`.github/workflows-disabled/`) — siehe
[`GITHUB_PAGES_MIGRATION.md`](GITHUB_PAGES_MIGRATION.md).

Firestore-Regeln werden **nicht** automatisch mit deployed — dafür braucht es
`firebase deploy --only firestore:rules` (Firebase-CLI mit Projektzugriff) oder
manuelles Einfügen in der Firebase-Console.

## Bekannte Grenzen

- Ein Nutzerkonto kann aktuell nicht vollständig gelöscht werden (nur das
  Firestore-Profil, nicht das Firebase-Auth-Konto) und niemand kann das
  Passwort eines anderen Nutzers ändern — beides bräuchte eine Cloud Function
  mit Firebase Admin SDK, die aktuell nicht deployed ist (siehe
  `functions/adminOverview.js` als unbenutztes Beispiel für so eine Function).
- `js/spy-report-parser.js` erkennt Gebäude-/Forschungsnamen über
  Schlüsselwort-Zuordnung; die hinterlegten Namen orientieren sich an
  gängiger OGame-artiger Terminologie und wurden nicht gegen die aktuellen
  Feldnamen der echten Space-Nations-API verifiziert.
- Mehrere `debug-*.html`/`test-*.html`/`fix-*.html`-Seiten im Root sind
  Entwickler-Werkzeuge aus der Projekthistorie, keine Teile des eigentlichen
  Nutzerpfads.
