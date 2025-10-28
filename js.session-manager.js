/**
 * Session Manager - Zentrale Verwaltung für Session-Daten
 * Standardisiert localStorage/sessionStorage Verwendung
 */

class SessionManager {
    constructor() {
        this.STORAGE_KEYS = {
            // User-Daten
            USERNAME: 'spacenations_username',
            USER_EMAIL: 'spacenations_user_email',
            USER_DATA: 'spacenations_user_data',
            CURRENT_USER: 'spacenations_current_user',
            
            // Session-Daten
            LOGIN_SUCCESS: 'spacenations_login_success',
            LOGOUT_SUCCESS: 'spacenations_logout_success',
            SESSION_ACTIVE: 'spacenations_session_active',
            LAST_ACTIVITY: 'spacenations_last_activity',
            
            // Allianz-Daten
            CURRENT_ALLIANCE: 'spacenations_current_alliance',
            ALLIANCE_PERMISSIONS: 'spacenations_alliance_permissions',
            
            // Theme
            THEME: 'spacenations_theme',
            
            // Tool-Daten
            AS_COUNTER_DATA: 'spacenations_as_counter',
            RAID_COUNTER_DATA: 'spacenations_raid_counter',
            SABO_COUNTER_DATA: 'spacenations_sabo_counter',
            
            // Dashboard-URLs
            DASHBOARD_URL: 'spacenations_dashboard_url',
            
            // Branch/Version
            BRANCH: 'spacenations_branch'
        };
        
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 Minuten
        this.WARNING_TIME = 25 * 60 * 1000; // 25 Minuten
        
        this.init();
    }
    
    init() {
        // Session-Timeout überwachen
        this.startSessionMonitoring();
        
        // Activity-Tracking starten
        this.startActivityTracking();
        
        console.log('📱 SessionManager initialisiert');
    }
    
    // ===== USER-DATEN MANAGEMENT =====
    
