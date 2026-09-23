/**
 * Spy Database Manager - Firebase-Integration für Spionage-Berichte
 * Vereinheitlichte Collection "spyReports", referenziert per allianceId (nicht mehr per
 * Allianz-Name) - passend zum übrigen Datenmodell und zu firestore.rules.
 */

class SpyDatabaseManager {
    constructor() {
        this.db = null;
        this.currentUser = null;
        this.currentAllianceId = null;
        this.init();
    }

    async init() {
        try {
            if (window.FirebaseConfig) {
                await window.FirebaseConfig.waitForReady();
                this.db = window.FirebaseConfig.getDB();
            }

            if (window.AuthAPI) {
                await window.AuthAPI.waitForInit();
                this.currentUser = window.AuthAPI.getCurrentUser();

                window.AuthAPI.onAuthStateChange(async (user) => {
                    this.currentUser = user;
                    this.currentAllianceId = user ? await this.resolveMyAllianceId() : null;
                });
            }

            this.currentAllianceId = await this.resolveMyAllianceId();

            console.log('🗄️ Spy Database Manager initialisiert');

        } catch (error) {
            console.error('❌ Spy Database Manager Initialisierung fehlgeschlagen:', error);
        }
    }

    async resolveMyAllianceId() {
        if (!this.db || !this.currentUser) return null;
        try {
            const query = await this.db.collection('allianceMembers')
                .where('uid', '==', this.currentUser.uid)
                .limit(1)
                .get();
            return query.empty ? null : query.docs[0].data().allianceId;
        } catch (error) {
            console.warn('⚠️ Konnte eigene Allianz-Mitgliedschaft nicht ermitteln:', error);
            return null;
        }
    }

    resolveAllianceId(allianceId) {
        const resolved = allianceId || this.currentAllianceId;
        if (!resolved) {
            throw new Error('Keine Allianz zugeordnet. Bitte melde dich über das User-Dashboard an.');
        }
        return resolved;
    }

