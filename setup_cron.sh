#!/bin/bash
# Setup-Skript für den Proxima Fetcher Cron-Job

echo "🌌 Proxima Fetcher Setup"
echo "========================"

# Python-Abhängigkeiten installieren
echo "📦 Installiere Python-Abhängigkeiten..."
pip3 install -r requirements.txt

# Skript ausführbar machen
echo "🔧 Mache Skripte ausführbar..."
chmod +x proxima_fetcher.py
chmod +x run_fetcher.py

# Cron-Job einrichten (Mittwoch 17:01:50)
echo "⏰ Richte Cron-Job ein..."
CRON_JOB="1 17 * * 3 cd $(pwd) && sleep 50 && python3 run_fetcher.py >> proxima_cron.log 2>&1"

# Prüfe ob Cron-Job bereits existiert
if crontab -l 2>/dev/null | grep -q "run_fetcher.py"; then
    echo "⚠️  Cron-Job existiert bereits"
else
    # Füge Cron-Job hinzu
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "✅ Cron-Job hinzugefügt: Mittwoch 17:01:50"
fi

# Test-Ausführung
echo "🧪 Führe Test-Ausführung durch..."
python3 run_fetcher.py

echo ""
echo "🎉 Setup abgeschlossen!"
echo ""
echo "📋 Nächste Schritte:"
echo "1. Überprüfe die generierten Dateien:"
echo "   - proxima_report.html (HTML-Report)"
echo "   - proxima_data.json (JSON-Daten)"
echo "   - proxima.db (SQLite Datenbank)"
echo ""
echo "2. Stelle die Dateien auf deinen Webserver:"
echo "   - sabocounter.html -> https://trend4media.github.io/Spacenations-Tools/sabocounter.html"
echo "   - proxima_data.json -> https://trend4media.github.io/Spacenations-Tools/proxima_data.json"
echo ""
echo "3. Cron-Job überprüfen:"
echo "   crontab -l"
echo ""
echo "4. Logs überwachen:"
echo "   tail -f proxima_fetcher.log"
echo "   tail -f proxima_cron.log"