    setUserData(user, userData) {
        try {
            // Session-Storage (temporär)
            sessionStorage.setItem(this.STORAGE_KEYS.USERNAME, userData?.username || user?.email || '');
            sessionStorage.setItem(this.STORAGE_KEYS.USER_EMAIL, user?.email || '');
            sessionStorage.setItem(this.STORAGE_KEYS.CURRENT_USER, JSON.stringify({
                uid: user?.uid,
                email: user?.email,
                emailVerified: user?.emailVerified
            }));
            
            // Local-Storage (persistent)
            if (userData) {
                localStorage.setItem(this.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
            }
            
            // Session als aktiv markieren
            this.setSessionActive(true);
            this.updateLastActivity();
            
            console.log('✅ User-Daten gespeichert:', userData?.username || user?.email);
            
        } catch (error) {
            console.error('❌ Fehler beim Speichern der User-Daten:', error);
        }
    }
    
    getUserData() {
        try {
            const username = sessionStorage.getItem(this.STORAGE_KEYS.USERNAME);
            const email = sessionStorage.getItem(this.STORAGE_KEYS.USER_EMAIL);
            const userJson = sessionStorage.getItem(this.STORAGE_KEYS.CURRENT_USER);
            const userDataJson = localStorage.getItem(this.STORAGE_KEYS.USER_DATA);
            
            const user = userJson ? JSON.parse(userJson) : null;
            const userData = userDataJson ? JSON.parse(userDataJson) : null;
            
            return { user, userData, username, email };
            
        } catch (error) {
            console.error('❌ Fehler beim Laden der User-Daten:', error);
            return { user: null, userData: null, username: null, email: null };
        }
    }
    
    clearUserData() {
        try {
            // Session-Storage leeren
            sessionStorage.removeItem(this.STORAGE_KEYS.USERNAME);
            sessionStorage.removeItem(this.STORAGE_KEYS.USER_EMAIL);
            sessionStorage.removeItem(this.STORAGE_KEYS.CURRENT_USER);
            
            // Local-Storage leeren
            localStorage.removeItem(this.STORAGE_KEYS.USER_DATA);
            localStorage.removeItem(this.STORAGE_KEYS.CURRENT_ALLIANCE);
            localStorage.removeItem(this.STORAGE_KEYS.ALLIANCE_PERMISSIONS);
            
            // Session als inaktiv markieren
            this.setSessionActive(false);
            
            console.log('✅ User-Daten gelöscht');
            
        } catch (error) {
            console.error('❌ Fehler beim Löschen der User-Daten:', error);
        }
    }
    
    // ===== SESSION MANAGEMENT =====
    
    setSessionActive(active) {
        sessionStorage.setItem(this.STORAGE_KEYS.SESSION_ACTIVE, active.toString());
    }
    
    isSessionActive() {
        const active = sessionStorage.getItem(this.STORAGE_KEYS.SESSION_ACTIVE);
        return active === 'true';
    }
    
    updateLastActivity() {
        sessionStorage.setItem(this.STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString());
    }
    
    getLastActivity() {
        const lastActivity = sessionStorage.getItem(this.STORAGE_KEYS.LAST_ACTIVITY);
        return lastActivity ? parseInt(lastActivity) : 0;
    }
    
    getSessionTimeRemaining() {
        const lastActivity = this.getLastActivity();
        const timeSinceActivity = Date.now() - lastActivity;
        const timeRemaining = this.SESSION_TIMEOUT - timeSinceActivity;
        return Math.max(0, timeRemaining);
    }
    
    isSessionExpired() {
        return this.getSessionTimeRemaining() <= 0;
    }
    
    isSessionWarning() {
        const timeRemaining = this.getSessionTimeRemaining();
        return timeRemaining <= (this.SESSION_TIMEOUT - this.WARNING_TIME);
    }
    
    // ===== ALLIANZ-DATEN MANAGEMENT =====
    
    setAllianceData(allianceData) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.CURRENT_ALLIANCE, JSON.stringify(allianceData));
            console.log('✅ Allianz-Daten gespeichert:', allianceData?.name);
        } catch (error) {
            console.error('❌ Fehler beim Speichern der Allianz-Daten:', error);
        }
    }
    
    getAllianceData() {
        try {
            const allianceJson = localStorage.getItem(this.STORAGE_KEYS.CURRENT_ALLIANCE);
            return allianceJson ? JSON.parse(allianceJson) : null;
        } catch (error) {
            console.error('❌ Fehler beim Laden der Allianz-Daten:', error);
            return null;
        }
    }
    
    // ===== MESSAGE MANAGEMENT =====
    
    setLoginSuccess(message = 'Login erfolgreich!') {
        sessionStorage.setItem(this.STORAGE_KEYS.LOGIN_SUCCESS, message);
    }
    
    getLoginSuccess() {
        const message = sessionStorage.getItem(this.STORAGE_KEYS.LOGIN_SUCCESS);
        if (message) {
            sessionStorage.removeItem(this.STORAGE_KEYS.LOGIN_SUCCESS);
            return message;
        }
        return null;
    }
    
    setLogoutSuccess(message = 'Logout erfolgreich!') {
        sessionStorage.setItem(this.STORAGE_KEYS.LOGOUT_SUCCESS, message);
    }
    
    getLogoutSuccess() {
        const message = sessionStorage.getItem(this.STORAGE_KEYS.LOGOUT_SUCCESS);
        if (message) {
            sessionStorage.removeItem(this.STORAGE_KEYS.LOGOUT_SUCCESS);
            return message;
        }
        return null;
    }
    
    // ===== TOOL-DATEN MANAGEMENT =====
    
    setToolData(toolName, data) {
        try {
            const key = this.STORAGE_KEYS[toolName.toUpperCase() + '_DATA'];
            if (key) {
                localStorage.setItem(key, JSON.stringify(data));
                console.log(`✅ ${toolName}-Daten gespeichert`);
            }
        } catch (error) {
            console.error(`❌ Fehler beim Speichern der ${toolName}-Daten:`, error);
        }
    }
    
    getToolData(toolName) {
        try {
            const key = this.STORAGE_KEYS[toolName.toUpperCase() + '_DATA'];
            if (key) {
                const dataJson = localStorage.getItem(key);
                return dataJson ? JSON.parse(dataJson) : null;
            }
        } catch (error) {
            console.error(`❌ Fehler beim Laden der ${toolName}-Daten:`, error);
        }
        return null;
    }
    
    // ===== THEME MANAGEMENT =====
    
    setTheme(theme) {
        localStorage.setItem(this.STORAGE_KEYS.THEME, theme);
    }
    
    getTheme() {
        return localStorage.getItem(this.STORAGE_KEYS.THEME) || 'dark';
    }
    
    // ===== SESSION MONITORING =====
    
    startSessionMonitoring() {
        setInterval(() => {
            if (this.isSessionActive() && this.isSessionExpired()) {
                console.log('⏰ Session abgelaufen');
                this.handleSessionExpired();
            }
        }, 60000); // Jede Minute prüfen
    }
    
    startActivityTracking() {
        // Activity-Events tracken
        const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        
        const updateActivity = () => {
            if (this.isSessionActive()) {
                this.updateLastActivity();
            }
        };
        
        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, true);
        });
    }
    
    handleSessionExpired() {
        // Session als inaktiv markieren
        this.setSessionActive(false);
        
        // User-Daten löschen
        this.clearUserData();
        
        // Event für andere Komponenten
        window.dispatchEvent(new CustomEvent('sessionExpired'));
        
        // Automatische Weiterleitung zur Startseite
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
    
    // ===== UTILITY FUNCTIONS =====
    
    clearAllSessionData() {
        try {
            // Alle Session-Storage Keys löschen
            Object.values(this.STORAGE_KEYS).forEach(key => {
                sessionStorage.removeItem(key);
            });
            
            // Spezifische Local-Storage Keys löschen
            const localKeys = [
                this.STORAGE_KEYS.USER_DATA,
                this.STORAGE_KEYS.CURRENT_ALLIANCE,
                this.STORAGE_KEYS.ALLIANCE_PERMISSIONS,
                this.STORAGE_KEYS.AS_COUNTER_DATA,
                this.STORAGE_KEYS.RAID_COUNTER_DATA,
                this.STORAGE_KEYS.SABO_COUNTER_DATA,
                this.STORAGE_KEYS.DASHBOARD_URL
            ];
            
            localKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log('✅ Alle Session-Daten gelöscht');
            
        } catch (error) {
            console.error('❌ Fehler beim Löschen aller Session-Daten:', error);
        }
    }
    
    exportSessionData() {
        try {
            const sessionData = {
                user: this.getUserData(),
                alliance: this.getAllianceData(),
                theme: this.getTheme(),
                timestamp: new Date().toISOString()
            };
            
            return JSON.stringify(sessionData, null, 2);
            
        } catch (error) {
            console.error('❌ Fehler beim Exportieren der Session-Daten:', error);
            return null;
        }
    }
    
    // ===== LEGACY SUPPORT =====
    
    migrateLegacyData() {
        try {
            // Alte Keys zu neuen Keys migrieren
            const legacyMappings = {
                'currentUsername': this.STORAGE_KEYS.USERNAME,
                'currentUserEmail': this.STORAGE_KEYS.USER_EMAIL,
                'userAlliance': this.STORAGE_KEYS.CURRENT_ALLIANCE,
                'theme': this.STORAGE_KEYS.THEME,
                'spacenations-theme': this.STORAGE_KEYS.THEME
            };
            
            Object.entries(legacyMappings).forEach(([oldKey, newKey]) => {
                const oldValue = localStorage.getItem(oldKey) || sessionStorage.getItem(oldKey);
                if (oldValue && !localStorage.getItem(newKey) && !sessionStorage.getItem(newKey)) {
                    if (oldKey.includes('Username') || oldKey.includes('Email')) {
                        sessionStorage.setItem(newKey, oldValue);
                    } else {
                        localStorage.setItem(newKey, oldValue);
                    }
                    console.log(`✅ Migriert: ${oldKey} → ${newKey}`);
                }
            });
            
        } catch (error) {
            console.error('❌ Fehler bei Legacy-Daten-Migration:', error);
        }
    }
}

