/**
 * NEUE Firebase Konfiguration - Vereinfacht und Robust
 * Ersetzt die bestehende firebase-config.js
 */

// Globale Firebase-Konfiguration
const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDr4-ap_EubUn0UdP7hkEpS2jkzLIVgvyc',
    authDomain: 'spacenations-tools.firebaseapp.com',
    projectId: 'spacenations-tools',
    storageBucket: 'spacenations-tools.firebasestorage.app',
    messagingSenderId: '651338201276',
    appId: '1:651338201276:web:89e7d9c19dbd2611d3f8b9',
    measurementId: 'G-SKWJWH2ERX'
};

// Logger-Integration
const firebaseLog = window.log || {
    firebase: (msg, data) => console.log('🔥 FIREBASE:', msg, data),
    error: (msg, err, data) => console.error('❌ FIREBASE ERROR:', msg, err, data),
    debug: (msg, data) => console.log('🔍 FIREBASE DEBUG:', msg, data)
};

class FirebaseManager {
    constructor() {
        this.app = null;
        this.auth = null;
        this.db = null;
        this.initialized = false;
        this.initPromise = null;
        
        // Sofort initialisieren
        this.initPromise = this.initialize();
    }
    
    async initialize() {
        try {
            firebaseLog.firebase('Starte Firebase-Initialisierung...');
            
            // Prüfe ob Firebase SDK verfügbar ist
            if (typeof firebase === 'undefined') {
                throw new Error('Firebase SDK nicht geladen');
            }
            
            // Lade Konfiguration (API oder Fallback)
            const config = await this.loadConfig();
            
            // Firebase App initialisieren (nur einmal)
            if (!firebase.apps.length) {
                firebaseLog.firebase('Initialisiere Firebase App...');
                this.app = firebase.initializeApp(config);
            } else {
                firebaseLog.firebase('Firebase App bereits initialisiert');
                this.app = firebase.app();
            }
            
            // Services initialisieren
            this.auth = firebase.auth();
            this.db = firebase.firestore();
            
            // Firestore-Einstellungen
            this.db.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            // Teste Verbindung
            await this.testConnection();
            
            this.initialized = true;
            firebaseLog.firebase('Firebase erfolgreich initialisiert', {
                projectId: config.projectId,
                authDomain: config.authDomain
            });
            
            // Event für andere Module
            document.dispatchEvent(new CustomEvent('firebaseReady', {
                detail: { initialized: true, offline: false }
            }));
            
            return true;
            
        } catch (error) {
            firebaseLog.error('Firebase-Initialisierung fehlgeschlagen', error);
            this.initialized = false;
            
            // Event für Fehlerbehandlung
            document.dispatchEvent(new CustomEvent('firebaseError', {
                detail: { error: error.message }
            }));
            
            throw error;
        }
    }
    
    async loadConfig() {
        // Versuche mehrere mögliche Endpunkte in Reihenfolge
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : '';
        const candidates = [
            origin ? `${origin}/api/firebase-config` : '/api/firebase-config',
            'https://spacenations-tools-production.up.railway.app/api/firebase-config'
        ];
        
        for (const url of candidates) {
            try {
                firebaseLog.firebase('Versuche API-Konfiguration zu laden...', { url });
                const response = await fetch(url, { method: 'GET', mode: 'cors' });
                if (response.ok) {
                    const config = await response.json();
                    firebaseLog.firebase('API-Konfiguration geladen', { source: url });
                    return config;
                } else {
                    firebaseLog.debug('API-Konfiguration nicht ok', { url, status: response.status });
                }
            } catch (e) {
                firebaseLog.debug('API-Konfiguration Versuch fehlgeschlagen', { url, error: e?.message });
            }
        }
        
        firebaseLog.firebase('API nicht verfügbar, verwende Fallback-Konfiguration');
        return FIREBASE_CONFIG;
    }
    
    async testConnection() {
        try {
            // Teste Auth-Verbindung
            const authTest = this.auth.currentUser;
            firebaseLog.debug('Auth-Verbindung getestet');
            
            // Teste Firestore-Verbindung
            await this.db.collection('_test').doc('connection').get();
            firebaseLog.debug('Firestore-Verbindung getestet');
            
        } catch (error) {
            firebaseLog.error('Verbindungstest fehlgeschlagen', error);
            // Nicht werfen - Firebase kann trotzdem funktionieren
        }
    }
    
    // Warten bis Firebase bereit ist
    async waitForReady() {
        if (this.initialized) {
            return true;
        }
        
        if (this.initPromise) {
            try {
                await this.initPromise;
                return this.initialized;
            } catch (error) {
                firebaseLog.error('Firebase-Initialisierung fehlgeschlagen beim Warten', error);
                return false;
            }
        }
        
        return false;
    }
    
    // Getter für Services
    getAuth() {
        if (!this.initialized || !this.auth) {
            firebaseLog.error('Firebase Auth nicht verfügbar');
            return null;
        }
        return this.auth;
    }
    
    getDB() {
        if (!this.initialized || !this.db) {
            firebaseLog.error('Firebase Firestore nicht verfügbar');
            return null;
        }
        return this.db;
    }
    
    getApp() {
        return this.app;
    }
    
    getServerTimestamp() {
        if (!this.initialized) {
            return new Date();
        }
        return firebase.firestore.FieldValue.serverTimestamp();
    }
    
    isReady() {
        return this.initialized;
    }
    
    isOffline() {
        return !this.initialized;
    }
}

// Globale Firebase-Manager-Instanz
window.firebaseManager = new FirebaseManager();

// Kompatibilitäts-API für bestehenden Code
window.FirebaseConfig = {
    isReady: () => window.firebaseManager.isReady(),
    isOffline: () => window.firebaseManager.isOffline(),
    getAuth: () => window.firebaseManager.getAuth(),
    getDB: () => window.firebaseManager.getDB(),
    getApp: () => window.firebaseManager.getApp(),
    getServerTimestamp: () => window.firebaseManager.getServerTimestamp(),
    waitForReady: () => window.firebaseManager.waitForReady(),
    waitForReadyWithTimeout: (timeoutMs = 5000) => {
        return new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Firebase-Initialisierung Timeout'));
            }, timeoutMs);
            
            try {
                const ready = await window.firebaseManager.waitForReady();
                clearTimeout(timeout);
                resolve(ready);
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }
};

// Auto-Initialisierung
document.addEventListener('DOMContentLoaded', async () => {
    try {
        firebaseLog.firebase('DOM geladen - starte Firebase-Initialisierung');
        await window.firebaseManager.waitForReady();
        firebaseLog.firebase('Firebase bereit für Anwendung');
    } catch (error) {
        firebaseLog.error('Firebase-Auto-Initialisierung fehlgeschlagen', error);
    }
});

// Backup-Initialisierung
window.addEventListener('load', async () => {
    if (!window.firebaseManager.isReady()) {
        firebaseLog.firebase('Backup-Initialisierung gestartet');
        try {
            await window.firebaseManager.waitForReady();
            firebaseLog.firebase('Backup-Initialisierung erfolgreich');
        } catch (error) {
            firebaseLog.error('Backup-Initialisierung fehlgeschlagen', error);
        }
    }
});