#!/usr/bin/env python3
"""
Spacenations Tools - Railway Deployment Server
Hauptserver für die Space Nations Tools Web-Anwendung
"""

import os
import sys
import json
import logging
import mimetypes
from http.server import HTTPServer, ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import threading
import time
from datetime import datetime

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Dokumenten-Wurzel: aus ihr (und nur aus ihr) werden Dateien ausgeliefert.
BASE_DIR = os.path.realpath(os.getcwd())


class SpacenationsRequestHandler(SimpleHTTPRequestHandler):
    """Custom Request Handler für Space Nations Tools"""

    # Quell-/Config-/Daten-Dateien werden NICHT über HTTP ausgeliefert,
    # auch wenn sie in der Dokumenten-Wurzel liegen (Defense-in-Depth,
    # zusätzlich zum Path-Traversal-Schutz in _resolve_within_root).
    FORBIDDEN_EXTS = {
        '.py', '.pyc', '.pyo', '.pyd', '.db', '.sqlite', '.sqlite3',
        '.sh', '.toml', '.lock', '.rules', '.yml', '.yaml', '.md',
        '.txt', '.log', '.ini', '.cfg', '.bak', '.example',
    }
    FORBIDDEN_NAMES = {
        'Dockerfile', 'Dockerfile.railway', 'Procfile',
        'package.json', 'package-lock.json', 'yarn.lock',
        'firebase.json', 'pyproject.toml',
    }
    # Erlaubte statische Verzeichnisse (für 404 statt SPA-Fallback bei Assets)
    STATIC_DIRS = ('assets', 'css', 'js', 'images', 'fonts')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BASE_DIR, **kwargs)

    # ------------------------------------------------------------------
    # Sichere Pfad-Auflösung
    # ------------------------------------------------------------------
    def _resolve_within_root(self, path):
        """
        Löst einen angefragten Pfad zu einem absoluten Pfad INNERHALB von
        BASE_DIR auf. Gibt None zurück, wenn der Pfad ausbrechen würde
        (Path-Traversal) oder ungültig ist.
        """
        decoded = unquote(path or '')
        if '\x00' in decoded:
            return None
        rel = decoded.lstrip('/')
        candidate = os.path.realpath(os.path.join(BASE_DIR, rel))
        if candidate == BASE_DIR or candidate.startswith(BASE_DIR + os.sep):
            return candidate
        return None

    def _is_forbidden(self, rel):
        """True, wenn diese Datei nicht ausgeliefert werden darf (Quelle/Config)."""
        base = os.path.basename(rel)
        if base.startswith('.'):            # Dotfiles (.env, .gitignore, .firebaserc, ...)
            return True
        if base in self.FORBIDDEN_NAMES:
            return True
        ext = os.path.splitext(base)[1].lower()
        return ext in self.FORBIDDEN_EXTS

    def _content_type(self, path):
        lower = path.lower()
        if lower.endswith('.html') or lower.endswith('.htm'):
            return 'text/html; charset=utf-8'
        if lower.endswith('.css'):
            return 'text/css; charset=utf-8'
        if lower.endswith('.js') or lower.endswith('.mjs'):
            return 'application/javascript; charset=utf-8'
        if lower.endswith('.json'):
            return 'application/json; charset=utf-8'
        if lower.endswith('.svg'):
            return 'image/svg+xml'
        guessed, _ = mimetypes.guess_type(path)
        return guessed or 'application/octet-stream'

    def _send_security_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')

    def do_GET(self):
        """GET Request Handler"""
        try:
            parsed_path = urlparse(self.path)
            path = parsed_path.path

            # Root path -> index.html
            if path == '/' or path == '':
                self.serve_file('index.html')
                return

            # API Endpoints
            if path.startswith('/api/'):
                self.handle_api_request(path, parsed_path.query)
                return

            # Static files (mit Path-Traversal-Schutz)
            if self.serve_static_file(path):
                return

            # Fallback zu index.html für SPA-Routing (nur für Nicht-Asset-Pfade)
            if not any(path.startswith('/' + d + '/') for d in self.STATIC_DIRS):
                self.serve_file('index.html')
                return

        except Exception as e:
            logger.error(f"Error handling GET request: {e}")
            self.send_error(500, "Internal Server Error")

    def do_POST(self):
        """POST Request Handler"""
        try:
            parsed_path = urlparse(self.path)
            path = parsed_path.path

            if path.startswith('/api/'):
                self.handle_api_post(path)
                return

            self.send_error(404, "Not Found")

        except Exception as e:
            logger.error(f"Error handling POST request: {e}")
            self.send_error(500, "Internal Server Error")

    def serve_file(self, filename):
        """Serve a specific file (immer innerhalb der Dokumenten-Wurzel)."""
        target = self._resolve_within_root(filename)
        rel = unquote(filename or '').lstrip('/')
        if target is None or self._is_forbidden(rel):
            self.send_error(403, "Forbidden")
            return False
        try:
            if os.path.isfile(target):
                with open(target, 'rb') as f:
                    content = f.read()
                self.send_response(200)
                self.send_header('Content-Type', self._content_type(target))
                self.send_header('Content-Length', str(len(content)))
                self._send_security_headers()
                self.end_headers()
                self.wfile.write(content)
                return True
            else:
                self.send_error(404, "File not found")
                return False
        except Exception as e:
            logger.error(f"Error serving file {filename}: {e}")
            self.send_error(500, "Internal Server Error")
            return False

    def serve_static_file(self, path):
        """
        Serve static files. Gibt True zurück, wenn die Anfrage behandelt wurde
        (ausgeliefert, 403 oder 404 für Assets), sonst False (→ SPA-Fallback).
        """
        target = self._resolve_within_root(path)
        rel = unquote(path or '').lstrip('/')

        # Path-Traversal-Versuch -> geblockt
        if target is None:
            self.send_error(403, "Forbidden")
            return True

        # Quell-/Config-Dateien immer explizit blocken (kein SPA-Fallback)
        if self._is_forbidden(rel):
            self.send_error(403, "Forbidden")
            return True

        if os.path.isfile(target):
            return self.serve_file(path)

        # Fehlende Datei unterhalb eines statischen Verzeichnisses -> 404
        # (kein SPA-Fallback für /assets//css//js//images//fonts/)
        if any(rel.startswith(d + '/') for d in self.STATIC_DIRS):
            self.send_error(404, "File not found")
            return True

        return False

    def handle_api_request(self, path, query_string):
        """Handle API requests"""
        try:
            if path == '/api/health':
                self.handle_health_check()
            elif path == '/api/status':
                self.handle_status_check()
            elif path == '/api/firebase-config':
                self.handle_firebase_config()
            else:
                self.send_error(404, "API endpoint not found")

        except Exception as e:
            logger.error(f"Error handling API request {path}: {e}")
            self.send_error(500, "API Error")

    def handle_api_post(self, path):
        """Handle API POST requests"""
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)

            if path == '/api/proxima/sync':
                self.handle_proxima_sync(post_data)
            else:
                self.send_error(404, "API endpoint not found")

        except Exception as e:
            logger.error(f"Error handling API POST {path}: {e}")
            self.send_error(500, "API Error")

    def handle_health_check(self):
        """Health check endpoint"""
        health_data = {
            "status": "healthy",
            "timestamp": datetime.now().isoformat(),
            "service": "spacenations-tools",
            "version": "1.0.0"
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(health_data).encode())

    def handle_status_check(self):
        """Status check endpoint"""
        status_data = {
            "service": "spacenations-tools",
            "status": "running",
            "uptime": time.time() - start_time,
            "environment": os.getenv('RAILWAY_ENVIRONMENT', 'development'),
            "port": os.getenv('PORT', '8000')
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(status_data).encode())

    def handle_firebase_config(self):
        """Firebase configuration endpoint"""
        firebase_config = {
            "apiKey": os.getenv('FIREBASE_API_KEY', 'AIzaSyDr4-ap_EubUn0UdP7hkEpS2jkzLIVgvyc'),
            "authDomain": os.getenv('FIREBASE_AUTH_DOMAIN', 'spacenations-tools.firebaseapp.com'),
            "projectId": os.getenv('FIREBASE_PROJECT_ID', 'spacenations-tools'),
            "storageBucket": os.getenv('FIREBASE_STORAGE_BUCKET', 'spacenations-tools.firebasestorage.app'),
            "messagingSenderId": os.getenv('FIREBASE_MESSAGING_SENDER_ID', '651338201276'),
            "appId": os.getenv('FIREBASE_APP_ID', '1:651338201276:web:89e7d9c19dbd2611d3f8b9'),
            "measurementId": "G-SKWJWH2ERX"
        }

        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(firebase_config).encode())

    def handle_proxima_sync(self, post_data):
        """Handle Proxima sync requests"""
        try:
            # Placeholder for Proxima sync logic
            response_data = {
                "success": True,
                "message": "Proxima sync initiated",
                "timestamp": datetime.now().isoformat()
            }

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode())

        except Exception as e:
            logger.error(f"Error in Proxima sync: {e}")
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": False,
                "error": "Internal Server Error",
                "timestamp": datetime.now().isoformat()
            }).encode())

    def log_message(self, format, *args):
        """Custom log message format"""
        logger.info(f"{self.address_string()} - {format % args}")


