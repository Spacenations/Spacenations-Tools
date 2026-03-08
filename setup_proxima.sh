#!/bin/bash
# Setup-Skript für den Proxima Fetcher

echo "🌌 Proxima Fetcher Setup"
echo "========================"

# Skript ausführbar machen
echo "🔧 Mache Skripte ausführbar..."
chmod +x proxima_simple.py

# Test-Ausführung
echo "🧪 Führe Test-Ausführung durch..."
python3 proxima_simple.py

# Cron-Job einrichten (Mittwoch 17:01:50)
echo "⏰ Richte Cron-Job ein..."
CRON_JOB="1 17 * * 3 cd $(pwd) && sleep 50 && python3 proxima_simple.py >> proxima_cron.log 2>&1"

# Prüfe ob Cron-Job bereits existiert
if crontab -l 2>/dev/null | grep -q "proxima_simple.py"; then
    echo "⚠️  Cron-Job existiert bereits"
else
    # Füge Cron-Job hinzu
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron-Job hinzugefügt: Mittwoch 17:01:50"
fi

echo ""
echo "🎉 Setup abgeschlossen!"
echo ""
echo "📋 Generierte Dateien:"
echo "   - proxima_report.html (HTML-Report)"
echo "   - proxima_data.json (JSON-Daten für Web-Interface)"
echo "   - proxima.db (SQLite Datenbank)"
echo "   - sabocounter.html (Web-Interface)"
echo ""
echo "📋 Nächste Schritte:"
echo "1. Stelle die Dateien auf deinen Webserver:"
echo "   - sabocounter.html -> https://trend4media.github.io/Spacenations-Tools/sabocounter.html"
echo "   - proxima_data.json -> https://trend4media.github.io/Spacenations-Tools/proxima_data.json"
echo ""
echo "2. Cron-Job überprüfen:"
echo "   crontab -l"
echo ""
echo "3. Logs überwachen:"
echo "   tail -f proxima_cron.log"
echo ""
echo "4. Manuelle Aktualisierung:"
echo "   python3 proxima_simple.py"