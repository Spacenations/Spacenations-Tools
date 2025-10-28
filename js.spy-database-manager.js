/**
 * Spy Database Manager - Firebase-Integration für Spionage-Berichte
 * Verwaltet die Speicherung und Abfrage von Spy-Reports in der Allianz-Datenbank
 */

class SpyDatabaseManager {
    constructor() {
        this.db = null;
        this.currentUser = null;
        this.currentAlliance = null;
        this.init();
    }
    
    async init() {
        try {
            // Warte auf Firebase-Initialisierung
            if (window.FirebaseConfig) {
                await window.FirebaseConfig.waitForReady();
                this.db = window.FirebaseConfig.getDB();
            }
            
            // Warte auf AuthManager
            if (window.AuthAPI) {
                await window.AuthAPI.waitForInit();
                this.currentUser = window.AuthAPI.getCurrentUser();
                
                // Auth State Changes überwachen
                window.AuthAPI.onAuthStateChange((user, userData) => {
                    this.currentUser = user;
                    this.currentAlliance = userData?.allianceName || null;
                });
            }
            
            // Allianz-Daten aus SessionAPI laden (Fallback)
            if (window.SessionAPI && !this.currentAlliance) {
                const allianceData = window.SessionAPI.getAllianceData();
                this.currentAlliance = allianceData?.name || allianceData;
                console.log('📋 Allianz aus SessionAPI geladen:', this.currentAlliance);
            }
            
            console.log('🗄️ Spy Database Manager initialisiert');
            
        } catch (error) {
            console.error('❌ Spy Database Manager Initialisierung fehlgeschlagen:', error);
        }
    }
    
