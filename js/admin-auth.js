/**
 * Admin Auth Utilities
 * - Erzwingt Super-Admin-Zugriff (globalRole === 'global_admin') für Admin-Seiten
 * - Hilfsfunktionen zur Rollenprüfung
 */

(function(){
    class AdminAuth {
        constructor(){
            this.authReady = false;
            this.currentUser = null;
            this.userData = null;
            this.init();
        }

        async init(){
            try {
                await window.AuthAPI.waitForInit();
                window.AuthAPI.onAuthStateChange((user, userData) => {
                    this.currentUser = user;
                    this.userData = userData;
                });
                this.authReady = true;
            } catch (e) {
                console.error('AdminAuth init failed', e);
            }
        }

        async requireSuperAdmin(){
            await window.AuthAPI.waitForInit();

            const user = window.AuthAPI.getCurrentUser();
            if (!user) {
                throw new Error('Nicht angemeldet');
            }

            const db = window.FirebaseConfig.getDB();
            const doc = await db.collection('users').doc(user.uid).get();

            if (!doc.exists) {
                throw new Error('Zugriff verweigert: Kein Benutzerprofil gefunden. Bitte an einen bestehenden Super-Admin wenden.');
            }

            const userData = doc.data();
            if (userData.globalRole === 'global_admin') {
                return true;
            }

            throw new Error(`Zugriff verweigert: ${user.email} ist kein Super-Admin. Bitte an einen bestehenden Super-Admin wenden, um Zugriff zu erhalten.`);
        }

        // Prüft den Super-Admin-Status, ohne bei fehlender Berechtigung zu werfen.
        async checkSuperAdminStatus(uid = null) {
            try {
                const userId = uid || (this.currentUser ? this.currentUser.uid : null);
                if (!userId) {
                    throw new Error('Keine Benutzer-ID verfügbar');
                }

                const db = window.FirebaseConfig.getDB();
                const doc = await db.collection('users').doc(userId).get();

                if (!doc.exists) {
                    return { isSuperAdmin: false, userData: null };
                }

                const userData = doc.data();
                return {
                    isSuperAdmin: userData.globalRole === 'global_admin',
                    userData: userData
                };
            } catch (error) {
                console.error('Fehler beim Prüfen des Super-Admin Status:', error);
                return { isSuperAdmin: false, userData: null, error: error.message };
            }
        }

        // Setzt den Super-Admin-Status. Greift nur, wenn die Firestore-Regeln es dem
        // aufrufenden Konto erlauben (nur bestehende Global-Admins dürfen fremde globalRole ändern).
        async setSuperAdminStatus(uid, isSuperAdmin = true) {
            try {
                const db = window.FirebaseConfig.getDB();
                await db.collection('users').doc(uid).update({
                    globalRole: isSuperAdmin ? 'global_admin' : 'user',
                    updatedAt: window.FirebaseConfig.getServerTimestamp(),
                    updatedBy: this.currentUser ? this.currentUser.uid : 'system'
                });

                return { success: true };
            } catch (error) {
                console.error('Fehler beim Setzen des Super-Admin Status:', error);
                return { success: false, error: error.message };
            }
        }
    }

    window.AdminAuth = new AdminAuth();
})();