def start_proxima_scheduler():
    """Start Proxima data scheduler in background thread"""
    def scheduler():
        while True:
            try:
                # Import and run Proxima fetcher
                try:
                    from proxima_fetcher import ProximaFetcher
                    fetcher = ProximaFetcher()
                    fetcher.run_sync()
                    logger.info("Proxima sync completed successfully")
                except ImportError:
                    logger.warning("Proxima fetcher not available")
                except Exception as e:
                    logger.error(f"Proxima sync error: {e}")

                time.sleep(3600)  # Run every hour
            except Exception as e:
                logger.error(f"Proxima scheduler error: {e}")
                time.sleep(60)  # Wait 1 minute on error

    thread = threading.Thread(target=scheduler, daemon=True)
    thread.start()
    logger.info("Proxima scheduler started")


def main():
    """Main application entry point"""
    global start_time
    start_time = time.time()

    # Get port from environment (Railway sets this)
    port = int(os.getenv('PORT', 8000))

    # Create server (ThreadingHTTPServer: eine langsame Anfrage blockiert nicht alle)
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, SpacenationsRequestHandler)

    # Start Proxima scheduler
    start_proxima_scheduler()

    logger.info(f"🚀 Spacenations Tools Server starting on port {port}")
    logger.info(f"🌍 Environment: {os.getenv('RAILWAY_ENVIRONMENT', 'development')}")
    logger.info(f"📁 Working directory: {BASE_DIR}")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("🛑 Server shutting down...")
        httpd.shutdown()
    except Exception as e:
        logger.error(f"❌ Server error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