// Globale SessionManager-Instanz erstellen
window.sessionManager = new SessionManager();

// Legacy-Migration beim Laden
document.addEventListener('DOMContentLoaded', () => {
    window.sessionManager.migrateLegacyData();
});

// Globale API für einfache Nutzung
window.SessionAPI = {
    // User-Daten
    setUserData: (user, userData) => window.sessionManager.setUserData(user, userData),
    getUserData: () => window.sessionManager.getUserData(),
    clearUserData: () => window.sessionManager.clearUserData(),
    
    // Session-Status
    isSessionActive: () => window.sessionManager.isSessionActive(),
    setSessionActive: (active) => window.sessionManager.setSessionActive(active),
    getSessionTimeRemaining: () => window.sessionManager.getSessionTimeRemaining(),
    isSessionExpired: () => window.sessionManager.isSessionExpired(),
    isSessionWarning: () => window.sessionManager.isSessionWarning(),
    
    // Allianz-Daten
    setAllianceData: (data) => window.sessionManager.setAllianceData(data),
    getAllianceData: () => window.sessionManager.getAllianceData(),
    
    // Messages
    setLoginSuccess: (message) => window.sessionManager.setLoginSuccess(message),
    getLoginSuccess: () => window.sessionManager.getLoginSuccess(),
    setLogoutSuccess: (message) => window.sessionManager.setLogoutSuccess(message),
    getLogoutSuccess: () => window.sessionManager.getLogoutSuccess(),
    
    // Tool-Daten
    setToolData: (toolName, data) => window.sessionManager.setToolData(toolName, data),
    getToolData: (toolName) => window.sessionManager.getToolData(toolName),
    
    // Theme
    setTheme: (theme) => window.sessionManager.setTheme(theme),
    getTheme: () => window.sessionManager.getTheme(),
    
    // Utility
    clearAllSessionData: () => window.sessionManager.clearAllSessionData(),
    exportSessionData: () => window.sessionManager.exportSessionData()
};

console.log('📱 SessionAPI verfügbar: window.SessionAPI');