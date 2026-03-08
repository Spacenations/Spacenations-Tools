#!/usr/bin/env python3
"""
Vereinfachter Proxima Fetcher ohne externe Abhängigkeiten
Verwendet nur Standard-Bibliotheken
"""

import json
import sqlite3
import urllib.request
import urllib.error
from datetime import datetime, timezone
import os

class ProximaFetcher:
    def __init__(self, db_path='proxima.db'):
        self.api_url = "https://beta1.game.spacenations.eu/api/proxima"
        self.db_path = db_path
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
        print("✅ ProximaDB initialisiert")
    
    def fetch_planets(self):
        """Lädt die aktuellen Planetendaten von der API"""
        try:
            with urllib.request.urlopen(self.api_url, timeout=30) as response:
                data = response.read().decode('utf-8')
                planets = json.loads(data)
                print(f"✅ Erfolgreich {len(planets)} Planeten von der API geladen")
                return planets
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            print(f"❌ Fehler beim Laden der API: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Fehler beim Parsen der JSON-Daten: {e}")
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
            # Konvertiere zu lokaler Zeit
            local_dt = dt.astimezone(timezone.utc)
            return local_dt.strftime("%d.%m.%Y %H:%M")
        except Exception as e:
            print(f"⚠️ Fehler beim Formatieren des Datums {delete_on_str}: {e}")
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
            print(f"✅ Erfolgreich {saved_count} Planeten in der Datenbank gespeichert")
            return True
            
        except Exception as e:
            print(f"❌ Fehler beim Speichern der Daten: {e}")
            conn.rollback()
            return False
        finally:
            conn.close()
    
    def get_planets_summary(self):
        """Gibt eine Zusammenfassung der gespeicherten Planeten zurück"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        try:
            # Aktuelle Planeten (neueste Einträge) nach Punktzahl sortiert
            cursor.execute('''
                SELECT name, coordinates, score, delete_on, week_number
                FROM planets p1
                WHERE created_at = (
                    SELECT MAX(created_at) 
                    FROM planets p2 
                    WHERE p2.name = p1.name
                )
                ORDER BY score DESC
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
            print(f"❌ Fehler beim Abrufen der Zusammenfassung: {e}")
            return None
        finally:
            conn.close()
    
    def update_planets(self):
        """Hauptfunktion: Lädt und speichert die aktuellen Planetendaten"""
        print("🌌 Starte Aktualisierung der Proxima-Daten...")
        
        planets = self.fetch_planets()
        if planets:
            success = self.save_planets(planets)
            if success:
                print("✅ Proxima-Daten erfolgreich aktualisiert")
                return True
            else:
                print("❌ Fehler beim Speichern der Proxima-Daten")
                return False
        else:
            print("❌ Keine Daten von der API erhalten")
            return False
    
    def generate_html_report(self):
        """Generiert einen HTML-Bericht der aktuellen Planeten"""
        summary = self.get_planets_summary()
        if not summary:
            return None
        
        html = f"""<!DOCTYPE html>
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
                <tbody>"""
        
        # Sortiere Planeten nach Punktzahl (höchste zuerst)
        sorted_planets = sorted(summary['planets'], key=lambda x: x[2], reverse=True)
        
        for planet in sorted_planets:
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
                    </tr>"""
        
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
</html>"""
        
        return html

def main():
    """Hauptfunktion - führt eine einmalige Aktualisierung durch"""
    print("🌌 Proxima Fetcher - Einmalige Aktualisierung")
    print("=" * 50)
    
    fetcher = ProximaFetcher()
    
    # Daten aktualisieren
    print("Lade aktuelle Daten von der API...")
    success = fetcher.update_planets()
    
    if success:
        # HTML-Report generieren
        print("Generiere HTML-Report...")
        html_report = fetcher.generate_html_report()
        if html_report:
            with open('proxima_report.html', 'w', encoding='utf-8') as f:
                f.write(html_report)
            print("✅ HTML-Report erstellt: proxima_report.html")
        
        # JSON-Daten für Web-Interface
        print("Generiere JSON-Daten...")
        summary = fetcher.get_planets_summary()
        if summary:
            with open('proxima_data.json', 'w', encoding='utf-8') as f:
                json.dump(summary['planets'], f, ensure_ascii=False, indent=2)
            print("✅ JSON-Daten erstellt: proxima_data.json")
        
        print("\n🎉 Aktualisierung abgeschlossen!")
        print(f"📊 {summary['total_planets']} Planeten aus Woche {summary['latest_week']} geladen")
    else:
        print("\n❌ Aktualisierung fehlgeschlagen!")

if __name__ == "__main__":
    main()