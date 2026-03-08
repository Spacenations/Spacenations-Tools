# 🌌 Proxima Sabocounter System

Ein automatisiertes System zur Verfolgung von Proxima-Planeten aus der Spacenations API.

## 📋 Übersicht

Das System lädt jeden Mittwoch um 17:01:50 Uhr automatisch die aktuellen Proxima-Planetendaten von der API `https://beta1.game.spacenations.eu/api/proxima` und stellt sie in einer übersichtlichen Web-Oberfläche zur Verfügung.

## 🗂️ Dateien

### Hauptskripte
- `proxima_simple.py` - Hauptskript ohne externe Abhängigkeiten
- `setup_proxima.sh` - Setup-Skript für Installation und Cron-Job

### Web-Interface
- `sabocounter.html` - Hauptseite für das Web-Interface
- `proxima_report.html` - Generierter HTML-Report
- `proxima_data.json` - JSON-Daten für das Web-Interface

### Datenbank
- `proxima.db` - SQLite Datenbank mit allen Planetendaten

## 🚀 Installation

1. **Setup ausführen:**
   ```bash
   ./setup_proxima.sh
   ```

2. **Manuelle Ausführung:**
   ```bash
   python3 proxima_simple.py
   ```

## 📊 Datenstruktur

Die API liefert folgende Daten für jeden Planeten:
- **name**: Planetennamen (z.B. "Proxima 10-1", "Proxima 11-2")
- **coordinates**: Koordinaten im Format "555:395:3"
- **score**: Punkte als Zahl
- **deleteOn**: Zerstörungsdatum im ISO-Format

## 🗄️ Datenbank-Schema

```sql
CREATE TABLE planets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    coordinates TEXT NOT NULL,
    score INTEGER NOT NULL,
    delete_on TEXT NOT NULL,
    week_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, created_at)
);
```

## ⏰ Automatisierung

Das System wird automatisch jeden Mittwoch um 17:01:50 Uhr ausgeführt:
```bash
1 17 * * 3 cd /workspace && sleep 50 && python3 proxima_simple.py >> proxima_cron.log 2>&1
```

## 🌐 Web-Integration

### Für https://trend4media.github.io/Spacenations-Tools/

1. **Dateien hochladen:**
   - `sabocounter.html` → `/sabocounter.html`
   - `proxima_data.json` → `/proxima_data.json`

2. **Navigation erweitern:**
   Fügen Sie einen Menüpunkt "Sabocounter" hinzu, der auf `/sabocounter.html` verweist.

## 📈 Features

### Web-Interface
- ✅ Responsive Design
- ✅ Sortierung nach Woche und Planetennummer
- ✅ Score-Kategorisierung (Hoch/Mittel/Niedrig)
- ✅ Automatische Datumsformatierung
- ✅ Statistiken (Anzahl Planeten, aktuelle Woche)
- ✅ Automatische Aktualisierung

### Datenverarbeitung
- ✅ Automatische Wochennummer-Extraktion
- ✅ Datumsformatierung für deutsche Anzeige
- ✅ Duplikat-Vermeidung
- ✅ Fehlerbehandlung

## 🔧 Wartung

### Logs überwachen
```bash
# Cron-Logs
tail -f proxima_cron.log

# System-Logs
tail -f /var/log/syslog | grep proxima
```

### Cron-Job verwalten
```bash
# Aktuelle Cron-Jobs anzeigen
crontab -l

# Cron-Job bearbeiten
crontab -e

# Cron-Job entfernen
crontab -e  # Zeile mit proxima_simple.py löschen
```

### Manuelle Aktualisierung
```bash
python3 proxima_simple.py
```

## 🐛 Fehlerbehebung

### Häufige Probleme

1. **API nicht erreichbar:**
   - Prüfen Sie die Internetverbindung
   - Überprüfen Sie die API-URL

2. **Cron-Job läuft nicht:**
   - Prüfen Sie die Cron-Logs
   - Überprüfen Sie die Pfade im Cron-Job

3. **Datenbank-Fehler:**
   - Prüfen Sie die Dateiberechtigungen
   - Überprüfen Sie den Speicherplatz

### Debug-Modus
```bash
# Mit detaillierter Ausgabe
python3 -u proxima_simple.py
```

## 📝 API-Dokumentation

### Endpoint
```
GET https://beta1.game.spacenations.eu/api/proxima
```

### Response Format
```json
[
  {
    "name": "Proxima 10-1",
    "coordinates": "555:395:3",
    "score": 129,
    "deleteOn": "2025-09-17T16:06:58.000000Z"
  }
]
```

## 🔄 Update-Prozess

1. **Wöchentlich (Mittwoch 17:01:50):**
   - API-Daten abrufen
   - Datenbank aktualisieren
   - HTML-Report generieren
   - JSON-Daten aktualisieren

2. **Bei Bedarf:**
   - Manuelle Ausführung möglich
   - Sofortige Aktualisierung

## 📞 Support

Bei Problemen oder Fragen:
1. Prüfen Sie die Logs
2. Testen Sie die manuelle Ausführung
3. Überprüfen Sie die Cron-Konfiguration

## 🎯 Nächste Schritte

1. **Web-Integration:**
   - Dateien auf GitHub Pages hochladen
   - Navigation erweitern

2. **Erweiterte Features:**
   - Historische Daten-Visualisierung
   - E-Mail-Benachrichtigungen
   - API-Status-Monitoring

3. **Performance-Optimierung:**
   - Caching implementieren
   - Datenbank-Indizes optimieren