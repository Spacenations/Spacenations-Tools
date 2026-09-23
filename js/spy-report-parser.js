/**
 * Spy Report Parser - Individuelle Allianz Spionage-Bericht-Datenbank
 * Parsed normale Spy-Report URLs und extrahiert Daten via API
 */

class SpyReportParser {
    constructor() {
        this.apiBaseUrl = 'https://beta1.game.spacenations.eu/api/spy-report/';
        this.init();
    }
    
    init() {
        console.log('🕵️ Spy Report Parser initialisiert');
    }
    
    /**
     * Extrahiert Report-ID aus einer Spy-Report URL
     * @param {string} url - Die Spy-Report URL
     * @returns {string|null} - Die Report-ID oder null
     */
    extractReportId(url) {
        try {
            // Verschiedene URL-Formate unterstützen
            const patterns = [
                /\/spy-report\/([a-zA-Z0-9_-]+)/,  // Standard Format
                /spy-report\/([a-zA-Z0-9_-]+)/,    // Ohne führenden Slash
                /([a-zA-Z0-9_-]{20,})/             // Direkte ID (mindestens 20 Zeichen)
            ];
            
            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) {
                    console.log('✅ Report-ID extrahiert:', match[1]);
                    return match[1];
                }
            }
            
            console.warn('⚠️ Keine gültige Report-ID in URL gefunden:', url);
            return null;
            
        } catch (error) {
            console.error('❌ Fehler beim Extrahieren der Report-ID:', error);
            return null;
        }
    }
    
    /**
     * Lädt Spy-Report Daten von der API
     * @param {string} reportId - Die Report-ID
     * @returns {Promise<Object|null>} - Die Report-Daten oder null
     */
    async fetchReportData(reportId) {
        try {
            console.log('📡 Lade Spy-Report Daten für ID:', reportId);
            
            const apiUrl = `${this.apiBaseUrl}${reportId}`;
            console.log('🔗 API-URL:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Spacenations-Tools/1.0'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('✅ Spy-Report Daten erfolgreich geladen');
            
            return data;
            
        } catch (error) {
            console.error('❌ Fehler beim Laden der Spy-Report Daten:', error);
            throw error;
        }
    }
    
    /**
     * Parsed und validiert Spy-Report Daten
     * @param {Object} rawData - Die rohen API-Daten
     * @returns {Object} - Validierte und strukturierte Daten
     */
    parseReportData(rawData) {
        try {
            if (!rawData || !rawData.report) {
                throw new Error('Ungültige API-Antwort: Keine Report-Daten');
            }
            
            const report = rawData.report;
            const timestamp = rawData.time || new Date().toISOString();
            
            // Grunddaten extrahieren
            const parsedData = {
                // Metadaten
                timestamp: new Date(timestamp),
                reportId: this.extractReportIdFromData(rawData),
                originalUrl: '', // Wird später gesetzt
                
                // Planet-Daten (Name & Koordinaten)
                planet: {
                    name: report.planet?.name || 'Unbekannter Planet',
                    coordinates: report.planet?.coordinates || 'Unbekannt',
                    levels: report.planet?.levels || {},
                    recycling: report.planet?.recycling || {}
                },
                
                // Besitzer/Spielername
                player: {
                    name: report.player?.name || 'Unbekannter Spieler',
                    allianceName: report.player?.allianceName || null,
                    metaName: report.player?.metaName || null
                },
                
                // Ressourcen - Einzelauflistung
                resources: {
                    fe: this.parseResourceAmount(report.resources?.fe),
                    si: this.parseResourceAmount(report.resources?.si),
                    c: this.parseResourceAmount(report.resources?.c),
                    water: this.parseResourceAmount(report.resources?.water),
                    oxygen: this.parseResourceAmount(report.resources?.oxygen),
                    hydrogen: this.parseResourceAmount(report.resources?.hydrogen),
                    // Zusätzliche Ressourcen falls vorhanden
                    additional: this.parseAdditionalResources(report.resources)
                },
                
                // Gebäude - Einzelauflistung Name + Stufe
                buildings: this.parseBuildings(report.buildings || {}),
                
                // Forschung - Einzelauflistung Name + Stufe
                research: this.parseResearch(report.player?.research || {}),
                
                // Schiffstypen - Auflistung Name + Eigenschaften
                shipTypes: this.parseShipTypes(report.player?.shipTypes || []),
                
                // Flotten-Details
                fleets: {
                    stationed: report.stationedShips || [],
                    uncloaked: report.uncloakedFleets || [],
                    cloaked: report.cloakedFleets || {}
                },
                
                // Verteidigung
                defense: report.defense || [],
                
                // Fleet-Daten (für die spionierte Flotte)
                fleet: report.fleet || {},
                
                // Legacy-Daten für Kompatibilität
                legacy: {
                    buildings: report.buildings || {},
                    resources: report.resources || {},
                    player: {
                        research: report.player?.research || {},
                        shipTypes: report.player?.shipTypes || []
                    }
                }
            };
            
            // Berechne zusätzliche Statistiken
            parsedData.statistics = this.calculateStatistics(parsedData);
            
            console.log('✅ Spy-Report Daten erfolgreich geparst');
            return parsedData;
            
        } catch (error) {
            console.error('❌ Fehler beim Parsen der Spy-Report Daten:', error);
            throw error;
        }
    }
    
    /**
     * Extrahiert Report-ID aus den Daten (falls vorhanden)
     * @param {Object} data - Die API-Daten
     * @returns {string} - Die Report-ID
     */
    extractReportIdFromData(data) {
        // Versuche verschiedene Wege, die ID zu finden
        if (data.reportId) return data.reportId;
        if (data.id) return data.id;
        
        // Generiere eine ID basierend auf Timestamp und Spielername
        const timestamp = data.time || new Date().toISOString();
        const playerName = data.report?.player?.name || 'unknown';
        return `${playerName}_${timestamp.slice(0, 10)}_${Date.now()}`;
    }
    
    /**
     * Parst Ressourcen-Mengen in einheitliches Format
     * @param {*} resource - Die Ressource (Zahl, String oder Objekt)
     * @returns {Object} - Formatierte Ressourcen-Daten
     */
    parseResourceAmount(resource) {
        if (typeof resource === 'number') {
            return {
                amount: resource,
                formatted: this.formatNumber(resource)
            };
        } else if (typeof resource === 'string') {
            const amount = parseFloat(resource) || 0;
            return {
                amount: amount,
                formatted: this.formatNumber(amount)
            };
        } else if (resource && typeof resource === 'object') {
            return {
                amount: resource.amount || resource.value || 0,
                formatted: this.formatNumber(resource.amount || resource.value || 0)
            };
        }
        return {
            amount: 0,
            formatted: '0'
        };
    }
    
    /**
     * Parst zusätzliche Ressourcen
     * @param {Object} resources - Die Ressourcen-Daten
     * @returns {Array} - Liste der zusätzlichen Ressourcen
     */
    parseAdditionalResources(resources) {
        const additional = [];
        const standardResources = ['fe', 'si', 'c', 'water', 'oxygen', 'hydrogen'];
        
        for (const [key, value] of Object.entries(resources)) {
            if (!standardResources.includes(key) && value !== undefined && value !== null) {
                additional.push({
                    name: key,
                    amount: this.parseResourceAmount(value).amount,
                    formatted: this.parseResourceAmount(value).formatted
                });
            }
        }
        
        return additional;
    }
    
    /**
     * Parst Gebäude-Daten in strukturiertes Format
     * @param {Object} buildings - Die Gebäude-Daten
     * @returns {Array} - Liste der Gebäude mit Namen und Stufen
     */
    parseBuildings(buildings) {
        const buildingList = [];
        
        for (const [buildingName, level] of Object.entries(buildings)) {
            if (level !== undefined && level !== null && level > 0) {
                buildingList.push({
                    name: this.formatBuildingName(buildingName),
                    level: level,
                    rawName: buildingName
                });
            }
        }
        
        // Sortiere nach Stufe (absteigend)
        return buildingList.sort((a, b) => b.level - a.level);
    }
    
    /**
     * Parst Forschungs-Daten in strukturiertes Format
     * @param {Object} research - Die Forschungs-Daten
     * @returns {Array} - Liste der Forschungen mit Namen und Stufen
     */
    parseResearch(research) {
        const researchList = [];
        
        for (const [researchName, level] of Object.entries(research)) {
            if (level !== undefined && level !== null && level > 0) {
                researchList.push({
                    name: this.formatResearchName(researchName),
                    level: level,
                    rawName: researchName
                });
            }
        }
        
        // Sortiere nach Stufe (absteigend)
        return researchList.sort((a, b) => b.level - a.level);
    }
    
    /**
     * Parst Schiffstypen-Daten in strukturiertes Format
     * @param {Array} shipTypes - Die Schiffstypen-Daten
     * @returns {Array} - Liste der Schiffstypen mit Eigenschaften
     */
    parseShipTypes(shipTypes) {
        if (!Array.isArray(shipTypes)) return [];
        
        return shipTypes.map(ship => ({
            name: ship.name || 'Unbekanntes Schiff',
            type: ship.type || 'unknown',
            count: ship.count || 0,
            properties: {
                attack: ship.attack || 0,
                defense: ship.defense || 0,
                speed: ship.speed || 0,
                capacity: ship.capacity || 0,
                fuel: ship.fuel || 0
            },
            raw: ship
        }));
    }
    
    /**
     * Formatiert Zahlen für bessere Lesbarkeit
     * @param {number} num - Die zu formatierende Zahl
     * @returns {string} - Formatierte Zahl
     */
    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }
    
    /**
     * Formatiert Gebäude-Namen für bessere Lesbarkeit
     * @param {string} name - Der rohe Gebäude-Name
     * @returns {string} - Formatierter Name
     */
    formatBuildingName(name) {
        const buildingNames = {
            'metalMine': 'Metall-Mine',
            'crystalMine': 'Kristall-Mine',
            'deuteriumMine': 'Deuterium-Mine',
            'solarPlant': 'Solarkraftwerk',
            'fusionPlant': 'Fusionskraftwerk',
            'metalStorage': 'Metall-Lager',
            'crystalStorage': 'Kristall-Lager',
            'deuteriumStorage': 'Deuterium-Lager',
            'researchLab': 'Forschungslabor',
            'shipyard': 'Raumwerft',
            'defenseStation': 'Verteidigungsstation',
            'missileSilo': 'Raketensilo',
            'naniteFactory': 'Naniten-Fabrik',
            'terraformer': 'Terraformer',
            'spaceDock': 'Weltraumdock'
        };
        
        return buildingNames[name] || name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
    
    /**
     * Formatiert Forschungs-Namen für bessere Lesbarkeit
     * @param {string} name - Der rohe Forschungs-Name
     * @returns {string} - Formatierter Name
     */
    formatResearchName(name) {
        const researchNames = {
            'energy': 'Energietechnik',
            'laser': 'Lasertechnik',
            'ion': 'Ionentechnik',
            'hyperspace': 'Hyperraumtechnik',
            'plasma': 'Plasmatechnik',
            'combustion': 'Verbrennungstriebwerk',
            'impulse': 'Impulstriebwerk',
            'hyperspaceEngine': 'Hyperraumtriebwerk',
            'spy': 'Spionagetechnik',
            'computer': 'Computertechnik',
            'astrophysics': 'Astrophysik',
            'intergalactic': 'Intergalaktisches Forschungsnetzwerk',
            'graviton': 'Gravitontechnik',
            'weapon': 'Waffentechnik',
            'shield': 'Schildtechnik',
            'armor': 'Panzerungstechnik'
        };
        
        return researchNames[name] || name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
    
    /**
     * Bestimmt die Bedrohungsstufe basierend auf den Statistiken
     * @param {Object} stats - Die Statistiken
     * @returns {string} - Die Bedrohungsstufe
     */
    determineThreatLevel(stats) {
        const { totalAttackPower, totalDefensePower, researchLevel, buildingLevel } = stats;
        
        // Gewichtete Bewertung
        const attackScore = Math.min(totalAttackPower / 100000, 10); // Max 10 Punkte
        const defenseScore = Math.min(totalDefensePower / 50000, 10); // Max 10 Punkte
        const researchScore = Math.min(researchLevel / 5, 10); // Max 10 Punkte
        const buildingScore = Math.min(buildingLevel / 5, 10); // Max 10 Punkte
        
        const totalScore = attackScore + defenseScore + researchScore + buildingScore;
        
        if (totalScore >= 35) return 'very_high';
        if (totalScore >= 25) return 'high';
        if (totalScore >= 15) return 'medium';
        if (totalScore >= 5) return 'low';
        return 'very_low';
    }
    
    /**
     * Berechnet zusätzliche Statistiken aus den Report-Daten
     * @param {Object} data - Die geparsten Daten
     * @returns {Object} - Berechnete Statistiken
     */
    calculateStatistics(data) {
        const stats = {
            totalAttackPower: 0,
            totalDefensePower: 0,
            totalResources: 0,
            researchLevel: 0,
            buildingLevel: 0,
            fleetCount: 0,
            threatLevel: 'unknown',
            // Neue Statistiken für detaillierte Berichte
            resourceBreakdown: {},
            buildingCount: 0,
            researchCount: 0,
            shipTypeCount: 0
        };
        
        try {
            // Angriffsstärke berechnen
            if (data.fleets.uncloaked) {
                data.fleets.uncloaked.forEach(fleet => {
                    stats.totalAttackPower += fleet.stats?.attack || 0;
                });
            }
            
            // Verteidigungsstärke berechnen
            if (data.defense) {
                data.defense.forEach(defense => {
                    stats.totalDefensePower += defense.attack || 0;
                });
            }
            
            // Gesamtressourcen berechnen (neue Struktur)
            if (data.resources) {
                const resourceTypes = ['fe', 'si', 'c', 'water', 'oxygen', 'hydrogen'];
                resourceTypes.forEach(type => {
                    if (data.resources[type]) {
                        const amount = data.resources[type].amount || 0;
                        stats.totalResources += amount;
                        stats.resourceBreakdown[type] = {
                            amount: amount,
                            formatted: data.resources[type].formatted
                        };
                    }
                });
                
                // Zusätzliche Ressourcen
                if (data.resources.additional) {
                    data.resources.additional.forEach(resource => {
                        stats.totalResources += resource.amount;
                        stats.resourceBreakdown[resource.name] = {
                            amount: resource.amount,
                            formatted: resource.formatted
                        };
                    });
                }
            }
            
            // Forschungslevel berechnen (neue Struktur)
            if (data.research) {
                stats.researchCount = data.research.length;
                stats.researchLevel = data.research.reduce((sum, research) => sum + research.level, 0);
            }
            
            // Gebäudelevel berechnen (neue Struktur)
            if (data.buildings) {
                stats.buildingCount = data.buildings.length;
                stats.buildingLevel = data.buildings.reduce((sum, building) => sum + building.level, 0);
            }
            
            // Schiffstypen zählen
            if (data.shipTypes) {
                stats.shipTypeCount = data.shipTypes.length;
            }
            
            // Flottenanzahl
            stats.fleetCount = (data.fleets.uncloaked?.length || 0) + (data.fleets.stationed?.length || 0);
            
            // Bedrohungsstufe berechnen
            stats.threatLevel = this.calculateThreatLevel(stats);
            
        } catch (error) {
            console.warn('⚠️ Fehler beim Berechnen der Statistiken:', error);
        }
        
        return stats;
    }
    
    /**
     * Berechnet die Bedrohungsstufe basierend auf den Statistiken
     * @param {Object} stats - Die Statistiken
     * @returns {string} - Die Bedrohungsstufe
     */
    calculateThreatLevel(stats) {
        const { totalAttackPower, totalDefensePower, researchLevel, buildingLevel } = stats;
        
        // Gewichtete Bewertung
        const attackScore = Math.min(totalAttackPower / 100000, 10); // Max 10 Punkte
        const defenseScore = Math.min(totalDefensePower / 50000, 10); // Max 10 Punkte
        const researchScore = Math.min(researchLevel / 5, 10); // Max 10 Punkte
        const buildingScore = Math.min(buildingLevel / 5, 10); // Max 10 Punkte
        
        const totalScore = attackScore + defenseScore + researchScore + buildingScore;
        
        if (totalScore >= 35) return 'very_high';
        if (totalScore >= 25) return 'high';
        if (totalScore >= 15) return 'medium';
        if (totalScore >= 5) return 'low';
        return 'very_low';
    }
    
    /**
     * Hauptfunktion: Verarbeitet eine Spy-Report URL
     * @param {string} url - Die Spy-Report URL
     * @returns {Promise<Object>} - Die verarbeiteten Daten
     */
    async processSpyReportUrl(url) {
        try {
            console.log('🕵️ Verarbeite Spy-Report URL:', url);
            
            // 1. Report-ID extrahieren
            const reportId = this.extractReportId(url);
            if (!reportId) {
                throw new Error('Keine gültige Report-ID gefunden');
            }
            
            // 2. Daten von API laden
            const rawData = await this.fetchReportData(reportId);
            
            // 3. Daten parsen und validieren
            const parsedData = this.parseReportData(rawData);
            
            // 4. Original-URL hinzufügen
            parsedData.originalUrl = url;
            parsedData.reportId = reportId;
            
            console.log('✅ Spy-Report erfolgreich verarbeitet:', parsedData.player.name);
            return parsedData;
            
        } catch (error) {
            console.error('❌ Fehler beim Verarbeiten der Spy-Report URL:', error);
            throw error;
        }
    }
    
    /**
     * Validiert, ob eine URL eine gültige Spy-Report URL ist
     * @param {string} url - Die zu validierende URL
     * @returns {boolean} - True wenn gültig
     */
    isValidSpyReportUrl(url) {
        if (!url || typeof url !== 'string') return false;
        
        // Verschiedene gültige Formate
        const validPatterns = [
            /https?:\/\/.*spacenations\.eu\/spy-report\/[a-zA-Z0-9_-]+/,
            /spacenations\.eu\/spy-report\/[a-zA-Z0-9_-]+/,
            /spy-report\/[a-zA-Z0-9_-]+/
        ];
        
        return validPatterns.some(pattern => pattern.test(url));
    }
    
    /**
     * Formatiert Bedrohungsstufe für UI-Anzeige
     * @param {string} threatLevel - Die Bedrohungsstufe
     * @returns {Object} - Formatierte Anzeige-Daten
     */
    formatThreatLevel(threatLevel) {
        const levels = {
            'very_low': { text: 'Sehr Niedrig', color: '#4CAF50', icon: '🟢' },
            'low': { text: 'Niedrig', color: '#8BC34A', icon: '🟡' },
            'medium': { text: 'Mittel', color: '#FF9800', icon: '🟠' },
            'high': { text: 'Hoch', color: '#F44336', icon: '🔴' },
            'very_high': { text: 'Sehr Hoch', color: '#9C27B0', icon: '⚫' }
        };
        
        return levels[threatLevel] || { text: 'Unbekannt', color: '#9AA1AC', icon: '⚪' };
    }
}

// Globale Instanz erstellen
window.spyReportParser = new SpyReportParser();

// Globale API für einfache Nutzung
window.SpyReportAPI = {
    processUrl: (url) => window.spyReportParser.processSpyReportUrl(url),
    isValidUrl: (url) => window.spyReportParser.isValidSpyReportUrl(url),
    extractId: (url) => window.spyReportParser.extractReportId(url),
    formatThreatLevel: (level) => window.spyReportParser.formatThreatLevel(level)
};

console.log('🕵️ SpyReportAPI verfügbar: window.SpyReportAPI');