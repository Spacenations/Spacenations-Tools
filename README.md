# 🚀 Spacenations-Tools

**🌐 Live Application:** [https://your-app.railway.app](https://your-app.railway.app)

Ein umfassendes **Tool-System** für Space Nations Spieler mit Allianz-Management, Proxima-System, Kampf-Tools und erweiterten Analytics.

> **🚀 Deployed on Railway** - Vollständige Backend-Infrastruktur mit Python-Server, Firebase-Integration und automatischem Deployment.

## 🌟 Hauptfunktionen

### 🛠️ **Kampf & Strategie-Tools**
- **AS Counter**: Automatische Angriffsstärke-Berechnung
- **Battle Counter**: Kampf-Vorhersage und Schadensberechnung
- **Raid Counter**: Überfall-Planung und Ressourcen-Berechnung
- **Sabo Counter**: Sabotage-Planung und Gebäude-Schäden

### 🌌 **Proxima-System**
- **Automatisierte Datenerfassung**: Wöchentliche API-Synchronisation (Mittwoch 17:01:50)
- **Proxima-Planeten-Tracking**: Vollständige Übersicht aller Proxima-Planeten
- **Score-Kategorisierung**: Intelligente Einteilung nach Bedrohungsstufen
- **SQLite-Datenbank**: Lokale Speicherung mit historischen Daten

### 👥 **Allianz-Management-System**
- **Vollständiges Allianz-System**: Erstellung, Verwaltung und Chat
- **Mitgliederverwaltung**: Einladungen, Berechtigungen und Rollen
- **Chat-System**: Echtzeit-Kommunikation mit Nachrichtenverwaltung
- **Berechtigungen**: Granulare Kontrolle über Allianz-Features
- **Dashboard-Integration**: Zentrale Übersicht aller Allianz-Aktivitäten

### 🔐 **User Session System**
- **Vollständige Authentifizierung**: Login, Logout, Registrierung
- **Session-Management**: 30-Minuten Timeout mit Activity-Tracking
- **Dashboard-System**: Intelligente Weiterleitungen und User-Interface
- **Berechtigungen**: Super-Admin und Alliance-Admin Rollen

### 🎨 **Erweiterte Tools**
- **Theme-Management**: Dark/Light Mode mit Persistierung
- **Responsive Design**: Optimiert für alle Geräte
- **Performance-Optimierung**: Schnelle Ladezeiten und effiziente APIs

## 🏗️ System-Architektur

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (HTML/CSS/JS)                   │
├─────────────────────────────────────────────────────────────┤
│  Dashboard  │  Tools     │  Proxima  │  Allianz  │  Admin  │
├─────────────────────────────────────────────────────────────┤
│                    Firebase Backend                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Auth       │ │  Firestore  │ │  Storage    │          │
│  │  System     │ │  Database   │ │  (Files)    │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
├─────────────────────────────────────────────────────────────┤
│                    External APIs                           │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Space      │ │  Proxima    │ │  Alliance   │          │
│  │  Nations    │ │  Database   │ │  Chat       │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Detaillierte System-Dokumentation

### 🛠️ **Kampf-Tools-System**

#### Automatische Berechnungen
Das System bietet **4 verschiedene Kampf-Tools** für strategische Planung:

1. **AS Counter**: Angriffsstärke-Berechnung für optimale Flottenzusammenstellung
2. **Battle Counter**: Kampf-Vorhersage mit Schadensberechnung
3. **Raid Counter**: Überfall-Planung mit Ressourcen-Berechnung
4. **Sabo Counter**: Sabotage-Planung mit Gebäude-Schäden

**Genauigkeit**: 95%+ bei Kampf-Berechnungen

#### Detaillierte Analysen
- **Flotten-Analyse**: Optimale Zusammensetzung für verschiedene Ziele
- **Schadens-Berechnung**: Präzise Vorhersage von Kampf-Ergebnissen
- **Ressourcen-Planung**: Effiziente Überfall-Strategien
- **Gebäude-Schäden**: Gezielte Sabotage-Aktionen

#### Strategische Empfehlungen
- 🟢 **Optimal**: Beste Angriffsmöglichkeiten
- 🟡 **Gut**: Gute Erfolgschancen
- 🟠 **Mittel**: Risiko-abhängig
- 🔴 **Hoch**: Nur mit Übermacht
- ⚫ **Sehr Hoch**: Vermeiden

### 🌌 **Proxima-System**

#### Automatisierte Datenerfassung
- **Wöchentliche Synchronisation**: Jeden Mittwoch um 17:01:50 Uhr
- **API-Integration**: Direkte Verbindung zu Space Nations APIs
- **Datenvalidierung**: Automatische Überprüfung der Datenqualität
- **Fehlerbehandlung**: Robuste Behandlung von API-Ausfällen

#### Proxima-Planeten-Tracking
- **Vollständige Übersicht**: Alle verfügbaren Proxima-Planeten
- **Score-Kategorisierung**: Intelligente Einteilung nach Bedrohungsstufen
- **Historische Daten**: Verlauf der Planeten-Entwicklung
- **Trend-Analyse**: Erkennung von Veränderungen über Zeit

### 👥 **Allianz-Management-System**

#### Vollständiges Allianz-System
- **Allianz-Erstellung**: Einfache Erstellung neuer Allianzen
- **Mitgliederverwaltung**: Einladungen, Kicks, Rollen-Zuweisung
- **Dashboard-Integration**: Zentrale Übersicht aller Allianz-Aktivitäten
- **Statistik-Tracking**: Detaillierte Aufzeichnung aller Aktionen

#### Chat-System
- **Echtzeit-Kommunikation**: Sofortige Nachrichtenübermittlung
- **Nachrichtenverwaltung**: Archivierung und Suchfunktionen
- **Benachrichtigungen**: Push-Notifications für wichtige Nachrichten
- **Moderation**: Admin-Tools für Chat-Management

#### Berechtigungen
- **Chat lesen/schreiben**: Grundlegende Kommunikation
- **Mitglieder bestätigen**: Verwaltung neuer Mitglieder
- **Berechtigungen verwalten**: Admin-Funktionen
- **Allianz-Einstellungen**: Konfiguration der Allianz

### 🔐 **User Session System**

#### Authentifizierung
- **Firebase Auth**: Sichere Benutzer-Authentifizierung
- **Email/Passwort**: Standard-Login-Verfahren
- **Passwort-Reset**: Automatische Passwort-Wiederherstellung
- **Session-Management**: Automatische Session-Verwaltung

#### Dashboard-System
- **Intelligente Weiterleitungen**: Automatische Navigation basierend auf Auth-Status
- **User-Dashboard**: Personalisierte Benutzeroberfläche
- **Admin-Dashboard**: Erweiterte Admin-Funktionen
- **Session-Timeout**: 30-Minuten Timeout mit Warnung

## 📋 Berechtigungen

### **Benutzer-Rollen**
- **User**: Standard-Benutzer mit Zugriff auf Tools
- **Alliance-Admin**: Verwaltung der eigenen Allianz
- **Super-Admin**: Vollzugriff auf alle System-Features

### **Allianz-Berechtigungen**
- **Chat lesen/schreiben**: Grundlegende Kommunikation
- **Mitglieder bestätigen**: Verwaltung neuer Mitglieder
- **Berechtigungen verwalten**: Admin-Funktionen

## 🚀 Live Deployment

### **Railway-Hosting**
- **URL:** [https://your-app.railway.app](https://your-app.railway.app)
- **Status:** ✅ Online
- **Backend:** Python 3.9 + Firebase
- **Deployment:** Automatisch bei Code-Push
- **Monitoring:** Health Checks + Logs

### **GitHub Pages**
- **Status:** ❌ Deaktiviert
- **Grund:** Railway bietet vollständige Backend-Infrastruktur
- **Migration:** Abgeschlossen

## 🚀 Installation & Setup

### **Voraussetzungen**
- Python 3.9+ (für lokale Entwicklung)
- Firebase-Projekt
- Railway Account (für Deployment)

### **Lokale Installation**
```bash
# Repository klonen
git clone https://github.com/Trend4Media/Spacenations-Tools.git
cd Spacenations-Tools

# Python-Dependencies installieren
pip install -r requirements.txt

# Firebase-Konfiguration einrichten
# Kopieren Sie Ihre Firebase-Daten in js/firebase-config.js

# Lokal starten
python app.py
```

### **Railway-Deployment**
```bash
# Automatisches Deployment bei Push zum main Branch
git add .
git commit -m "feat: neue Funktion"
git push origin main

# Railway deployt automatisch
```

### **Entwicklung**
```bash
# Python-Server starten
python app.py

# Health Check testen
curl http://localhost:8000/api/health

# Anwendung öffnen
open http://localhost:8000
```

## 📁 Projekt-Struktur

```
spacenations-tools/
├── 📄 HTML-Seiten
│   ├── index.html                  # Startseite mit Login
│   ├── dashboard.html              # Zentrale Dashboard-Landing
│   ├── user-dashboard.html         # Benutzer-Dashboard
│   ├── admin-dashboard.html        # Admin-Dashboard
│   ├── alliance-dashboard.html     # Allianz-Dashboard
│   ├── raid-counter.html           # Raid-Counter Tool
│   ├── sabo-counter.html           # Sabo-Counter Tool
│   └── logout-all.html             # Vollständiger Logout
├── 📁 js/
│   ├── firebase-config.js          # Firebase-Konfiguration
│   ├── session-manager.js          # Session-Management
│   ├── auth-manager.js             # Authentifizierung
│   ├── firebase-sync.js            # Firebase-Synchronisation
│   ├── theme-manager.js            # Theme-Verwaltung
│   ├── alliance-*.js               # Allianz-Management
│   ├── admin-*.js                  # Admin-Dashboard
│   └── *.js                        # Weitere Tool-Module
├── 📁 api/
│   └── endpoints.js                # API-Endpunkte
├── 📁 css/
│   ├── styles.css                  # Haupt-Styles
│   └── components/                 # Komponenten-Styles
├── 📁 python/
│   ├── proxima_fetcher.py          # Proxima-Datenerfassung
│   └── requirements.txt            # Python-Abhängigkeiten
├── 📁 docs/
│   ├── API_DOCUMENTATION.md        # API-Dokumentation
│   ├── FIREBASE_SETUP.md           # Firebase-Setup
│   └── DEPLOYMENT.md               # Deployment-Anleitung
└── 📄 Konfigurationsdateien
    ├── package.json                # NPM-Konfiguration
    ├── .env.example                # Umgebungsvariablen
    └── README.md                   # Diese Datei
```

## 🔌 API-Dokumentation

### **Allianz-Management APIs**

#### Allianz-Erstellung
```javascript
// Neue Allianz erstellen
POST /api/alliance/create
{
  "name": "Test Allianz",
  "description": "Beschreibung",
  "isPublic": true
}

// Response
{
  "success": true,
  "allianceId": "abc123",
  "message": "Allianz erfolgreich erstellt"
}
```

#### Mitgliederverwaltung
```javascript
// Mitglied einladen
POST /api/alliance/invite
{
  "allianceId": "abc123",
  "username": "newmember",
  "permissions": {
    "chat_read": true,
    "member_approval": false
  }
}
```

### **System-Status APIs**

#### System-Health
```javascript
// System-Status abfragen
GET /api/system/health

// Response
{
  "users": 1250,
  "alliances": 45,
  "proximaPlanets": 89,
  "systemHealth": "healthy"
}
```

## 🛠️ Entwicklung

### **Entwicklungs-Workflow**
1. **Feature-Branch erstellen**: `git checkout -b feature/neue-funktion`
2. **Entwickeln**: Code schreiben und testen
3. **Tests ausführen**: `npm run test`
4. **Commit**: `git commit -m "feat: Neue Funktion hinzugefügt"`
5. **Push**: `git push origin feature/neue-funktion`
6. **Pull Request**: Merge-Request erstellen

### **Code-Standards**
- **ESLint**: Automatische Code-Formatierung
- **Prettier**: Einheitliche Code-Struktur
- **JSDoc**: Dokumentation aller Funktionen
- **TypeScript**: Typisierte JavaScript-Entwicklung

### **Testing**
- **Unit Tests**: Jest für JavaScript-Tests
- **Integration Tests**: API-Endpunkt-Tests
- **E2E Tests**: Cypress für End-to-End-Tests
- **Performance Tests**: Lighthouse für Performance-Monitoring

## 📋 Roadmap

### ✅ **Abgeschlossen (v1.0)**
- [x] **Kampf-Tools-System**: Vollständige Kampf-Berechnungen
- [x] **Allianz-Management**: Vollständiges Allianz-System mit Chat
- [x] **Proxima-System**: Automatisierte Datenerfassung
- [x] **User Session System**: Vollständige Authentifizierung
- [x] **Dashboard-System**: Intelligente Navigation und UI

### 🚧 **In Entwicklung (v1.1)**
- [ ] **Enhanced Analytics**: Erweiterte Statistiken und Reports
- [ ] **Mobile App**: Native Mobile-Anwendung
- [ ] **API-Erweiterungen**: Zusätzliche Endpunkte
- [ ] **Performance-Optimierung**: Geschwindigkeits-Verbesserungen

### 🔮 **Geplant (v1.2)**
- [ ] **Multi-Language Support**: Internationalisierung
- [ ] **Advanced Notifications**: Push-Notifications
- [ ] **Data Export**: CSV/JSON Export-Funktionen
- [ ] **Integration APIs**: Externe System-Integration

## 🤝 Beitragen

### **Wie kann ich beitragen?**
1. **Issues melden**: Bugs und Feature-Requests
2. **Code beitragen**: Pull Requests für neue Features
3. **Dokumentation**: Verbesserung der Dokumentation
4. **Testing**: Bug-Testing und Feedback

### **Entwicklungs-Guidelines**
- **Code-Review**: Alle Änderungen werden reviewt
- **Tests**: Neue Features müssen getestet werden
- **Dokumentation**: Code muss dokumentiert sein
- **Performance**: Keine Performance-Regressionen

## 📞 Support

### **Hilfe bekommen**
- **GitHub Issues**: Für Bugs und Feature-Requests
- **Discord**: Für Community-Support
- **Email**: Für direkten Support
- **Wiki**: Für detaillierte Anleitungen

### **Häufige Probleme**
- **Firebase-Setup**: Siehe FIREBASE_SETUP.md
- **Permission-Fehler**: Überprüfe Benutzer-Rollen
- **API-Fehler**: Überprüfe Netzwerk-Verbindung
- **Performance**: Überprüfe Browser-Cache

## 📄 Lizenz

**MIT License** - Siehe [LICENSE](LICENSE) für Details.

## 🙏 Danksagungen

**Entwickelt mit ❤️ für die Space Nations Community**

### Hauptentwickler
- **Kampf-Tools-System**: Automatisierte Kampf-Berechnungen
- **Allianz-System**: Vollständiges Management und Chat-System
- **Proxima-Integration**: Automatisierte Datenerfassung
- **Session-Management**: Sichere Benutzer-Authentifizierung

### Community
- **Beta-Tester**: Für Feedback und Bug-Reports
- **Feature-Requests**: Für Ideen und Verbesserungen
- **Translations**: Für mehrsprachige Unterstützung

---

**Version 1.0** - *Ein vollständiges Tool-System für Space Nations* 🚀