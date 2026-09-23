/**
 * Allianz-Redirect System
 * Leitet den Nutzer zum Allianz-Dashboard weiter, falls eine Mitgliedschaft existiert
 * (nachgeschlagen über die allianceMembers-Collection anhand der echten UID).
 */

(function() {
    'use strict';

    class AllianceRedirectManager {
        constructor() {
            this.currentUser = null;
        }

        async initialize() {
            try {
                console.log('🚀 Initialisiere Allianz-Redirect-System...');

                await window.AuthAPI.waitForInit();
                this.currentUser = window.AuthAPI.getCurrentUser();

                if (!this.currentUser) {
                    console.error('❌ Nicht angemeldet');
                    this.redirectToLogin();
                    return;
                }

                const membership = await this.loadUserMembership();

                if (membership) {
                    console.log('🏰 User gehört zu Allianz:', membership.allianceId);
                    await this.redirectToAllianceDashboard(membership);
                } else {
                    console.log('❌ User gehört keiner Allianz an');
                    this.redirectToUserDashboard();
                }

            } catch (error) {
                console.error('❌ Fehler beim Initialisieren des Allianz-Redirect-Systems:', error);
                this.redirectToUserDashboard();
            }
        }

        async loadUserMembership() {
            await window.FirebaseConfig.waitForReady();
            const db = window.FirebaseConfig.getDB();

            const query = await db.collection('allianceMembers')
                .where('uid', '==', this.currentUser.uid)
                .limit(1)
                .get();

            if (query.empty) return null;
            return { id: query.docs[0].id, ...query.docs[0].data() };
        }

        async redirectToAllianceDashboard(membership) {
            const db = window.FirebaseConfig.getDB();
            const allianceDoc = await db.collection('alliances').doc(membership.allianceId).get();

            if (!allianceDoc.exists) {
                console.error('❌ Allianz-Dokument nicht gefunden');
                this.redirectToUserDashboard();
                return;
            }

            const alliance = allianceDoc.data();

            if (alliance.status !== 'approved') {
                console.log('⚠️ Allianz nicht genehmigt, Status:', alliance.status);
                this.redirectToUserDashboard();
                return;
            }

            const dashboardUrl = `alliance-dashboard.html?id=${encodeURIComponent(membership.allianceId)}`;
            console.log('🔄 Leite weiter zu Allianz-Dashboard:', dashboardUrl);
            window.location.href = dashboardUrl;
        }

        redirectToUserDashboard() {
            console.log('🔄 Leite zurück zum User-Dashboard');
            window.location.href = 'user-dashboard.html';
        }

        redirectToLogin() {
            console.log('🔄 Leite zur Anmeldung weiter');
            window.location.href = 'index.html';
        }
    }

    window.AllianceRedirectManager = AllianceRedirectManager;

    document.addEventListener('DOMContentLoaded', () => {
        const redirectManager = new AllianceRedirectManager();
        redirectManager.initialize();
    });

})();
