/**
 * Auth Manager - Firebase Authentication + einheitliches Rollenmodell (globalRole)
 * Funktioniert auch ohne Firestore (Fallback auf reine Auth-Daten).
 */

// Logger-Integration. Gleiche Absicherung wie in firebase-config.js: window.log nur
// übernehmen, wenn es wirklich die erwartete Form hat, nicht nur weil es existiert.
const authLog = (window.log && typeof window.log.error === 'function' && typeof window.log.auth === 'function')
    ? window.log
    : {
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

        this.initPromise = this.initialize().catch((error) => {
            authLog.error('Init-Promise abgefangen', error);
            return false;
        });
    }

    async initialize() {
        try {
            authLog.auth('AuthManager-Initialisierung gestartet');

            const firebaseReady = await window.FirebaseConfig.waitForReadyWithTimeout(10000);
            if (!firebaseReady) {
                throw new Error('Firebase-Initialisierung fehlgeschlagen');
            }

            this.auth = window.FirebaseConfig.getAuth();
            this.db = window.FirebaseConfig.getDB();

            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }

            await this.testFirestoreAvailability();
            // Wartet auf die ERSTE Auswertung von onAuthStateChanged, bevor initialize() sich
            // auflöst. Ohne das war "initialized" bereits wahr, sobald der Listener nur
            // registriert war - getCurrentUser() direkt danach konnte dann noch null liefern,
            // obwohl eine bestehende Sitzung tatsächlich wiederhergestellt wurde (Race, bounced
            // z.B. echte Allianz-Gründer aus alliance-dashboard-redirect.html zurück zum Login).
            await this.setupAuthStateListener();

            this.initialized = true;
            authLog.auth('AuthManager erfolgreich initialisiert');

            return true;

        } catch (error) {
            authLog.error('AuthManager-Initialisierung fehlgeschlagen', error);
            this.initialized = false;
            return false;
        }
    }

    // Teste Firestore-Verfügbarkeit (ohne zu werfen)
    async testFirestoreAvailability() {
        // Rein lokale Prüfung, kein Netzwerk-Roundtrip: ein Firestore-Read bräuchte eine eigens
        // dafür freigegebene Collection in firestore.rules, obwohl "_test" für keine echte
        // Funktion der App steht - das lohnt keine Extra-Regel nur für diesen Selbst-Check.
        this.firestoreAvailable = !!this.db;
        authLog.auth(this.firestoreAvailable ? 'Firestore verfügbar' : 'Firestore nicht verfügbar (Fallback-Modus)');
    }

    // Auth State Listener einrichten. Gibt ein Promise zurück, das erst nach der ERSTEN
    // Auswertung von onAuthStateChanged auflöst (siehe Aufrufer in initialize()).
    setupAuthStateListener() {
        let resolveFirstFire;
        const firstFire = new Promise((resolve) => { resolveFirstFire = resolve; });

        this.auth.onAuthStateChanged(async (user) => {
            authLog.auth('Auth State Change:', user ? `Eingeloggt: ${user.email}` : 'Ausgeloggt');

            this.currentUser = user;

            if (user) {
                try {
                    this.userData = this.firestoreAvailable
                        ? await this.loadUserData(user.uid)
                        : this.createAuthBasedUserData(user);

                    if (this.firestoreAvailable) {
                        await this.updateLastLogin(user.uid);
                    }
                } catch (error) {
                    authLog.error('Fehler beim Laden der Benutzerdaten', error);
                    this.userData = this.createAuthBasedUserData(user);
                }

                // Aktiviert die 30-Minuten-Session-Überwachung in session-manager.js.
                if (window.SessionAPI) {
                    window.SessionAPI.setUserData(user, this.userData);
                }
            } else {
                this.userData = null;
                if (window.SessionAPI) {
                    window.SessionAPI.clearUserData();
                }
            }

            this.notifyAuthStateChange(user, this.userData);
            resolveFirstFire();
        });

        return firstFire;
    }

    // Basis-Benutzerdaten aus Firebase Auth erstellen (Fallback ohne Firestore)
    createAuthBasedUserData(user) {
        return {
            uid: user.uid,
            email: user.email,
            username: user.displayName || user.email.split('@')[0],
            isActive: true,
            globalRole: 'user',
            loginCount: 0,
            source: 'firebase_auth_only'
        };
    }

    // Benutzerdaten aus Firestore laden (mit Fallback)
    async loadUserData(uid) {
        if (!this.firestoreAvailable) {
            return this.createAuthBasedUserData(this.auth.currentUser);
        }

        try {
            const userDoc = await this.db.collection('users').doc(uid).get();

            if (userDoc.exists) {
                return userDoc.data();
            }
            return await this.createUserDocument(uid);

        } catch (error) {
            authLog.error('Fehler beim Laden der Benutzerdaten', error);

            if (error.code === 'permission-denied') {
                authLog.auth('Firestore-Berechtigungen fehlen, verwende Auth-basierte Daten');
                return this.createAuthBasedUserData(this.auth.currentUser);
            }

            throw error;
        }
    }

    // Login-Funktion (nur Firebase Auth, keine Firestore-Abhängigkeit)
    async login(input, password) {
        try {
            authLog.auth('Login-Versuch für:', input);

            await this.waitForInit();

            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }

            const email = this.validateEmailInput(input);
            if (!email) {
                return {
                    success: false,
                    error: 'Ungültige E-Mail-Adresse. Bitte geben Sie eine gültige E-Mail ein.'
                };
            }

            authLog.auth('Verwende E-Mail für Login:', email);

            // Auf GitHub Pages (statische Umgebung) keine autorisierte Domain für Firebase Auth.
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

    // E-Mail-Validierung. Echtes Benutzername-Login bräuchte einen serverseitigen Lookup
    // (z.B. Cloud Function), da die Firestore-Regeln anonyme Reads auf "users" nicht erlauben -
    // deshalb ist E-Mail aktuell der einzige unterstützte Login-Weg.
    validateEmailInput(input) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (emailRegex.test(input)) {
            return input;
        }

        if (input.includes('@')) {
            return input; // Versuche es trotzdem
        }

        return null;
    }

    // Super-Admin-Status prüfen
    async checkSuperAdminStatus(user) {
        if (!this.firestoreAvailable) {
            return false;
        }

        try {
            const userDoc = await this.db.collection('users').doc(user.uid).get();
            return userDoc.exists && userDoc.data().globalRole === 'global_admin';
        } catch (error) {
            authLog.error('Super-Admin-Check fehlgeschlagen', error);
            return false;
        }
    }

    // Registrierung
    async register(email, password, username) {
        try {
            authLog.auth('Registrierungs-Versuch für:', email);

            await this.waitForInit();

            if (!this.auth) {
                throw new Error('Firebase Auth nicht verfügbar');
            }

            const userCredential = await this.auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            authLog.auth('Firebase User erstellt:', user.uid);

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
                        loginCount: 1
                    };

                    await this.db.collection('users').doc(user.uid).set(userData);
                    authLog.auth('Benutzerdaten in Firestore gespeichert');

                } catch (firestoreError) {
                    authLog.auth('Firestore-Speicherung fehlgeschlagen, aber Auth erfolgreich', firestoreError);
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

    // Neues Benutzerdokument erstellen (für Konten ohne Firestore-Profil, z.B. Alt-Logins)
    async createUserDocument(uid) {
        if (!this.firestoreAvailable) {
            return this.createAuthBasedUserData(this.auth.currentUser);
        }

        try {
            const user = this.auth.currentUser;
            const userData = this.createAuthBasedUserData(user);

            const firestoreUserData = {
                ...userData,
                createdAt: window.FirebaseConfig.getServerTimestamp(),
                lastLogin: window.FirebaseConfig.getServerTimestamp()
            };

            await this.db.collection('users').doc(uid).set(firestoreUserData);
            authLog.auth('Benutzerdokument erstellt für:', userData.username);

            return firestoreUserData;

        } catch (error) {
            authLog.error('Fehler beim Erstellen des Benutzerdokuments', error);
            return this.createAuthBasedUserData(this.auth.currentUser);
        }
    }

    // LastLogin aktualisieren (optional, nicht kritisch)
    async updateLastLogin(uid) {
        if (!this.firestoreAvailable) {
            return;
        }

        try {
            await this.db.collection('users').doc(uid).update({
                lastLogin: window.FirebaseConfig.getServerTimestamp(),
                loginCount: firebase.firestore.FieldValue.increment(1)
            });
        } catch (error) {
            authLog.error('LastLogin-Update fehlgeschlagen', error);
        }
    }

    // Auth State Change Callback registrieren
    onAuthStateChange(callback) {
        this.authStateCallbacks.push(callback);

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

    // Aktivität hinzufügen (optional, nicht kritisch)
    async addActivity(icon, text) {
        if (!this.firestoreAvailable || !this.currentUser) {
            return;
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
