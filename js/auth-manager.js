/**
 * BEHOBENER Auth Manager - Unabhängig von Firestore-Regeln
 * Firebase Authentication funktioniert OHNE Firestore-Abhängigkeiten
 */

// Logger-Integration
const authLog = window.log || {
    auth: (msg, data) => console.log('👤 AUTH:', msg, data),
    error: (msg, err, data) => console.error('❌ AUTH ERROR:', msg, err, data),
    debug: (msg, data) => console.log('🔍 AUTH DEBUG:', msg, data)
};

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.authStateCallbacks = [];
        this.initialized = false;
        this.initPromise = null;
        this.firestoreAvailable = false;
        
        // Initialisierung starten
        this.initPromise = this.initialize().catch((error) => {
            authLog.error('Init-Promise abgefangen', error);
            return false;
        });
    }
    
    async initialize() {
        try {
            authLog.auth('AuthManager-Initialisierung gestartet');
            
            // Warten bis Firebase bereit ist
            const firebaseReady = await window.FirebaseConfig.waitForReadyWithTimeout(10000);
            if (!firebaseReady) {
                throw new Error('Firebase-Initialisierung fehlgeschlagen');
            }
            
            // Firebase-Services holen
            this.auth = window.FirebaseConfig.getAuth();
            this.db = window.FirebaseConfig.getDB();
            
            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }
            
            // Teste Firestore-Verfügbarkeit (optional)
            await this.testFirestoreAvailability();
            
            // Auth State Listener starten
            this.setupAuthStateListener();
            
            this.initialized = true;
            authLog.auth('AuthManager erfolgreich initialisiert');
            
            return true;
            
        } catch (error) {
            authLog.error('AuthManager-Initialisierung fehlgeschlagen', error);
            this.initialized = false;
            // Rejection vermeiden, stattdessen false zurückgeben
            return false;
        }
    }
    
    // Teste Firestore-Verfügbarkeit (ohne zu werfen)
    async testFirestoreAvailability() {
        try {
            if (!this.db) {
                this.firestoreAvailable = false;
                return;
            }
            
            // Einfacher Test ohne Berechtigungen
            await this.db.collection('_test').doc('connection').get();
            this.firestoreAvailable = true;
            authLog.auth('Firestore verfügbar');
            
        } catch (error) {
            this.firestoreAvailable = false;
            authLog.auth('Firestore nicht verfügbar (Fallback-Modus)', error.message);
        }
    }
    
    // Auth State Listener einrichten
    setupAuthStateListener() {
        this.auth.onAuthStateChanged(async (user) => {
            authLog.auth('Auth State Change:', user ? `Eingeloggt: ${user.email}` : 'Ausgeloggt');
            
            this.currentUser = user;
            
            if (user) {
                // Versuche Benutzerdaten zu laden (optional)
                try {
                    if (this.firestoreAvailable) {
                        this.userData = await this.loadUserData(user.uid);
                        authLog.auth('Benutzerdaten geladen:', this.userData?.username || user.email);
                    } else {
                        // Fallback: Basis-Benutzerdaten aus Firebase Auth
                        this.userData = this.createAuthBasedUserData(user);
                        authLog.auth('Fallback-Benutzerdaten erstellt:', user.email);
                    }
                    
                    // LastLogin aktualisieren (optional)
                    if (this.firestoreAvailable) {
                        await this.updateLastLogin(user.uid);
                    }
                    
                } catch (error) {
                    authLog.error('Fehler beim Laden der Benutzerdaten', error);
                    // Fallback: Basis-Benutzerdaten aus Firebase Auth
                    this.userData = this.createAuthBasedUserData(user);
                }
            } else {
                this.userData = null;
            }
            
            // Callbacks benachrichtigen
            this.notifyAuthStateChange(user, this.userData);
        });
    }
    
    // Benutzerdaten aus Firestore laden (optional)
    async loadUserData(uid) {
        if (!this.firestoreAvailable) {
            return this.createAuthBasedUserData(this.auth.currentUser);
        }
        
        try {
            const userDoc = await this.db.collection('users').doc(uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                return await this.migrateUserDocument(userData);
            } else {
                authLog.auth('Benutzerdokument nicht gefunden, erstelle neues');
                return await this.createUserDocument(uid);
            }
            
        } catch (error) {
            authLog.error('Fehler beim Laden der Benutzerdaten', error);
            
            // Fallback bei Berechtigungsfehlern
            if (error.code === 'permission-denied') {
                authLog.auth('Firestore-Berechtigungen fehlen, verwende Auth-basierte Daten');
                return this.createAuthBasedUserData(this.auth.currentUser);
            }
            
            throw error;
        }
    }
    
    // Login-Funktion (VEREINFACHT - nur Firebase Auth)
    async login(input, password) {
        try {
            authLog.auth('Login-Versuch für:', input);
            
            // Warten bis initialisiert
            await this.waitForInit();
            
            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }
            
            // E-Mail-Validierung (OHNE Firestore-Abhängigkeit)
            const email = this.validateEmailInput(input);
            if (!email) {
                return {
                    success: false,
                    error: 'Ungültige E-Mail-Adresse. Bitte geben Sie eine gültige E-Mail ein.'
                };
            }
            
            authLog.auth('Verwende E-Mail für Login:', email);
            
            // DIREKTER Login-Versuch (OHNE fetchSignInMethodsForEmail)
            // Das ist der Schlüssel: Firebase Auth funktioniert ohne Firestore!
            // Auf GitHub Pages (statische Umgebung) keine autorisierte Domain für Firebase Auth
            const host = (typeof window !== 'undefined' && window.location) ? window.location.hostname : '';
            if (host.endsWith('github.io')) {
                return {
                    success: false,
                    error: 'Login in der GitHub Pages Vorschau ist nicht möglich (nicht autorisierte Domain). Bitte die Railway-URL verwenden.'
                };
            }

            const userCredential = await this.auth.signInWithEmailAndPassword(email, password);
            authLog.auth('Login erfolgreich für:', email);
            
            return {
                success: true,
                user: userCredential.user
            };
            
        } catch (error) {
            authLog.error('Login fehlgeschlagen', error);
            
            // Benutzerfreundliche Fehlermeldungen
            let errorMessage = 'Login fehlgeschlagen.';
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'Kein Account mit dieser E-Mail gefunden.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Falsches Passwort.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Ungültige E-Mail-Adresse.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'Dieser Account wurde deaktiviert.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Zu viele Login-Versuche. Bitte warten Sie einen Moment.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Netzwerkfehler. Bitte überprüfen Sie Ihre Internetverbindung.';
                    break;
                case 'auth/invalid-credential':
                    errorMessage = 'Ungültige Anmeldedaten.';
                    break;
                default:
                    errorMessage = error.message || 'Ein unbekannter Fehler ist aufgetreten.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    // E-Mail-Validierung (OHNE Firestore)
    validateEmailInput(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        // Wenn es bereits eine E-Mail ist
        if (emailRegex.test(input)) {
            return input;
        }
        
        // Für Benutzernamen: Fallback-Mapping (ohne Firestore)
        const usernameToEmailMap = {
            'daikin': 't.o@trend4media.de',
            'admin': 't.o@trend4media.de',
            'trend4media_admin': 't.o@trend4media.de'
        };
        
        const mappedEmail = usernameToEmailMap[input.toLowerCase()];
        if (mappedEmail) {
            authLog.auth('Benutzername zu E-Mail gemappt:', input, '->', mappedEmail);
            return mappedEmail;
        }
        
        // Wenn es wie eine E-Mail aussieht, aber Validation fehlschlägt
        if (input.includes('@')) {
            return input; // Versuche es trotzdem
        }
        
        return null;
    }
    
    // Admin-Status pruefen. Quelle der Wahrheit ist Firestore (globalRole).
    // Uebergangsweise wird isSuperAdmin===true noch akzeptiert, bis die Migration
    // alle Konten auf globalRole umgestellt hat. KEIN E-Mail-Fallback mehr.
    async checkSuperAdminStatus(user) {
        if (!this.firestoreAvailable) {
            return false;
        }
        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                return userData.globalRole === 'global_admin' || userData.isSuperAdmin === true;
            }
            return false;
        } catch (error) {
            authLog.error('Admin-Check fehlgeschlagen', error);
            return false;
        }
    }
    
    // Registrierung (vereinfacht)
    async register(email, password, username) {
        try {
            authLog.auth('Registrierungs-Versuch für:', email);
            
            await this.waitForInit();
            
            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }
            
            // Firebase Auth User erstellen
            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            authLog.auth('Firebase User erstellt:', user.uid);
            
            // Versuche Benutzerdaten in Firestore zu speichern (optional)
            if (this.firestoreAvailable) {
                try {
                    const userData = {
                        uid: user.uid,
                        email: email,
                        username: username,
                        createdAt: window.FirebaseConfig.getServerTimestamp(),
                        lastLogin: window.FirebaseConfig.getServerTimestamp(),
                        isActive: true,
                        globalRole: 'user',
                        isAllianceAdmin: false,
                        loginCount: 1,
                        permissions: {
                            dashboard_access: true,
                            profile_edit: true
                        }
                    };
                    
                    await this.db.collection('users').doc(user.uid).set(userData);
                    authLog.auth('Benutzerdaten in Firestore gespeichert');
                    
                } catch (firestoreError) {
                    authLog.auth('Firestore-Speicherung fehlgeschlagen, aber Auth erfolgreich', firestoreError);
                    // Nicht werfen - Firebase Auth hat funktioniert
                }
            }
            
            return {
                success: true,
                user: user
            };
            
        } catch (error) {
            authLog.error('Registrierung fehlgeschlagen', error);
            
            let errorMessage = 'Registrierung fehlgeschlagen.';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Diese E-Mail-Adresse wird bereits verwendet.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Ungültige E-Mail-Adresse.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Passwort ist zu schwach. Verwenden Sie mindestens 6 Zeichen.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Registrierung ist derzeit nicht möglich.';
                    break;
                default:
                    errorMessage = error.message || 'Ein unbekannter Fehler ist aufgetreten.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    // Logout
    async logout() {
        try {
            authLog.auth('Logout-Versuch');
            
            await this.waitForInit();
            
            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }
            
            await this.auth.signOut();
            authLog.auth('Logout erfolgreich');
            
            return {
                success: true
            };
            
        } catch (error) {
            authLog.error('Logout fehlgeschlagen', error);
            return {
                success: false,
                error: 'Fehler beim Abmelden'
            };
        }
    }
    
    // Passwort zurücksetzen
    async resetPassword(email) {
        try {
            await this.waitForInit();
            
            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }
            
            await this.auth.sendPasswordResetEmail(email);
            authLog.auth('Passwort-Reset E-Mail gesendet an:', email);
            
            return {
                success: true
            };
            
        } catch (error) {
            authLog.error('Passwort-Reset fehlgeschlagen', error);
            
            let errorMessage = 'Fehler beim Passwort-Reset.';
            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Kein Account mit dieser E-Mail gefunden.';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Ungültige E-Mail-Adresse.';
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    
    // Benutzerdaten laden (mit Fallback)
    async loadUserData(uid) {
        if (!this.firestoreAvailable) {
            return this.createAuthBasedUserData(this.auth.currentUser);
        }
        
        try {
            const userDoc = await this.db.collection('users').doc(uid).get();
            
            if (userDoc.exists) {
                return userDoc.data();
            } else {
                // Erstelle Basis-Dokument
                return await this.createUserDocument(uid);
            }
            
        } catch (error) {
            authLog.error('Fehler beim Laden der Benutzerdaten', error);
            
            // Bei Berechtigungsfehlern: Auth-basierte Daten verwenden
            if (error.code === 'permission-denied') {
                return this.createAuthBasedUserData(this.auth.currentUser);
            }
            
            throw error;
        }
    }
    
    // Basis-Benutzerdaten aus Firebase Auth erstellen.
    // SICHERHEIT: keine E-Mail-basierte Admin-Vergabe mehr. Jeder neue Nutzer ist
    // 'user'. Admin-Rechte vergibt ausschliesslich ein bestehender Admin (globalRole).
    createAuthBasedUserData(user) {
        return {
            uid: user.uid,
            email: user.email,
            username: user.displayName || user.email.split('@')[0],
            isActive: true,
            globalRole: 'user',
            isAllianceAdmin: false,
            loginCount: 0,
            alliance: null,
            permissions: {
                dashboard_access: true,
                profile_edit: true
            },
            source: 'firebase_auth_fallback'
        };
    }
    
    // Neues Benutzerdokument erstellen (optional)
    async createUserDocument(uid) {
        if (!this.firestoreAvailable) {
            return this.createAuthBasedUserData(this.auth.currentUser);
        }
        
        try {
            const user = this.auth.currentUser;
            const userData = this.createAuthBasedUserData(user);
            
            // Erweitere mit Firestore-spezifischen Feldern
            const firestoreUserData = {
                ...userData,
                createdAt: window.FirebaseConfig.getServerTimestamp(),
                lastLogin: window.FirebaseConfig.getServerTimestamp(),
                lastUpdated: window.FirebaseConfig.getServerTimestamp(),
                updatedAt: window.FirebaseConfig.getServerTimestamp(),
                updatedBy: uid
            };
            
            await this.db.collection('users').doc(uid).set(firestoreUserData);
            authLog.auth('Benutzerdokument erstellt für:', userData.username);
            
            return firestoreUserData;
            
        } catch (error) {
            authLog.error('Fehler beim Erstellen des Benutzerdokuments', error);
            return this.createAuthBasedUserData(this.auth.currentUser);
        }
    }
    
    // Dokument-Migration (optional)
    async migrateUserDocument(userData) {
        if (!this.firestoreAvailable) {
            return userData;
        }
        
        try {
            const updates = {};

            // Vereinheitlichung: fehlendes globalRole aus Alt-Feldern ableiten
            // (idempotent - laeuft nur, solange globalRole noch fehlt). So migrieren
            // sich bestehende Konten beim naechsten Login selbst auf das neue Modell.
            if (!userData.hasOwnProperty('globalRole')) {
                const wasAdmin = userData.isSuperAdmin === true || userData.systemRole === 'superadmin';
                updates.globalRole = wasAdmin ? 'global_admin' : 'user';
            }
            if (!userData.hasOwnProperty('isAllianceAdmin')) updates.isAllianceAdmin = false;
            
            // Updates anwenden falls nötig
            if (Object.keys(updates).length > 0) {
                await this.db.collection('users').doc(userData.uid).update(updates);
                authLog.auth('Benutzerdokument migriert');
                return { ...userData, ...updates };
            }
            
            return userData;
            
        } catch (error) {
            authLog.error('Migration fehlgeschlagen', error);
            return userData;
        }
    }
    
    // LastLogin aktualisieren (optional)
    async updateLastLogin(uid) {
        if (!this.firestoreAvailable) {
            return; // Kein Fehler werfen
        }
        
        try {
            await this.db.collection('users').doc(uid).update({
                lastLogin: window.FirebaseConfig.getServerTimestamp(),
                loginCount: firebase.firestore.FieldValue.increment(1)
            });
        } catch (error) {
            authLog.error('LastLogin-Update fehlgeschlagen', error);
            // Nicht kritisch, daher nicht werfen
        }
    }
    
    // Auth State Change Callback registrieren
    onAuthStateChange(callback) {
        this.authStateCallbacks.push(callback);
        
        // Sofort aufrufen wenn bereits initialisiert
        if (this.currentUser !== null) {
            try {
                callback(this.currentUser, this.userData);
            } catch (callbackError) {
                authLog.error('Fehler in Auth-Callback', callbackError);
            }
        }
    }
    
    // Alle Callbacks benachrichtigen
    notifyAuthStateChange(user, userData) {
        this.authStateCallbacks.forEach(callback => {
            try {
                callback(user, userData);
            } catch (error) {
                authLog.error('Fehler in Auth-Callback', error);
            }
        });
    }
    
    // Getter
    getCurrentUser() {
        return this.currentUser;
    }
    
    getUserData() {
        return this.userData;
    }
    
    isLoggedIn() {
        return !!this.currentUser;
    }
    
    isInitialized() {
        return this.initialized;
    }
    
    getFirestoreStatus() {
        return this.firestoreAvailable;
    }
    
    // Warten bis AuthManager bereit ist
    async waitForInit() {
        if (this.initialized) {
            return true;
        }
        
        if (this.initPromise) {
            try {
                await this.initPromise;
                return this.initialized;
            } catch (error) {
                authLog.error('AuthManager-Initialisierung fehlgeschlagen beim Warten', error);
                return false;
            }
        }
        
        return false;
    }
    
    // Aktivität hinzufügen (optional)
    async addActivity(icon, text) {
        if (!this.firestoreAvailable || !this.currentUser) {
            return; // Kein Fehler werfen
        }
        
        try {
            await this.db.collection('userActivities').add({
                userId: this.currentUser.uid,
                icon: icon,
                text: text,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });
            
            authLog.auth('Aktivität hinzugefügt:', text);
            
        } catch (error) {
            authLog.error('Fehler beim Hinzufügen der Aktivität', error);
            // Nicht kritisch, daher nicht werfen
        }
    }
}

// Globale AuthManager-Instanz
window.authManager = new AuthManager();

// Vereinfachte API
window.AuthAPI = {
    login: (input, password) => window.authManager.login(input, password),
    register: (email, password, username) => window.authManager.register(email, password, username),
    logout: () => window.authManager.logout(),
    resetPassword: (email) => window.authManager.resetPassword(email),
    addActivity: (icon, text) => window.authManager.addActivity(icon, text),
    getCurrentUser: () => window.authManager.getCurrentUser(),
    getUserData: () => window.authManager.getUserData(),
    isLoggedIn: () => window.authManager.isLoggedIn(),
    isInitialized: () => window.authManager.isInitialized(),
    getFirestoreStatus: () => window.authManager.getFirestoreStatus(),
    checkSuperAdminStatus: (user) => window.authManager.checkSuperAdminStatus(user),
    onAuthStateChange: (callback) => window.authManager.onAuthStateChange(callback),
    waitForInit: () => window.authManager.waitForInit()
};