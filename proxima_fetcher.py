#!/usr/bin/env python3
"""
Proxima API Fetcher für Spacenations Tools
 Lädt jeden Mittwoch um 17:01:50 die Proxima-Planetendaten und speichert sie in der ProximaDB
"""

import json
import requests
import sqlite3
import schedule
import time
from datetime import datetime, timezone
import logging
import os

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('proxima_fetcher.log'),
        logging.StreamHandler()
    ]
)

class ProximaFetcher:
    def __init__(self, db_path='proxima.db'):
        self.api_url = "https://beta1.game.spacenations.eu/api/proxima"
        self.db_path = db_path
        self.discord_webhook_url = os.getenv('DISCORD_WEBHOOK_URL', '').strip()
        self.notify_on_first_sync = os.getenv('PROXIMA_NOTIFY_ON_FIRST_SYNC', 'false').lower() == 'true'
        self.init_database()
    
    def init_database(self):
        """Initialisiert die ProximaDB SQLite Datenbank"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS planets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                coordinates TEXT NOT NULL,
                score INTEGER NOT NULL,
                delete_on TEXT NOT NULL,
                week_number INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, created_at)
            )
        ''')
        
        # Index für bessere Performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_name ON planets(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_week ON planets(week_number)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_created ON planets(created_at)')
        
        conn.commit()
        conn.close()
        logging.info("ProximaDB initialisiert")
    
    def fetch_planets(self):
        """Lädt die aktuellen Planetendaten von der API"""
        try:
            response = requests.get(self.api_url, timeout=30)
            response.raise_for_status()
            planets = response.json()
            logging.info(f"Erfolgreich {len(planets)} Planeten von der API geladen")
            return planets
        except requests.exceptions.RequestException as e:
            logging.error(f"Fehler beim Laden der API: {e}")
            return None
    
    def extract_week_number(self, planet_name):
        """Extrahiert die Wochennummer aus dem Planetennamen (z.B. 'Proxima 10-1' -> 10)"""
        try:
            # Format: "Proxima 10-1" -> 10
            parts = planet_name.split()
            if len(parts) >= 2:
                week_part = parts[1].split('-')[0]
                return int(week_part)
        except (ValueError, IndexError):
            pass
        return 0
    
    def format_delete_date(self, delete_on_str):
        """Formatiert das deleteOn Datum für bessere Lesbarkeit"""
        try:
            # Parse ISO format: "2025-09-17T16:06:58.000000Z"
            dt = datetime.fromisoformat(delete_on_str.replace('Z', '+00:00'))
            # Konvertiere zu lokaler Zeit (Deutschland)
            local_dt = dt.astimezone(timezone.utc)
            return local_dt.strftime("%d.%m.%Y %H:%M")
        except Exception as e:
            logging.warning(f"Fehler beim Formatieren des Datums {delete_on_str}: {e}")
            return delete_on_str
    
    def save_planets(self, planets):
        """Speichert die Planetendaten in der Datenbank"""
        if not planets:
            return False
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            current_time = datetime.now().isoformat()
            saved_count = 0
            
            for planet in planets:
                week_number = self.extract_week_number(planet['name'])
                
                cursor.execute('''
                    INSERT OR REPLACE INTO planets 
                    (name, coordinates, score, delete_on, week_number, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    planet['name'],
                    planet['coordinates'],
                    planet['score'],
                    planet['deleteOn'],
                    week_number,
                    current_time
                ))
                saved_count += 1
            
            conn.commit()
            logging.info(f"Erfolgreich {saved_count} Planeten in der Datenbank gespeichert")
            return True
            
        except Exception as e:
            logging.error(f"Fehler beim Speichern der Daten: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()

    def get_known_planet_names(self):
        """Lädt alle bereits bekannten Planetennamen aus der Datenbank"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute('SELECT DISTINCT name FROM planets')
            return {row[0] for row in cursor.fetchall()}
        except Exception as e:
            logging.error(f"Fehler beim Laden bekannter Planetennamen: {e}")
            return set()
        finally:
            conn.close()

    def send_discord_webhook_for_new_planets(self, new_planets):
        """Sendet neue Planeten an Discord, falls ein Webhook konfiguriert ist"""
        if not new_planets:
            return True

        if not self.discord_webhook_url:
            logging.info("DISCORD_WEBHOOK_URL nicht gesetzt - Discord-Benachrichtigung übersprungen")
            return False

        lines = []
        for planet in new_planets[:15]:
            delete_on = self.format_delete_date(planet.get('deleteOn', 'unbekannt'))
            lines.append(
                f"• **{planet.get('name', 'Unbekannt')}** | "
                f"`{planet.get('coordinates', '?:?:?')}` | "
                f"Score: **{planet.get('score', 0)}** | "
                f"Delete: {delete_on}"
            )

        if len(new_planets) > 15:
            lines.append(f"… und **{len(new_planets) - 15}** weitere neue Planeten.")

        content = (
            f"🌌 **Neue Proxima-Planeten entdeckt ({len(new_planets)})**\n"
            f"{chr(10).join(lines)}"
        )

        # Discord akzeptiert maximal 2000 Zeichen im Content
        payload = {"content": content[:1990]}

        try:
            response = requests.post(self.discord_webhook_url, json=payload, timeout=15)
            response.raise_for_status()
            logging.info(f"Discord-Webhook erfolgreich gesendet ({len(new_planets)} neue Planeten)")
            return True
        except requests.exceptions.RequestException as e:
            logging.error(f"Fehler beim Senden des Discord-Webhook: {e}")
            return False
    
    def get_planets_summary(self):
        """Gibt eine Zusammenfassung der gespeicherten Planeten zurück"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Aktuelle Planeten (neueste Einträge)
            cursor.execute('''
                SELECT name, coordinates, score, delete_on, week_number
                FROM planets p1
                WHERE created_at = (
                    SELECT MAX(created_at) 
                    FROM planets p2 
                    WHERE p2.name = p1.name
                )
                ORDER BY week_number DESC, CAST(SUBSTR(name, INSTR(name, ' ') + 1) AS INTEGER)
            ''')
            
            planets = cursor.fetchall()
            
            # Statistiken
            cursor.execute('SELECT COUNT(DISTINCT name) FROM planets')
            total_planets = cursor.fetchone()[0]
            
            cursor.execute('SELECT MAX(week_number) FROM planets')
            latest_week = cursor.fetchone()[0]
            
            return {
                'planets': planets,
                'total_planets': total_planets,
                'latest_week': latest_week,
                'last_update': datetime.now().strftime("%d.%m.%Y %H:%M")
            }
            
        except Exception as e:
            logging.error(f"Fehler beim Abrufen der Zusammenfassung: {e}")
            return None
        finally:
            conn.close()
    
    def update_planets(self):
        """Hauptfunktion: Lädt und speichert die aktuellen Planetendaten"""
        logging.info("Starte wöchentliche Aktualisierung der Proxima-Daten...")
        
        planets = self.fetch_planets()
        if planets:
            known_planet_names = self.get_known_planet_names()
            new_planets = [
                planet for planet in planets
                if planet.get('name') not in known_planet_names
            ]
            success = self.save_planets(planets)
            if success:
                logging.info("Proxima-Daten erfolgreich aktualisiert")
                if known_planet_names:
                    if new_planets:
                        self.send_discord_webhook_for_new_planets(new_planets)
                    else:
                        logging.info("Keine neuen Proxima-Planeten entdeckt")
                elif self.notify_on_first_sync and new_planets:
                    logging.info("Erst-Sync erkannt - Discord-Benachrichtigung aktiviert")
                    self.send_discord_webhook_for_new_planets(new_planets)
                else:
                    logging.info("Erst-Sync erkannt - Discord-Benachrichtigung übersprungen")
                return True
            else:
                logging.error("Fehler beim Speichern der Proxima-Daten")
                return False
        else:
            logging.error("Keine Daten von der API erhalten")
            return False

    def run_sync(self):
        """Kompatibilitätsmethode für Scheduler: führt Update und Report aus"""
        try:
            if not self.update_planets():
                return False
            html = self.generate_html_report()
            if html:
                with open('proxima_report.html', 'w', encoding='utf-8') as f:
                    f.write(html)
                logging.info("HTML-Report generiert: proxima_report.html")
            return True
        except Exception as e:
            logging.error(f"Proxima run_sync Fehler: {e}")
            return False
    
    def generate_html_report(self):
        """Generiert einen HTML-Bericht der aktuellen Planeten"""
        summary = self.get_planets_summary()
        if not summary:
            return None
        
        html = f"""