    /**
     * Speichert einen Spy-Report in der Allianz-Datenbank
     * @param {Object} reportData - Die geparsten Report-Daten
     * @param {string} allianceName - Name der Allianz
     * @returns {Promise<string>} - Die Document-ID
     */
    async saveSpyReport(reportData, allianceName = null) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }
            
            let alliance = allianceName || this.currentAlliance;
            
            // Fallback: Versuche Allianz-Daten aus verschiedenen Quellen zu laden
            if (!alliance) {
                console.warn('⚠️ Keine Allianz-Daten gefunden, versuche Fallback...');
                
                // 1. Versuche SessionAPI
                if (window.SessionAPI) {
                    const allianceData = window.SessionAPI.getAllianceData();
                    alliance = allianceData?.name || allianceData;
                    console.log('📋 Allianz aus SessionAPI (Fallback):', alliance);
                }
                
                // 2. Versuche localStorage
                if (!alliance) {
                    const storedAlliance = localStorage.getItem('currentAlliance');
                    if (storedAlliance) {
                        try {
                            const allianceData = JSON.parse(storedAlliance);
                            alliance = allianceData.name || allianceData;
                            console.log('📋 Allianz aus localStorage (Fallback):', alliance);
                        } catch (error) {
                            console.warn('⚠️ Fehler beim Parsen der localStorage Allianz-Daten:', error);
                        }
                    }
                }
                
                if (!alliance) {
                    throw new Error('Keine Allianz zugeordnet. Bitte melde dich über das User-Dashboard an.');
                }
            }
            
            console.log('💾 Speichere Spy-Report für Allianz:', alliance);
            
            // Daten für Firebase vorbereiten
            const firebaseData = {
                // Metadaten
                reportId: reportData.reportId,
                originalUrl: reportData.originalUrl,
                timestamp: reportData.timestamp,
                addedBy: this.currentUser?.uid || 'unknown',
                addedByName: this.currentUser?.email || 'unknown',
                allianceName: alliance,
                
                // Report-Daten
                planet: reportData.planet,
                player: reportData.player,
                buildings: reportData.buildings,
                resources: reportData.resources,
                defense: reportData.defense,
                fleets: reportData.fleets,
                fleet: reportData.fleet,
                
                // Berechnete Statistiken
                statistics: reportData.statistics,
                
                // Index-Felder für bessere Abfragen
                playerName: reportData.player.name,
                planetCoordinates: reportData.planet.coordinates,
                planetName: reportData.planet.name,
                threatLevel: reportData.statistics.threatLevel,
                totalAttackPower: reportData.statistics.totalAttackPower,
                totalDefensePower: reportData.statistics.totalDefensePower,
                totalResources: reportData.statistics.totalResources,
                
                // Timestamp für Sortierung
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // In Allianz-spezifische Collection speichern
            const docRef = await this.db.collection('allianceSpyReports').add(firebaseData);
            
            console.log('✅ Spy-Report gespeichert mit ID:', docRef.id);
            
            // Activity-Log hinzufügen
            await this.addActivityLog('spy_report_added', {
                reportId: reportData.reportId,
                playerName: reportData.player.name,
                planetCoordinates: reportData.planet.coordinates,
                allianceName: alliance
            });
            
            return docRef.id;
            
        } catch (error) {
            console.error('❌ Fehler beim Speichern des Spy-Reports:', error);
            throw error;
        }
    }
    
    /**
     * Lädt alle Spy-Reports einer Allianz
     * @param {string} allianceName - Name der Allianz
     * @param {Object} options - Abfrage-Optionen
     * @returns {Promise<Array>} - Array der Spy-Reports
     */
    async getAllianceSpyReports(allianceName = null, options = {}) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }
            
            let alliance = allianceName || this.currentAlliance;
            
            // Fallback: Versuche Allianz-Daten aus verschiedenen Quellen zu laden
            if (!alliance) {
                console.warn('⚠️ Keine Allianz-Daten gefunden, versuche Fallback...');
                
                // 1. Versuche SessionAPI
                if (window.SessionAPI) {
                    const allianceData = window.SessionAPI.getAllianceData();
                    alliance = allianceData?.name || allianceData;
                    console.log('📋 Allianz aus SessionAPI (Fallback):', alliance);
                }
                
                // 2. Versuche localStorage
                if (!alliance) {
                    const storedAlliance = localStorage.getItem('currentAlliance');
                    if (storedAlliance) {
                        try {
                            const allianceData = JSON.parse(storedAlliance);
                            alliance = allianceData.name || allianceData;
                            console.log('📋 Allianz aus localStorage (Fallback):', alliance);
                        } catch (error) {
                            console.warn('⚠️ Fehler beim Parsen der localStorage Allianz-Daten:', error);
                        }
                    }
                }
                
                if (!alliance) {
                    throw new Error('Keine Allianz zugeordnet. Bitte melde dich über das User-Dashboard an.');
                }
            }
            
            console.log('📋 Lade Spy-Reports für Allianz:', alliance);
            
            // Einfachste Query ohne orderBy um Index-Probleme komplett zu vermeiden
            let query = this.db.collection('allianceSpyReports')
                .where('allianceName', '==', alliance);
            
            // Limit
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            const snapshot = await query.get();
            const reports = [];
            
            snapshot.forEach(doc => {
                reports.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Client-seitige Sortierung nach createdAt (neueste zuerst)
            reports.sort((a, b) => {
                const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
                const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                return dateB - dateA; // Absteigend (neueste zuerst)
            });
            
            console.log(`✅ ${reports.length} Spy-Reports geladen`);
            return reports;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden der Spy-Reports:', error);
            throw error;
        }
    }
    
    /**
     * Lädt einen spezifischen Spy-Report
     * @param {string} reportId - Die Document-ID
     * @returns {Promise<Object|null>} - Der Spy-Report oder null
     */
    async getSpyReport(reportId) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }
            
            const doc = await this.db.collection('allianceSpyReports').doc(reportId).get();
            
            if (doc.exists) {
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden des Spy-Reports:', error);
            throw error;
        }
    }
    
    /**
     * Löscht einen Spy-Report
     * @param {string} reportId - Die Document-ID
     * @returns {Promise<boolean>} - Erfolg
     */
    async deleteSpyReport(reportId) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }
            
            // Prüfe Berechtigung
            const report = await this.getSpyReport(reportId);
            if (!report) {
                throw new Error('Spy-Report nicht gefunden');
            }
            
            // Nur der Ersteller oder Alliance-Admin kann löschen
            const canDelete = report.addedBy === this.currentUser?.uid || 
                            await this.isAllianceAdmin();
            
            if (!canDelete) {
                throw new Error('Keine Berechtigung zum Löschen');
            }
            
            await this.db.collection('allianceSpyReports').doc(reportId).delete();
            
            console.log('✅ Spy-Report gelöscht:', reportId);
            
            // Activity-Log hinzufügen
            await this.addActivityLog('spy_report_deleted', {
                reportId: report.reportId,
                playerName: report.playerName,
                planetCoordinates: report.planetCoordinates
            });
            
            return true;
            
        } catch (error) {
            console.error('❌ Fehler beim Löschen des Spy-Reports:', error);
            throw error;
        }
    }
    
    /**
     * Sucht Spy-Reports nach verschiedenen Kriterien
     * @param {Object} searchCriteria - Suchkriterien
     * @returns {Promise<Array>} - Gefundene Spy-Reports
     */
    async searchSpyReports(searchCriteria) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }
            
            const alliance = searchCriteria.allianceName || this.currentAlliance;
            if (!alliance) {
                throw new Error('Keine Allianz zugeordnet');
            }
            
            console.log('🔍 Suche Spy-Reports mit Kriterien:', searchCriteria);
            
            let query = this.db.collection('allianceSpyReports')
                .where('allianceName', '==', alliance);
            
            // Suchkriterien anwenden
            if (searchCriteria.playerName) {
                query = query.where('playerName', '>=', searchCriteria.playerName)
                           .where('playerName', '<=', searchCriteria.playerName + '\uf8ff');
            }
            
            if (searchCriteria.planetName) {
                query = query.where('planetName', '>=', searchCriteria.planetName)
                           .where('planetName', '<=', searchCriteria.planetName + '\uf8ff');
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
            
            // Zeitraum
            if (searchCriteria.fromDate) {
                query = query.where('createdAt', '>=', searchCriteria.fromDate);
            }
            
            if (searchCriteria.toDate) {
                query = query.where('createdAt', '<=', searchCriteria.toDate);
            }
            
            // Sortierung
            const sortField = searchCriteria.sortBy || 'createdAt';
            const sortDirection = searchCriteria.sortDirection || 'desc';
            query = query.orderBy(sortField, sortDirection);
            
            // Limit
            const limit = searchCriteria.limit || 50;
            query = query.limit(limit);
            
            const snapshot = await query.get();
            const reports = [];
            
            snapshot.forEach(doc => {
                reports.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            console.log(`✅ ${reports.length} Spy-Reports gefunden`);
            return reports;
            
        } catch (error) {
            console.error('❌ Fehler bei der Spy-Report-Suche:', error);
            throw error;
        }
    }
    
    /**
     * Lädt Statistiken für eine Allianz
     * @param {string} allianceName - Name der Allianz
     * @returns {Promise<Object>} - Allianz-Statistiken
     */
    async getAllianceStatistics(allianceName = null) {
        try {
            if (!this.db) {
                throw new Error('Firebase nicht initialisiert');
            }
            
            let alliance = allianceName || this.currentAlliance;
            
            // Fallback: Versuche Allianz-Daten aus verschiedenen Quellen zu laden
            if (!alliance) {
                console.warn('⚠️ Keine Allianz-Daten gefunden, versuche Fallback...');
                
                // 1. Versuche SessionAPI
                if (window.SessionAPI) {
                    const allianceData = window.SessionAPI.getAllianceData();
                    alliance = allianceData?.name || allianceData;
                    console.log('📋 Allianz aus SessionAPI (Fallback):', alliance);
                }
                
                // 2. Versuche localStorage
                if (!alliance) {
                    const storedAlliance = localStorage.getItem('currentAlliance');
                    if (storedAlliance) {
                        try {
                            const allianceData = JSON.parse(storedAlliance);
                            alliance = allianceData.name || allianceData;
                            console.log('📋 Allianz aus localStorage (Fallback):', alliance);
                        } catch (error) {
                            console.warn('⚠️ Fehler beim Parsen der localStorage Allianz-Daten:', error);
                        }
                    }
                }
                
                if (!alliance) {
                    throw new Error('Keine Allianz zugeordnet. Bitte melde dich über das User-Dashboard an.');
                }
            }
            
            console.log('📊 Lade Allianz-Statistiken für:', alliance);
            
            // Alle Reports der Allianz laden
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
                // Eindeutige Spieler und Planeten
                stats.uniquePlayers.add(report.playerName);
                stats.uniquePlanets.add(report.planetCoordinates);
                
                // Bedrohungsstufen
                const threatLevel = report.threatLevel || 'unknown';
                stats.threatLevels[threatLevel] = (stats.threatLevels[threatLevel] || 0) + 1;
                
                // Summen
                stats.totalAttackPower += report.totalAttackPower || 0;
                stats.totalDefensePower += report.totalDefensePower || 0;
                stats.totalResources += report.totalResources || 0;
                
                // Durchschnitte
                if (report.statistics) {
                    totalResearch += report.statistics.researchLevel || 0;
                    totalBuildings += report.statistics.buildingLevel || 0;
                }
                
                // Monatsstatistiken
                const month = report.createdAt.toDate().toISOString().slice(0, 7);
                stats.reportsByMonth[month] = (stats.reportsByMonth[month] || 0) + 1;
            });
            
            // Berechne Durchschnitte
            stats.uniquePlayers = stats.uniquePlayers.size;
            stats.uniquePlanets = stats.uniquePlanets.size;
            stats.averageResearchLevel = reports.length > 0 ? totalResearch / reports.length : 0;
            stats.averageBuildingLevel = reports.length > 0 ? totalBuildings / reports.length : 0;
            
            // Top Spieler (nach Anzahl Reports)
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
     * Prüft, ob der aktuelle User Alliance-Admin ist
     * @returns {Promise<boolean>} - True wenn Admin
     */
    async isAllianceAdmin() {
        try {
            if (!this.currentUser) return false;
            
            // Verwende AlliancePermissionManager falls verfügbar
            if (window.alliancePermissionManager) {
                return window.alliancePermissionManager.isAllianceAdmin();
            }
            
            // Fallback: Prüfe User-Daten
            const userData = window.AuthAPI?.getUserData();
            return userData?.isAllianceAdmin === true;
            
        } catch (error) {
            console.warn('⚠️ Fehler beim Prüfen der Alliance-Admin-Berechtigung:', error);
            return false;
        }
    }
    
    /**
     * Fügt einen Activity-Log-Eintrag hinzu
     * @param {string} action - Die Aktion
     * @param {Object} data - Zusätzliche Daten
     */
    async addActivityLog(action, data = {}) {
        try {
            if (!this.db || !this.currentUser) return;
            
            const logEntry = {
                action,
                data,
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                allianceName: this.currentAlliance,
                timestamp: new Date()
            };
            
            await this.db.collection('allianceActivityLogs').add(logEntry);
            
        } catch (error) {
            console.warn('⚠️ Fehler beim Hinzufügen des Activity-Logs:', error);
        }
    }
    
    /**
     * Prüft, ob ein Report bereits existiert
     * @param {string} reportId - Die Report-ID
     * @param {string} allianceName - Name der Allianz
     * @returns {Promise<boolean>} - True wenn bereits vorhanden
     */
    async reportExists(reportId, allianceName = null) {
        try {
            if (!this.db) {
                return false;
            }
            
            const alliance = allianceName || this.currentAlliance;
            if (!alliance) {
                return false;
            }
            
            const query = this.db.collection('allianceSpyReports')
                .where('reportId', '==', reportId)
                .where('allianceName', '==', alliance)
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
    saveReport: (reportData, allianceName) => window.spyDatabaseManager.saveSpyReport(reportData, allianceName),
    getAllianceReports: (allianceName, options) => window.spyDatabaseManager.getAllianceSpyReports(allianceName, options),
    getReport: (reportId) => window.spyDatabaseManager.getSpyReport(reportId),
    deleteReport: (reportId) => window.spyDatabaseManager.deleteSpyReport(reportId),
    searchReports: (criteria) => window.spyDatabaseManager.searchSpyReports(criteria),
    getStatistics: (allianceName) => window.spyDatabaseManager.getAllianceStatistics(allianceName),
    reportExists: (reportId, allianceName) => window.spyDatabaseManager.reportExists(reportId, allianceName),
    isAdmin: () => window.spyDatabaseManager.isAllianceAdmin()
};

console.log('🗄️ SpyDatabaseAPI verfügbar: window.SpyDatabaseAPI');