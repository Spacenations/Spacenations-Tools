/**
 * NEUER Analytics Tracker - Vereinfacht und Robust
 * Ersetzt den bestehenden analytics-tracker.js
 */

class AnalyticsTracker {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.isInitialized = false;
        this.firebaseReady = false;
        this.permissionsDenied = false;
        
        // Initialisierung starten
        this.init();
    }
    
    async init() {
        try {
            // Warten bis Firebase verfügbar ist
            await this.waitForFirebase();
            
            // Teste Berechtigungen
            await this.testPermissions();
            
            if (this.firebaseReady) {
                console.log('📊 Analytics Tracker initialisiert (Firebase)');
                this.trackPageView();
            } else {
                console.log('📊 Analytics Tracker initialisiert (Lokal)');
                this.trackPageViewLocally();
            }
            
            this.isInitialized = true;
            this.setupEventListeners();
            
        } catch (error) {
            console.error('❌ Analytics Tracker Initialisierung fehlgeschlagen:', error);
            this.isInitialized = false;
            this.firebaseReady = false;
            
            // Fallback: Lokaler Modus
            console.warn('⚠️ Analytics läuft im lokalen Modus');
            this.trackPageViewLocally();
        }
    }
    
    async waitForFirebase() {
        if (!window.FirebaseConfig) {
            await new Promise(resolve => {
                const checkFirebase = setInterval(() => {
                    if (window.FirebaseConfig) {
                        clearInterval(checkFirebase);
                        resolve();
                    }
                }, 100);
                
                // Timeout nach 5 Sekunden
                setTimeout(() => {
                    clearInterval(checkFirebase);
                    resolve();
                }, 5000);
            });
        }
        
        if (window.FirebaseConfig) {
            try {
                await window.FirebaseConfig.waitForReadyWithTimeout(5000);
            } catch (error) {
                console.warn('⚠️ Firebase-Timeout, verwende lokalen Modus');
            }
        }
    }
    
    async testPermissions() {
        // Rein lokale Prüfung, kein Schreib-Roundtrip auf eine eigens dafür angelegte
        // Test-Collection: analytics_pageViews/_sessions/_events haben in firestore.rules
        // bereits eine feste Regel (jeder angemeldete Nutzer darf schreiben), ein separater
        // Vorab-Test auf einer fremden "_test"-Collection sagt darüber nichts aus.
        if (!window.FirebaseConfig || window.FirebaseConfig.isOffline()) {
            this.firebaseReady = false;
            return;
        }

        const db = window.FirebaseConfig.getDB();
        this.firebaseReady = !!db;
        console.log(this.firebaseReady ? '✅ Analytics: Firestore verfügbar' : '⚠️ Analytics: Firestore nicht verfügbar');
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // Seitenaufruf erfassen
    trackPageView(pagePath = null) {
        const pageData = {
            sessionId: this.sessionId,
            page: pagePath || window.location.pathname,
            title: document.title,
            referrer: document.referrer || 'direct',
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            url: window.location.href
        };
        
        if (this.firebaseReady) {
            this.savePageView(pageData);
        } else {
            this.trackPageViewLocally(pageData);
        }
        
        console.log('📊 Seitenaufruf erfasst:', pageData.page);
    }
    
    // Seitenaufruf in Firebase speichern
    async savePageView(pageData) {
        try {
            const db = window.FirebaseConfig.getDB();
            await db.collection('analytics_pageViews').add({
                ...pageData,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });
        } catch (error) {
            console.error('❌ Fehler beim Speichern des Seitenaufrufs:', error);
            // Fallback: Lokal speichern
            this.trackPageViewLocally(pageData);
        }
    }
    
    // Seitenaufruf lokal speichern
    trackPageViewLocally(pageData = null) {
        try {
            if (!pageData) {
                pageData = {
                    sessionId: this.sessionId,
                    page: window.location.pathname,
                    title: document.title,
                    referrer: document.referrer || 'direct',
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                };
            }
            
            const localViews = JSON.parse(localStorage.getItem('analytics_pageViews') || '[]');
            localViews.push(pageData);
            
            // Nur die letzten 50 Views behalten
            if (localViews.length > 50) {
                localViews.splice(0, localViews.length - 50);
            }
            
            localStorage.setItem('analytics_pageViews', JSON.stringify(localViews));
            console.log('📊 Seitenaufruf lokal erfasst:', pageData.page);
            
        } catch (error) {
            console.warn('⚠️ Lokales Tracking fehlgeschlagen:', error);
        }
    }
    
    // Event erfassen
    trackEvent(eventType, data = {}) {
        const eventData = {
            sessionId: this.sessionId,
            type: eventType,
            data: data,
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        };
        
        if (this.firebaseReady && !this.permissionsDenied) {
            this.saveEvent(eventData);
        } else {
            this.saveEventLocally(eventData);
        }
        
        console.log('📊 Event erfasst:', eventType);
    }
    
    // Event in Firebase speichern
    async saveEvent(eventData) {
        try {
            const db = window.FirebaseConfig.getDB();
            await db.collection('analytics_events').add({
                ...eventData,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });
        } catch (error) {
            console.error('❌ Fehler beim Speichern des Events:', error);
            
            // Bei Berechtigungsfehlern: Dauerhaft auf lokal umschalten
            if (error.code === 'permission-denied' || error.message.includes('permissions')) {
                console.warn('⚠️ Analytics dauerhaft auf lokalen Modus umgeschaltet');
                this.permissionsDenied = true;
                this.firebaseReady = false;
            }
            
            // Fallback: Lokal speichern
            this.saveEventLocally(eventData);
        }
    }
    
    // Event lokal speichern
    saveEventLocally(eventData) {
        try {
            const localEvents = JSON.parse(localStorage.getItem('analytics_events') || '[]');
            localEvents.push(eventData);
            
            // Nur die letzten 100 Events behalten
            if (localEvents.length > 100) {
                localEvents.splice(0, localEvents.length - 100);
            }
            
            localStorage.setItem('analytics_events', JSON.stringify(localEvents));
            
        } catch (error) {
            console.warn('⚠️ Lokales Event-Speichern fehlgeschlagen:', error);
        }
    }
    
    // Event-Listener einrichten
    setupEventListeners() {
        // Scroll-Tracking
        let scrollDepth = 0;
        window.addEventListener('scroll', () => {
            const depth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
            if (depth > scrollDepth && depth % 25 === 0) {
                scrollDepth = depth;
                this.trackEvent('scroll_depth', { depth });
            }
        });
        
        // Click-Tracking für wichtige Elemente
        document.addEventListener('click', (e) => {
            if (e.target.matches('button, .btn, a[href]')) {
                this.trackEvent('click', {
                    element: e.target.tagName,
                    text: e.target.textContent?.substring(0, 50),
                    href: e.target.href || null
                });
            }
        });
        
        // Form-Submit-Tracking
        document.addEventListener('submit', (e) => {
            this.trackEvent('form_submit', {
                formId: e.target.id || 'unknown',
                action: e.target.action || window.location.href
            });
        });
        
        // Page-Unload-Tracking
        window.addEventListener('beforeunload', () => {
            this.endSession();
        });
    }
    
    // Session beenden
    endSession() {
        if (this.firebaseReady && !this.permissionsDenied) {
            // Versuche Firebase-Session zu beenden
            try {
                const db = window.FirebaseConfig.getDB();
                if (db) {
                    db.collection('analytics_sessions').doc(this.sessionId).update({
                        endTime: window.FirebaseConfig.getServerTimestamp(),
                        duration: Date.now() - this.startTime
                    }).catch(error => {
                        console.warn('⚠️ Session-Ende nicht gespeichert:', error);
                    });
                }
            } catch (error) {
                console.warn('⚠️ Firebase-Session-Ende fehlgeschlagen:', error);
            }
        }
        
        // Lokale Session beenden
        try {
            const sessionData = {
                sessionId: this.sessionId,
                endTime: new Date().toISOString(),
                duration: Date.now() - this.startTime
            };
            
            localStorage.setItem('analytics_lastSession', JSON.stringify(sessionData));
        } catch (error) {
            console.warn('⚠️ Lokale Session-Ende fehlgeschlagen:', error);
        }
        
        console.log('📊 Session beendet');
    }
    
    // Lokale Analytics-Daten abrufen
    getLocalAnalytics() {
        try {
            return {
                events: JSON.parse(localStorage.getItem('analytics_events') || '[]'),
                pageViews: JSON.parse(localStorage.getItem('analytics_pageViews') || '[]'),
                lastSession: JSON.parse(localStorage.getItem('analytics_lastSession') || '{}')
            };
        } catch (error) {
            console.warn('⚠️ Fehler beim Abrufen lokaler Analytics:', error);
            return { events: [], pageViews: [], lastSession: {} };
        }
    }
    
    // Status abrufen
    getStatus() {
        return {
            initialized: this.isInitialized,
            firebaseReady: this.firebaseReady,
            permissionsDenied: this.permissionsDenied,
            sessionId: this.sessionId,
            startTime: this.startTime
        };
    }
}

// Globale Analytics-Instanz
window.analyticsTracker = new AnalyticsTracker();

// Vereinfachte API
window.AnalyticsAPI = {
    trackEvent: (type, data) => window.analyticsTracker.trackEvent(type, data),
    trackPageView: (path) => window.analyticsTracker.trackPageView(path),
    getStatus: () => window.analyticsTracker.getStatus(),
    getLocalData: () => window.analyticsTracker.getLocalAnalytics(),
    getAnalyticsData: (timeRange = '7d') => {
        // Mock-Funktion für Analytics-Dashboard
        return Promise.resolve({
            pageViews: [],
            events: [],
            sessions: [],
            summary: {
                totalPageViews: 0,
                totalEvents: 0,
                totalSessions: 0
            }
        });
    }
};