<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proxima Sabocounter - Spacenations Tools</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }}
        .header h1 {{
            margin: 0;
            font-size: 2.5em;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }}
        .stats {{
            display: flex;
            justify-content: space-around;
            padding: 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }}
        .stat {{
            text-align: center;
        }}
        .stat-number {{
            font-size: 2em;
            font-weight: bold;
            color: #2a5298;
        }}
        .stat-label {{
            color: #6c757d;
            font-size: 0.9em;
        }}
        .table-container {{
            padding: 20px;
            overflow-x: auto;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }}
        th {{
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
        }}
        tr:hover {{
            background: #f8f9fa;
        }}
        .week-badge {{
            background: #007bff;
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
        }}
        .score-high {{
            color: #28a745;
            font-weight: bold;
        }}
        .score-medium {{
            color: #ffc107;
            font-weight: bold;
        }}
        .score-low {{
            color: #dc3545;
            font-weight: bold;
        }}
        .footer {{
            text-align: center;
            padding: 20px;
            color: #6c757d;
            background: #f8f9fa;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌌 Proxima Sabocounter</h1>
            <p>Spacenations Tools - Planetenverfolgung</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">{summary['total_planets']}</div>
                <div class="stat-label">Planeten</div>
            </div>
            <div class="stat">
                <div class="stat-number">{summary['latest_week']}</div>
                <div class="stat-label">Aktuelle Woche</div>
            </div>
            <div class="stat">
                <div class="stat-number">{summary['last_update']}</div>
                <div class="stat-label">Letzte Aktualisierung</div>
            </div>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Koordinaten</th>
                        <th>Punkte</th>
                        <th>Tag der Zerstörung</th>
                        <th>Woche</th>
                    </tr>
                </thead>
                <tbody>
"""
        
        for planet in summary['planets']:
            name, coordinates, score, delete_on, week_number = planet
            formatted_date = self.format_delete_date(delete_on)
            
            # Score-Kategorisierung
            if score >= 500:
                score_class = "score-high"
            elif score >= 200:
                score_class = "score-medium"
            else:
                score_class = "score-low"
            
            html += f"""
                    <tr>
                        <td><strong>{name}</strong></td>
                        <td><code>{coordinates}</code></td>
                        <td class="{score_class}">{score:,}</td>
                        <td>{formatted_date}</td>
                        <td><span class="week-badge">Woche {week_number}</span></td>
                    </tr>
"""
        
        html += """
                </tbody>
            </table>
        </div>
        
        <div class="footer">
            <p>Automatisch aktualisiert jeden Mittwoch um 17:01:50 Uhr</p>
            <p>Datenquelle: <a href="https://beta1.game.spacenations.eu/api/proxima" target="_blank">Spacenations API</a></p>
        </div>
    </div>
</body>
</html>
"""
        
        return html

def main():
    """Hauptfunktion - startet den Scheduler"""
    fetcher = ProximaFetcher()
    
    # Sofortige Aktualisierung beim Start
    logging.info("Starte Proxima Fetcher...")
    fetcher.update_planets()
    
    # HTML-Report generieren
    html_report = fetcher.generate_html_report()
    if html_report:
        with open('proxima_report.html', 'w', encoding='utf-8') as f:
            f.write(html_report)
        logging.info("HTML-Report generiert: proxima_report.html")
    
    # Scheduler für wöchentliche Updates (Mittwoch 17:01:50)
    schedule.every().wednesday.at("17:01:50").do(fetcher.run_sync)
    
    logging.info("Scheduler gestartet - wöchentliche Updates jeden Mittwoch um 17:01:50")
    
    # Hauptschleife
    while True:
        schedule.run_pending()
        time.sleep(60)  # Prüfe jede Minute

if __name__ == "__main__":
    main()