    /**
     * Speichert einen Spy-Report für eine Allianz.
     * @param {Object} reportData - Die geparsten Report-Daten
     * @param {string} allianceId - ID der Allianz
     * @returns {Promise<string>} - Die Document-ID
     */
    async saveSpyReport(reportData, allianceId = null) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }

            const alliance = this.resolveAllianceId(allianceId);
            console.log('💾 Speichere Spy-Report für Allianz:', alliance);

            const firebaseData = {
                reportId: reportData.reportId,
                originalUrl: reportData.originalUrl,
                timestamp: reportData.timestamp,
                createdByUid: this.currentUser?.uid || null,
                addedByName: this.currentUser?.email || 'unknown',
                allianceId: alliance,

                planet: reportData.planet,
                player: reportData.player,
                buildings: reportData.buildings,
                resources: reportData.resources,
                defense: reportData.defense,
                fleets: reportData.fleets,
                fleet: reportData.fleet,

                statistics: reportData.statistics,

                playerName: reportData.player.name,
                planetCoordinates: reportData.planet.coordinates,
                planetName: reportData.planet.name,
                threatLevel: reportData.statistics.threatLevel,
                totalAttackPower: reportData.statistics.totalAttackPower,
                totalDefensePower: reportData.statistics.totalDefensePower,
                totalResources: reportData.statistics.totalResources,

                createdAt: new Date(),
                updatedAt: new Date()
            };

            const docRef = await this.db.collection('spyReports').add(firebaseData);
            console.log('✅ Spy-Report gespeichert mit ID:', docRef.id);

            await this.addActivityLog('spy_report_added', {
                reportId: reportData.reportId,
                playerName: reportData.player.name,
                planetCoordinates: reportData.planet.coordinates,
                allianceId: alliance
            });

            return docRef.id;

        } catch (error) {
            console.error('❌ Fehler beim Speichern des Spy-Reports:', error);
            throw error;
        }
    }

    /**
     * Lädt alle Spy-Reports einer Allianz.
     * @param {string} allianceId - ID der Allianz
     * @param {Object} options - Abfrage-Optionen
     * @returns {Promise<Array>} - Array der Spy-Reports
     */
    async getAllianceSpyReports(allianceId = null, options = {}) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }

            const alliance = this.resolveAllianceId(allianceId);
            console.log('📋 Lade Spy-Reports für Allianz:', alliance);

            let query = this.db.collection('spyReports').where('allianceId', '==', alliance);
            if (options.limit) {
                query = query.limit(options.limit);
            }

            const snapshot = await query.get();
            const reports = [];
            snapshot.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));

            reports.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA;
            });

            console.log(`✅ ${reports.length} Spy-Reports geladen`);
            return reports;

        } catch (error) {
            console.error('❌ Fehler beim Laden der Spy-Reports:', error);
            throw error;
        }
    }

    async getSpyReport(reportId) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }

            const doc = await this.db.collection('spyReports').doc(reportId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;

        } catch (error) {
            console.error('❌ Fehler beim Laden des Spy-Reports:', error);
            throw error;
        }
    }

    async deleteSpyReport(reportId) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }

            const report = await this.getSpyReport(reportId);
            if (!report) {
                throw new Error('Spy-Report nicht gefunden');
            }

            const canDelete = report.createdByUid === this.currentUser?.uid ||
                            await this.isAllianceAdmin(report.allianceId);

            if (!canDelete) {
                throw new Error('Keine Berechtigung zum Löschen');
            }

            await this.db.collection('spyReports').doc(reportId).delete();
            console.log('✅ Spy-Report gelöscht:', reportId);

            await this.addActivityLog('spy_report_deleted', {
                reportId: report.reportId,
                playerName: report.playerName,
                planetCoordinates: report.planetCoordinates,
                allianceId: report.allianceId
            });

            return true;

        } catch (error) {
            console.error('❌ Fehler beim Löschen des Spy-Reports:', error);
            throw error;
        }
    }

    async searchSpyReports(searchCriteria) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }

            const alliance = this.resolveAllianceId(searchCriteria.allianceId);
            console.log('🔍 Suche Spy-Reports mit Kriterien:', searchCriteria);

            let query = this.db.collection('spyReports').where('allianceId', '==', alliance);

            if (searchCriteria.playerName) {
                query = query.where('playerName', '>=', searchCriteria.playerName)
                           .where('playerName', '<=', searchCriteria.playerName + '');
            }
            if (searchCriteria.planetName) {
                query = query.where('planetName', '>=', searchCriteria.planetName)
                           .where('planetName', '<=', searchCriteria.planetName + '');
            }
            if (searchCriteria.coordinates) {
                query = query.where('planetCoordinates', '==', searchCriteria.coordinates);
            }
            if (searchCriteria.threatLevel) {
                query = query.where('threatLevel', '==', searchCriteria.threatLevel);
            }
            if (searchCriteria.minAttackPower) {
                query = query.where('totalAttackPower', '>=', searchCriteria.minAttackPower);
            }
            if (searchCriteria.maxAttackPower) {
                query = query.where('totalAttackPower', '<=', searchCriteria.maxAttackPower);
            }
            if (searchCriteria.fromDate) {
                query = query.where('createdAt', '>=', searchCriteria.fromDate);
            }
            if (searchCriteria.toDate) {
                query = query.where('createdAt', '<=', searchCriteria.toDate);
            }

            const sortField = searchCriteria.sortBy || 'createdAt';
            const sortDirection = searchCriteria.sortDirection || 'desc';
            query = query.orderBy(sortField, sortDirection).limit(searchCriteria.limit || 50);

            const snapshot = await query.get();
            const reports = [];
            snapshot.forEach(doc => reports.push({ id: doc.id, ...doc.data() }));

            console.log(`✅ ${reports.length} Spy-Reports gefunden`);
            return reports;

        } catch (error) {
            console.error('❌ Fehler bei der Spy-Report-Suche:', error);
            throw error;
        }
    }

    async getAllianceStatistics(allianceId = null) {
        try {
            const alliance = this.resolveAllianceId(allianceId);
            console.log('📊 Lade Allianz-Statistiken für:', alliance);

            const reports = await this.getAllianceSpyReports(alliance);

            const stats = {
                totalReports: reports.length,
                uniquePlayers: new Set(),
                uniquePlanets: new Set(),
                threatLevels: {},
                totalAttackPower: 0,
                totalDefensePower: 0,
                totalResources: 0,
                averageResearchLevel: 0,
                averageBuildingLevel: 0,
                reportsByMonth: {},
                topPlayers: [],
                recentReports: reports.slice(0, 10)
            };

            let totalResearch = 0;
            let totalBuildings = 0;

            reports.forEach(report => {
                stats.uniquePlayers.add(report.playerName);
                stats.uniquePlanets.add(report.planetCoordinates);

                const threatLevel = report.threatLevel || 'unknown';
                stats.threatLevels[threatLevel] = (stats.threatLevels[threatLevel] || 0) + 1;

                stats.totalAttackPower += report.totalAttackPower || 0;
                stats.totalDefensePower += report.totalDefensePower || 0;
                stats.totalResources += report.totalResources || 0;

                if (report.statistics) {
                    totalResearch += report.statistics.researchLevel || 0;
                    totalBuildings += report.statistics.buildingLevel || 0;
                }

                const created = report.createdAt?.toDate ? report.createdAt.toDate() : new Date(report.createdAt);
                const month = created.toISOString().slice(0, 7);
                stats.reportsByMonth[month] = (stats.reportsByMonth[month] || 0) + 1;
            });

            stats.uniquePlayers = stats.uniquePlayers.size;
            stats.uniquePlanets = stats.uniquePlanets.size;
            stats.averageResearchLevel = reports.length > 0 ? totalResearch / reports.length : 0;
            stats.averageBuildingLevel = reports.length > 0 ? totalBuildings / reports.length : 0;

            const playerCounts = {};
            reports.forEach(report => {
                playerCounts[report.playerName] = (playerCounts[report.playerName] || 0) + 1;
            });

            stats.topPlayers = Object.entries(playerCounts)
                .map(([name, count]) => ({ name, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            console.log('✅ Allianz-Statistiken geladen');
            return stats;

        } catch (error) {
            console.error('❌ Fehler beim Laden der Allianz-Statistiken:', error);
            throw error;
        }
    }

    /**
     * Prüft, ob der aktuelle (oder ein angegebener) User Allianz-Admin ist.
     * @param {string} allianceId - optional, sonst die eigene Allianz
     */
    async isAllianceAdmin(allianceId = null) {
        try {
            if (!this.currentUser || !this.db) return false;
            const alliance = allianceId || this.currentAllianceId;
            if (!alliance) return false;

            const memberDoc = await this.db.collection('allianceMembers')
                .doc(`${alliance}_${this.currentUser.uid}`)
                .get();

            if (!memberDoc.exists) return false;
            const role = memberDoc.data().role;
            return role === 'admin' || role === 'founder';

        } catch (error) {
            console.warn('⚠️ Fehler beim Prüfen der Alliance-Admin-Berechtigung:', error);
            return false;
        }
    }

    async addActivityLog(action, data = {}) {
        try {
            if (!this.db || !this.currentUser) return;
            const allianceId = data.allianceId || this.currentAllianceId;
            if (!allianceId) return;

            // Collection-Name und Feldform ("allianceId" + "type") folgen der Konvention
            // aus alliance-member-management.js, damit dieselben Firestore-Regeln greifen.
            await this.db.collection('allianceActivities').add({
                ...data,
                type: action,
                allianceId,
                performedByUid: this.currentUser.uid,
                timestamp: new Date()
            });

        } catch (error) {
            console.warn('⚠️ Fehler beim Hinzufügen des Activity-Logs:', error);
        }
    }

    async reportExists(reportId, allianceId = null) {
        try {
            if (!this.db) return false;
            const alliance = allianceId || this.currentAllianceId;
            if (!alliance) return false;

            const query = this.db.collection('spyReports')
                .where('reportId', '==', reportId)
                .where('allianceId', '==', alliance)
                .limit(1);

            const snapshot = await query.get();
            return !snapshot.empty;

        } catch (error) {
            console.warn('⚠️ Fehler beim Prüfen der Report-Existenz:', error);
            return false;
        }
    }
}

// Globale Instanz erstellen
window.spyDatabaseManager = new SpyDatabaseManager();

// Globale API für einfache Nutzung
window.SpyDatabaseAPI = {
    saveReport: (reportData, allianceId) => window.spyDatabaseManager.saveSpyReport(reportData, allianceId),
    getAllianceReports: (allianceId, options) => window.spyDatabaseManager.getAllianceSpyReports(allianceId, options),
    getReport: (reportId) => window.spyDatabaseManager.getSpyReport(reportId),
    deleteReport: (reportId) => window.spyDatabaseManager.deleteSpyReport(reportId),
    searchReports: (criteria) => window.spyDatabaseManager.searchSpyReports(criteria),
    getStatistics: (allianceId) => window.spyDatabaseManager.getAllianceStatistics(allianceId),
    reportExists: (reportId, allianceId) => window.spyDatabaseManager.reportExists(reportId, allianceId),
    isAdmin: (allianceId) => window.spyDatabaseManager.isAllianceAdmin(allianceId)
};

console.log('🗄️ SpyDatabaseAPI verfügbar: window.SpyDatabaseAPI');
