/**
 * Enhanced Admin Dashboard Logic
 * - Comprehensive user management
 * - Alliance tracking and approval
 * - System monitoring
 * - ProximaDB integration
 * - Real-time updates
 */

(function(){
    const state = {
        users: [],
        alliances: [],
        allianceMembers: [],
        filtered: [],
        filteredAlliances: [],
        currentTab: 'users',
        systemStatus: {},
        proximaData: null,
        unsubUsers: null,
        unsubAlliances: null,
        unsubAllianceMembers: null,
        lastUpdate: null
    };

    // --- Hilfsfunktionen für das vereinheitlichte Rollen-/Allianz-Schema ---
    function membersOfAlliance(allianceId) {
        return state.allianceMembers.filter(m => m.allianceId === allianceId);
    }

    function founderOfAlliance(allianceId) {
        return membersOfAlliance(allianceId).find(m => m.role === 'founder');
    }

    function adminsOfAlliance(allianceId) {
        return membersOfAlliance(allianceId).filter(m => m.role === 'admin' || m.role === 'founder');
    }

    function membershipsOfUser(uid) {
        return state.allianceMembers.filter(m => m.uid === uid);
    }

    function allianceNameById(allianceId) {
        const alliance = state.alliances.find(a => a.id === allianceId);
        return alliance ? alliance.name : allianceId;
    }

    // Utility functions
    function formatTimestamp(ts){
        try {
            if (!ts) return '-';
            const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
            return d.toLocaleString('de-DE');
        } catch { return '-'; }
    }

    function formatDate(date) {
        try {
            const d = new Date(date);
            return d.toLocaleDateString('de-DE');
        } catch { return '-'; }
    }

    function getStatusIndicator(user) {
        const now = new Date();
        const lastLogin = user.lastLogin ? (user.lastLogin.toDate ? user.lastLogin.toDate() : new Date(user.lastLogin)) : null;
        
        if (!lastLogin) return '<span class="status-indicator status-offline"></span>Nie';
        
        const hoursAgo = (now - lastLogin) / (1000 * 60 * 60);
        if (hoursAgo < 1) return '<span class="status-indicator status-online"></span>Online';
        if (hoursAgo < 24) return `<span class="status-indicator status-online"></span>${Math.round(hoursAgo)}h`;
        if (hoursAgo < 168) return `<span class="status-indicator status-warning"></span>${Math.round(hoursAgo/24)}d`;
        return `<span class="status-indicator status-offline"></span>${Math.round(hoursAgo/24)}d`;
    }

    function hasFirstLogin(user) {
        return user.lastLogin && user.lastLogin.toDate ? user.lastLogin.toDate() > new Date(user.createdAt?.toDate?.() || user.createdAt) : false;
    }

    // Tab management
    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        state.currentTab = tabName;

        // Load tab-specific data
        switch(tabName) {
            case 'users':
                renderUsersTable();
                break;
            case 'alliances':
                loadAlliances();
                break;
            case 'analytics':
                loadAnalytics();
                break;
            case 'system':
                loadSystemStatus();
                break;
            case 'proxima':
                loadProximaData();
                break;
        }
    }

    // User statistics
    function renderStats(){
        const usersCount = state.users.length;

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        const active7d = state.users.filter(u => {
            if (!u.lastLogin) return false;
            const lastLogin = u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
            return lastLogin > weekAgo;
        }).length;

        const newToday = state.users.filter(u => {
            if (!u.createdAt) return false;
            const created = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
            return created >= today;
        }).length;

        const loginsToday = state.users.filter(u => {
            if (!u.lastLogin) return false;
            const lastLogin = u.lastLogin.toDate ? u.lastLogin.toDate() : new Date(u.lastLogin);
            return lastLogin >= today;
        }).length;

        const firstLoginsToday = state.users.filter(u => {
            return hasFirstLogin(u) && u.lastLogin && u.lastLogin.toDate && u.lastLogin.toDate() >= today;
        }).length;

        const alliancesCount = state.alliances.length;
        const pendingAlliances = state.alliances.filter(a => !a.approved).length;

        document.getElementById('stat-users').textContent = usersCount;
        document.getElementById('stat-users-new').textContent = `Neu heute: ${newToday}`;
        document.getElementById('stat-active').textContent = active7d;
        document.getElementById('stat-active-percent').textContent = `${Math.round((active7d/usersCount)*100)}%`;
        document.getElementById('stat-alliances').textContent = alliancesCount;
        document.getElementById('stat-alliances-pending').textContent = `Ausstehend: ${pendingAlliances}`;
        document.getElementById('stat-logins-today').textContent = loginsToday;
        document.getElementById('stat-first-logins').textContent = `Erstes Login: ${firstLoginsToday}`;
    }

    // User table rendering
    function rolePills(user){
        const pills = [];
        if (user.globalRole === 'global_admin') pills.push('<span class="pill super">Super</span>');
        membershipsOfUser(user.id).forEach(m => {
            if (m.role === 'admin' || m.role === 'founder') {
                pills.push(`<span class="pill admin">${allianceNameById(m.allianceId)}: ${m.role === 'founder' ? 'Gründer' : 'Admin'}</span>`);
            }
        });
        if (!pills.length) pills.push('<span class="pill user">User</span>');
        return `<div class="role">${pills.join('')}</div>`;
    }

    function userRow(user){
        const lastLogin = formatTimestamp(user.lastLogin);
        const firstLogin = hasFirstLogin(user) ? '✅ Ja' : '❌ Nein';
        const memberships = membershipsOfUser(user.id);
        const alliance = memberships.length ? memberships.map(m => allianceNameById(m.allianceId)).join(', ') : '-';
        const username = user.username || '-';
        const email = user.email || '-';
        const status = getStatusIndicator(user);

        return `
            <tr data-uid="${user.id}">
                <td>${status}</td>
                <td>${username}</td>
                <td>${email}</td>
                <td>${alliance}</td>
                <td>${firstLogin}</td>
                <td>${lastLogin}</td>
                <td>${rolePills(user)}</td>
                <td>
                    <div class="actions">
                        <button class="btn" data-action="toggle-super" title="Toggle Super Admin">⚡</button>
                        <button class="btn" data-action="change-password" title="Passwort ändern">🔑</button>
                        <button class="btn danger" data-action="delete-user" title="Benutzer löschen">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderUsersTable(){
        const body = document.getElementById('users-table-body');
        const list = state.filtered.length ? state.filtered : state.users;
        
        if (!list.length){
            body.innerHTML = '<tr><td colspan="8" style="text-align:center; color: var(--text-secondary)">Keine Benutzer gefunden</td></tr>';
            return;
        }
        
        body.innerHTML = list.map(userRow).join('');
    }

    // Alliance management
    async function loadAlliances() {
        try {
            const db = window.FirebaseConfig.getDB();
            const snapshot = await db.collection('alliances').orderBy('createdAt', 'desc').get();
            
            state.alliances = [];
            snapshot.forEach(doc => {
                state.alliances.push({ id: doc.id, ...doc.data() });
            });

            renderAllianceStats();
            renderAlliancesTable();
        } catch (error) {
            console.error('Fehler beim Laden der Allianzen:', error);
        }
    }

    function renderAllianceStats() {
        const total = state.alliances.length;
        const approved = state.alliances.filter(a => a.status === 'approved').length;
        const pending = state.alliances.filter(a => a.status === 'pending').length;
        const avgMembers = total > 0 ? Math.round(state.allianceMembers.length / total) : 0;

        document.getElementById('stat-alliances-total').textContent = total;
        document.getElementById('stat-alliances-approved').textContent = approved;
        document.getElementById('stat-alliances-pending-tab').textContent = pending;
        document.getElementById('stat-alliances-members').textContent = avgMembers;
    }

    function allianceRow(alliance) {
        let statusBadge = '';
        switch (alliance.status) {
            case 'approved':
                statusBadge = '<span class="pill approved">Genehmigt</span>';
                break;
            case 'pending':
                statusBadge = '<span class="pill pending">Ausstehend</span>';
                break;
            case 'rejected':
                statusBadge = '<span class="pill danger">Abgelehnt</span>';
                break;
            default:
                statusBadge = '<span class="pill user">Unbekannt</span>';
        }

        const created = formatTimestamp(alliance.createdAt);
        const members = membersOfAlliance(alliance.id).length;
        const founderMember = founderOfAlliance(alliance.id);
        const founder = founderMember ? founderMember.username : '-';
        const adminMembers = adminsOfAlliance(alliance.id).filter(m => m.role === 'admin');
        const admin = adminMembers.length ? adminMembers.map(m => m.username).join(', ') : 'Nicht gesetzt';
        const description = alliance.description ? `"${alliance.description}"` : '';

        return `
            <tr data-alliance-id="${alliance.id}">
                <td>
                    <div style="font-weight: 600;">${alliance.name || '-'}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${description}</div>
                </td>
                <td><span style="font-family: monospace; background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">${alliance.tag || '-'}</span></td>
                <td>${founder}</td>
                <td>${members}</td>
                <td>${statusBadge}</td>
                <td>${created}</td>
                <td>${admin}</td>
                <td>
                    <div class="actions">
                        ${alliance.status === 'pending' ? `
                            <button class="btn success" data-action="approve-alliance" title="Genehmigen">✅</button>
                            <button class="btn danger" data-action="reject-alliance" title="Ablehnen">❌</button>
                        ` : ''}
                        ${alliance.status === 'rejected' ? `
                            <button class="btn success" data-action="approve-alliance" title="Doch genehmigen">✅</button>
                        ` : ''}
                        <button class="btn" data-action="set-admin" title="Admin setzen">👑</button>
                        <button class="btn" data-action="view-details" title="Details anzeigen">👁️</button>
                        <button class="btn danger" data-action="delete-alliance" title="Löschen">🗑️</button>
                    </div>
                </td>
            </tr>
        `;
    }

    function renderAlliancesTable() {
        const body = document.getElementById('alliances-table-body');
        const list = state.filteredAlliances.length ? state.filteredAlliances : state.alliances;
        
        if (!list.length) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center; color: var(--text-secondary)">Keine Allianzen gefunden</td></tr>';
            return;
        }
        
        body.innerHTML = list.map(allianceRow).join('');
    }

    // System monitoring
    async function loadSystemStatus() {
        try {
            const db = window.FirebaseConfig.getDB();
            if (!db) {
                throw new Error('Firestore nicht verfügbar');
            }

            state.systemStatus = {
                firebase: 'online',
                timestamp: new Date(),
                usersCount: state.users.length,
                alliancesCount: state.alliances.length
            };

            renderSystemStatus();
            renderDatabaseStatus();
            loadRecentActivities();
        } catch (error) {
            console.error('System Status Fehler:', error);
            state.systemStatus = {
                firebase: 'offline',
                timestamp: new Date(),
                error: error.message
            };
            renderSystemStatus();
        }
    }

    function renderSystemStatus() {
        const grid = document.getElementById('system-status-grid');
        
        const systems = [
            { name: 'Firebase Database', status: state.systemStatus.firebase || 'unknown', icon: '🔥' },
            { name: 'User System', status: 'online', icon: '👥' },
            { name: 'Alliance System', status: 'online', icon: '🤝' },
            { name: 'ProximaDB', status: state.proximaData ? 'online' : 'offline', icon: '🌌' }
        ];

        grid.innerHTML = systems.map(system => `
            <div class="status-card ${system.status}">
                <div style="font-size: 2rem; margin-bottom: 10px;">${system.icon}</div>
                <div style="font-weight: 600; margin-bottom: 5px;">${system.name}</div>
                <div style="font-size: 0.9rem; color: var(--text-secondary);">${system.status.toUpperCase()}</div>
            </div>
        `).join('');
    }

    function renderDatabaseStatus() {
        const statusDiv = document.getElementById('database-status');
        const status = state.systemStatus.firebase || 'unknown';
        
        statusDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="status-indicator status-${status}"></span>
                <span>Firebase Database: ${status.toUpperCase()}</span>
                <span style="margin-left: auto; color: var(--text-secondary); font-size: 0.8rem;">
                    Letztes Update: ${formatTimestamp(state.systemStatus.timestamp)}
                </span>
            </div>
        `;
    }

    async function loadRecentActivities() {
        try {
            const db = window.FirebaseConfig.getDB();
            const snapshot = await db.collection('userActivities')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            const activities = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                activities.push({
                    icon: data.icon || '📝',
                    text: data.text || 'Unbekannte Aktivität',
                    timestamp: data.timestamp
                });
            });

            const activitiesDiv = document.getElementById('recent-activities');
            activitiesDiv.innerHTML = activities.map(activity => `
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="font-size: 1.2rem;">${activity.icon}</span>
                    <span style="flex: 1;">${activity.text}</span>
                    <span style="color: var(--text-secondary); font-size: 0.8rem;">${formatTimestamp(activity.timestamp)}</span>
                </div>
            `).join('') || '<div style="color: var(--text-secondary); text-align: center;">Keine Aktivitäten gefunden</div>';
        } catch (error) {
            console.error('Fehler beim Laden der Aktivitäten:', error);
            document.getElementById('recent-activities').innerHTML = '<div style="color: #ef4444;">Fehler beim Laden der Aktivitäten</div>';
        }
    }

    // Analytics integration
    async function loadAnalytics() {
        try {
            if (window.AnalyticsDashboardAPI) {
                await window.AnalyticsDashboardAPI.initializeDashboard('analytics-content');
            } else {
                document.getElementById('analytics-content').innerHTML = `
                    <div class="error">
                        <h3>❌ Analytics-Modul nicht verfügbar</h3>
                        <p>Das Analytics-Modul konnte nicht geladen werden.</p>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Fehler beim Laden der Analytics:', error);
            document.getElementById('analytics-content').innerHTML = `
                <div class="error">
                    <h3>❌ Fehler beim Laden der Analytics</h3>
                    <p>${error.message}</p>
                </div>
            `;
        }
    }

    // ProximaDB integration - ruft dieselbe externe Spiel-API direkt auf wie
    // ProximaDB.html. Die frühere Python/SQLite-Pipeline wurde entfernt, da sie auf
    // Railway nie persistierte und den falschen Rhythmus fuhr (siehe Systemanalyse).
    const PROXIMA_API_URL = '/api/proxima';  // Server-Proxy - echte Spiel-API bleibt verborgen

    async function loadProximaData() {
        try {
            const response = await fetch(PROXIMA_API_URL, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const data = await response.json();
            state.proximaData = Array.isArray(data) ? data : [];

            document.getElementById('proxima-total-systems').textContent = state.proximaData.length;
            document.getElementById('proxima-last-update').textContent = formatDate(new Date());
            document.getElementById('proxima-update-status').textContent = 'Live (direkter API-Abruf)';
            document.getElementById('proxima-next-update').textContent = '-';

            renderProximaStats();
        } catch (error) {
            console.error('ProximaDB Fehler:', error);
            document.getElementById('proxima-total-systems').textContent = 'Fehler';
            document.getElementById('proxima-last-update').textContent = 'Fehler';
            document.getElementById('proxima-update-status').textContent = error.message;
            document.getElementById('proxima-next-update').textContent = '-';
        }
    }

    function renderProximaStats() {
        if (!state.proximaData || state.proximaData.length === 0) return;

        const sorted = [...state.proximaData].sort((a, b) => (b.score || 0) - (a.score || 0));
        const stats = {
            topSystem: sorted[0]?.name || 'Unbekannt',
            topScore: sorted[0]?.score || 0,
            averageScore: Math.round(state.proximaData.reduce((sum, system) => sum + (system.score || 0), 0) / state.proximaData.length)
        };

        document.getElementById('proxima-stats').innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                    <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-primary);">${stats.topSystem}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Top System (Score: ${stats.topScore})</div>
                </div>
                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
                    <div style="font-size: 1.2rem; font-weight: 600; color: var(--accent-primary);">${stats.averageScore}</div>
                    <div style="font-size: 0.9rem; color: var(--text-secondary);">Durchschnitts-Score</div>
                </div>
            </div>
        `;
    }

    // User management functions
    async function addUser(userData) {
        try {
            const auth = window.FirebaseConfig.getAuth();
            const db = window.FirebaseConfig.getDB();
            
            // Create user with email and password
            const userCredential = await auth.createUserWithEmailAndPassword(userData.email, userData.password);
            
            // Update user profile
            await userCredential.user.updateProfile({
                displayName: userData.username
            });

            // Save additional data to Firestore
            await db.collection('users').doc(userCredential.user.uid).set({
                username: userData.username,
                email: userData.email,
                globalRole: userData.isSuperAdmin ? 'global_admin' : 'user',
                isActive: true,
                createdAt: window.FirebaseConfig.getServerTimestamp(),
                lastLogin: null,
                createdBy: window.AuthAPI.getCurrentUser().uid
            });

            // Log activity
            await db.collection('userActivities').add({
                userId: window.AuthAPI.getCurrentUser().uid,
                icon: '👤',
                text: `Neuen Benutzer erstellt: ${userData.username}`,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });

            console.log('Benutzer erfolgreich erstellt');
            return { success: true };
        } catch (error) {
            console.error('Fehler beim Erstellen des Benutzers:', error);
            return { success: false, error: error.message };
        }
    }

    async function changeUserPassword(userId, newPassword) {
        // Der Client kann fremde Firebase-Auth-Passwörter nicht ändern - das erfordert das
        // Admin SDK in einer Cloud Function, die in diesem Projekt nicht deployt ist. Diese
        // Anfrage wird protokolliert, aber NICHT automatisch verarbeitet.
        try {
            const db = window.FirebaseConfig.getDB();

            await db.collection('userPasswordChanges').add({
                userId: userId,
                requestedBy: window.AuthAPI.getCurrentUser().uid,
                timestamp: window.FirebaseConfig.getServerTimestamp(),
                status: 'pending_manual_action'
            });

            return { success: true };
        } catch (error) {
            console.error('Fehler beim Protokollieren der Passwort-Änderung:', error);
            return { success: false, error: error.message };
        }
    }

    async function deleteUser(userId) {
        // Der Client kann nur das eigene Firestore-Profil löschen. Das zugehörige
        // Firebase-Auth-Konto kann aus Sicherheitsgründen nur serverseitig (Admin SDK /
        // Cloud Function) gelöscht werden, die in diesem Projekt nicht deployt ist - das
        // Auth-Konto bleibt also bestehen, bis das separat eingerichtet wird.
        try {
            const db = window.FirebaseConfig.getDB();

            await db.collection('users').doc(userId).delete();

            await db.collection('userActivities').add({
                userId: window.AuthAPI.getCurrentUser().uid,
                icon: '🗑️',
                text: `Benutzerprofil gelöscht: ${userId} (Auth-Konto bleibt bestehen)`,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Fehler beim Löschen des Benutzers:', error);
            return { success: false, error: error.message };
        }
    }

    // Alliance management functions
    async function approveAlliance(allianceId) {
        try {
            const db = window.FirebaseConfig.getDB();

            const allianceDoc = await db.collection('alliances').doc(allianceId).get();
            const allianceData = allianceDoc.data();

            if (!allianceData) {
                throw new Error('Allianz nicht gefunden');
            }

            await db.collection('alliances').doc(allianceId).update({
                status: 'approved',
                reviewedAt: window.FirebaseConfig.getServerTimestamp(),
                reviewedBy: window.AuthAPI.getCurrentUser().uid
            });

            // Die Founder-Mitgliedschaft (allianceMembers/{allianceId}_{founderUid}) wurde bereits
            // bei der Allianz-Erstellung angelegt - hier ist kein weiterer Schreibzugriff nötig.

            await db.collection('userActivities').add({
                userId: window.AuthAPI.getCurrentUser().uid,
                icon: '✅',
                text: `Allianz genehmigt: ${allianceData.name} [${allianceData.tag}]`,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Fehler beim Genehmigen der Allianz:', error);
            return { success: false, error: error.message };
        }
    }

    async function setAllianceAdmin(allianceId) {
        try {
            const db = window.FirebaseConfig.getDB();

            const allianceDoc = await db.collection('alliances').doc(allianceId).get();
            const allianceData = allianceDoc.data();

            if (!allianceData) {
                throw new Error('Allianz nicht gefunden');
            }

            const members = membersOfAlliance(allianceId);
            const newAdminName = prompt(`Neuer Allianz-Admin für "${allianceData.name} [${allianceData.tag}]":\n\nVerfügbare Mitglieder:\n${members.map(m => m.username).join('\n')}\n\nBenutzername eingeben:`);

            const target = members.find(m => m.username === newAdminName);
            if (!newAdminName || !target) {
                alert('Ungültiger Benutzername oder Benutzer ist kein Mitglied der Allianz!');
                return { success: false, error: 'Ungültiger Benutzername' };
            }

            const previousAdmins = adminsOfAlliance(allianceId).filter(m => m.role === 'admin' && m.uid !== target.uid);

            await db.collection('allianceMembers').doc(`${allianceId}_${target.uid}`).update({
                role: 'admin',
                lastUpdated: window.FirebaseConfig.getServerTimestamp()
            });

            // Vorherige (nicht-Gründer) Admins auf einfaches Mitglied zurückstufen.
            for (const previous of previousAdmins) {
                await db.collection('allianceMembers').doc(`${allianceId}_${previous.uid}`).update({
                    role: 'member',
                    lastUpdated: window.FirebaseConfig.getServerTimestamp()
                });
            }

            await db.collection('userActivities').add({
                userId: window.AuthAPI.getCurrentUser().uid,
                icon: '👑',
                text: `Allianz-Admin gesetzt: ${allianceData.name} [${allianceData.tag}] → ${newAdminName}`,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });

            return { success: true };
        } catch (error) {
            console.error('Fehler beim Setzen des Allianz-Admins:', error);
            return { success: false, error: error.message };
        }
    }

    async function rejectAlliance(allianceId) {
        try {
            const db = window.FirebaseConfig.getDB();
            
            // Hole die Allianz-Daten
            const allianceDoc = await db.collection('alliances').doc(allianceId).get();
            const allianceData = allianceDoc.data();
            
            if (!allianceData) {
                throw new Error('Allianz nicht gefunden');
            }
            
            await db.collection('alliances').doc(allianceId).update({
                status: 'rejected',
                rejectedAt: window.FirebaseConfig.getServerTimestamp(),
                rejectedBy: window.AuthAPI.getCurrentUser().uid
            });

            // Log activity
            await db.collection('userActivities').add({
                userId: window.AuthAPI.getCurrentUser().uid,
                icon: '❌',
                text: `Allianz abgelehnt: ${allianceData.name} [${allianceData.tag}]`,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });

            console.log('Allianz erfolgreich abgelehnt');
            return { success: true };
        } catch (error) {
            console.error('Fehler beim Ablehnen der Allianz:', error);
            return { success: false, error: error.message };
        }
    }

    async function viewAllianceDetails(allianceId) {
        try {
            const db = window.FirebaseConfig.getDB();
            const allianceDoc = await db.collection('alliances').doc(allianceId).get();
            const allianceData = allianceDoc.data();

            if (!allianceData) {
                throw new Error('Allianz nicht gefunden');
            }

            const memberList = membersOfAlliance(allianceId);
            const founderMember = founderOfAlliance(allianceId);
            const adminMembers = adminsOfAlliance(allianceId).filter(m => m.role === 'admin');

            // Erstelle Modal für Details
            const modal = document.createElement('div');
            modal.className = 'modal';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <h3>📋 Allianz Details: ${allianceData.name}</h3>
                    <div style="margin: 20px 0;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                            <div>
                                <strong>Name:</strong><br>
                                ${allianceData.name || '-'}
                            </div>
                            <div>
                                <strong>Tag:</strong><br>
                                <span style="font-family: monospace; background: var(--bg-secondary); padding: 4px 8px; border-radius: 4px;">${allianceData.tag || '-'}</span>
                            </div>
                            <div>
                                <strong>Gründer:</strong><br>
                                ${founderMember ? founderMember.username : '-'}
                            </div>
                            <div>
                                <strong>Admin:</strong><br>
                                ${adminMembers.length ? adminMembers.map(m => m.username).join(', ') : 'Nicht gesetzt'}
                            </div>
                            <div>
                                <strong>Status:</strong><br>
                                <span class="pill ${allianceData.status === 'approved' ? 'approved' : (allianceData.status === 'pending' ? 'pending' : 'danger')}">${allianceData.status}</span>
                            </div>
                            <div>
                                <strong>Mitglieder:</strong><br>
                                ${memberList.length}
                            </div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Beschreibung:</strong><br>
                            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; margin-top: 5px;">
                                ${allianceData.description || 'Keine Beschreibung'}
                            </div>
                        </div>
                        <div style="margin-bottom: 15px;">
                            <strong>Mitglieder-Liste:</strong><br>
                            <div style="background: var(--bg-secondary); padding: 10px; border-radius: 6px; margin-top: 5px; max-height: 150px; overflow-y: auto;">
                                ${memberList.length ? memberList.map(m => `• ${m.username} (${m.role})`).join('<br>') : 'Keine Mitglieder'}
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 0.9rem; color: var(--text-secondary);">
                            <div>
                                <strong>Erstellt:</strong><br>
                                ${formatTimestamp(allianceData.createdAt)}
                            </div>
                            <div>
                                <strong>Genehmigt:</strong><br>
                                ${allianceData.approvedAt ? formatTimestamp(allianceData.approvedAt) : 'Nicht genehmigt'}
                            </div>
                        </div>
                    </div>
                    <div class="controls">
                        <button class="btn" onclick="closeModal('alliance-details-modal')">Schließen</button>
                    </div>
                </div>
            `;
            
            modal.id = 'alliance-details-modal';
            document.body.appendChild(modal);
            
        } catch (error) {
            console.error('Fehler beim Anzeigen der Allianz-Details:', error);
            alert('Fehler beim Laden der Details: ' + error.message);
        }
    }

    async function deleteAlliance(allianceId) {
        try {
            const db = window.FirebaseConfig.getDB();
            
            // Hole die Allianz-Daten für Logging
            const allianceDoc = await db.collection('alliances').doc(allianceId).get();
            const allianceData = allianceDoc.data();
            
            await db.collection('alliances').doc(allianceId).delete();
            
            // Log activity
            await db.collection('userActivities').add({
                userId: window.AuthAPI.getCurrentUser().uid,
                icon: '🗑️',
                text: `Allianz gelöscht: ${allianceData?.name || allianceId}`,
                timestamp: window.FirebaseConfig.getServerTimestamp()
            });

            console.log('Allianz erfolgreich gelöscht');
            return { success: true };
        } catch (error) {
            console.error('Fehler beim Löschen der Allianz:', error);
            return { success: false, error: error.message };
        }
    }

    // Modal functions
    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'flex';
    }

    function closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    // Search functions
    function applySearch(){
        const q = (document.getElementById('search-input').value || '').toLowerCase();
        
        if (state.currentTab === 'users') {
            if (!q) { 
                state.filtered = []; 
                renderUsersTable(); 
                return; 
            }
            state.filtered = state.users.filter(u =>
                (u.username || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q) ||
                (u.alliance || '').toLowerCase().includes(q)
            );
            renderUsersTable();
        } else if (state.currentTab === 'alliances') {
            if (!q) { 
                state.filteredAlliances = []; 
                renderAlliancesTable(); 
                return; 
            }
            state.filteredAlliances = state.alliances.filter(a =>
                (a.name || '').toLowerCase().includes(q) ||
                (a.founderName || '').toLowerCase().includes(q) ||
                (a.founderEmail || '').toLowerCase().includes(q)
            );
            renderAlliancesTable();
        }
    }

    // Export functions
    async function exportUsersCSV(){
        const list = state.users;
        const headers = ['uid','username','email','alliances','globalRole','hasFirstLogin','createdAt','lastLogin'];
        const lines = [headers.join(';')];

        for (const u of list){
            const createdAt = u.createdAt ? (u.createdAt.toDate ? u.createdAt.toDate().toISOString() : new Date(u.createdAt).toISOString()) : '';
            const lastLogin = u.lastLogin ? (u.lastLogin.toDate ? u.lastLogin.toDate().toISOString() : new Date(u.lastLogin).toISOString()) : '';
            const hasFirst = hasFirstLogin(u) ? '1' : '0';
            const alliances = membershipsOfUser(u.id).map(m => `${allianceNameById(m.allianceId)}(${m.role})`).join(',');

            lines.push([
                u.id,
                JSON.stringify(u.username || ''),
                JSON.stringify(u.email || ''),
                JSON.stringify(alliances),
                u.globalRole || 'user',
                hasFirst,
                createdAt,
                lastLogin
            ].join(';'));
        }

        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // Role toggle functions
    async function toggleSuperAdmin(uid){
        const me = window.AuthAPI.getCurrentUser();
        if (me && me.uid === uid){
            if (!confirm('Sie sind dabei, Ihre eigene Super-Admin Rolle zu toggeln. Fortfahren?')) return;
        }
        
        const db = window.FirebaseConfig.getDB();
        const ref = db.collection('users').doc(uid);
        const doc = await ref.get();
        if (!doc.exists) return alert('Benutzer nicht gefunden');
        
        const val = doc.data().globalRole === 'global_admin';
        await ref.update({
            globalRole: val ? 'user' : 'global_admin',
            updatedAt: window.FirebaseConfig.getServerTimestamp(),
            updatedBy: me.uid
        });

        console.log(`✅ Super Admin Status für ${uid} auf ${!val} gesetzt`);
        
        // Log activity
        await db.collection('userActivities').add({
            userId: me.uid,
            icon: '⚡',
            text: `Super-Admin Status geändert für Benutzer ${uid}: ${!val}`,
            timestamp: window.FirebaseConfig.getServerTimestamp()
        });
    }

    // User subscription
    function subscribeUsers(force=false){
        const db = window.FirebaseConfig.getDB();
        if (state.unsubUsers && force){ 
            state.unsubUsers(); 
            state.unsubUsers = null; 
        }
        if (state.unsubUsers) return;
        
        state.unsubUsers = db.collection('users').orderBy('createdAt','desc').onSnapshot(snap => {
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            state.users = list;
            renderStats();
            applySearch();
            renderUsersTable();
        }, err => {
            console.error('Users subscribe error', err);
        });
    }

    // Alliance subscription
    function subscribeAlliances(force=false){
        const db = window.FirebaseConfig.getDB();
        if (state.unsubAlliances && force){ 
            state.unsubAlliances(); 
            state.unsubAlliances = null; 
        }
        if (state.unsubAlliances) return;
        
        state.unsubAlliances = db.collection('alliances').orderBy('createdAt','desc').onSnapshot(snap => {
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            state.alliances = list;
            renderAllianceStats();
            applySearch();
            renderAlliancesTable();
        }, err => {
            console.error('Alliances subscribe error', err);
        });
    }

    // Alliance-Mitgliedschaften (ersetzt das alte members-Array/admin-Feld auf alliances)
    function subscribeAllianceMembers(force=false){
        const db = window.FirebaseConfig.getDB();
        if (state.unsubAllianceMembers && force){
            state.unsubAllianceMembers();
            state.unsubAllianceMembers = null;
        }
        if (state.unsubAllianceMembers) return;

        state.unsubAllianceMembers = db.collection('allianceMembers').onSnapshot(snap => {
            const list = [];
            snap.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
            state.allianceMembers = list;
            renderStats();
            renderAllianceStats();
            renderUsersTable();
            renderAlliancesTable();
        }, err => {
            console.error('AllianceMembers subscribe error', err);
        });
    }

    // Event handlers
    function attachEvents(){
        // Logout
        document.getElementById('logout-btn').addEventListener('click', async () => {
            try { 
                await window.AuthAPI.logout(); 
                window.location.href = 'index.html'; 
            } catch {}
        });

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            subscribeUsers(true);
            subscribeAlliances(true);
            subscribeAllianceMembers(true);
            loadSystemStatus();
            loadProximaData();
        });

        // Export
        document.getElementById('export-users-btn').addEventListener('click', exportUsersCSV);

        // Search
        document.getElementById('search-btn').addEventListener('click', applySearch);
        document.getElementById('search-input').addEventListener('keyup', (e) => { 
            if (e.key === 'Enter') applySearch(); 
        });

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.getAttribute('data-tab'));
            });
        });

        // Add user buttons
        document.getElementById('add-user-btn').addEventListener('click', () => openModal('add-user-modal'));
        document.getElementById('add-user-tab-btn').addEventListener('click', () => openModal('add-user-modal'));

        // Add user form
        document.getElementById('add-user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = {
                email: document.getElementById('new-user-email').value,
                password: document.getElementById('new-user-password').value,
                username: document.getElementById('new-user-username').value,
                isSuperAdmin: document.getElementById('new-user-super-admin').checked
            };

            const result = await addUser(formData);
            if (result.success) {
                closeModal('add-user-modal');
                document.getElementById('add-user-form').reset();
                alert('Benutzer erfolgreich erstellt!');
            } else {
                alert('Fehler: ' + result.error);
            }
        });

        // Change password form
        document.getElementById('change-password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const userId = document.getElementById('change-password-user-id').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;

            if (newPassword !== confirmPassword) {
                alert('Passwörter stimmen nicht überein!');
                return;
            }

            const result = await changeUserPassword(userId, newPassword);
            if (result.success) {
                closeModal('change-password-modal');
                document.getElementById('change-password-form').reset();
                alert('Passwort-Änderung angefordert!');
            } else {
                alert('Fehler: ' + result.error);
            }
        });

        // User table actions
        document.getElementById('users-table-body').addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const tr = btn.closest('tr');
            const uid = tr?.getAttribute('data-uid');
            if (!uid) return;
            
            const action = btn.getAttribute('data-action');
            
            switch(action) {
                case 'toggle-super':
                    await toggleSuperAdmin(uid);
                    break;
                case 'change-password':
                    document.getElementById('change-password-user-id').value = uid;
                    openModal('change-password-modal');
                    break;
                case 'delete-user':
                    if (confirm('Benutzer wirklich löschen?')) {
                        await deleteUser(uid);
                    }
                    break;
            }
        });

        // Alliance table actions
        document.getElementById('alliances-table-body').addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            const tr = btn.closest('tr');
            const allianceId = tr?.getAttribute('data-alliance-id');
            if (!allianceId) return;
            
            const action = btn.getAttribute('data-action');
            
            switch(action) {
                case 'approve-alliance':
                    if (confirm('Allianz genehmigen?')) {
                        await approveAlliance(allianceId);
                    }
                    break;
                case 'reject-alliance':
                    if (confirm('Allianz ablehnen?')) {
                        await rejectAlliance(allianceId);
                    }
                    break;
                case 'set-admin':
                    await setAllianceAdmin(allianceId);
                    break;
                case 'view-details':
                    await viewAllianceDetails(allianceId);
                    break;
                case 'delete-alliance':
                    if (confirm('Allianz wirklich löschen?')) {
                        await deleteAlliance(allianceId);
                    }
                    break;
            }
        });

        // System tests
        document.getElementById('run-system-tests').addEventListener('click', () => {
            loadSystemStatus();
            alert('System Tests ausgeführt!');
        });

        // Analytics actions
        document.getElementById('refresh-analytics-main').addEventListener('click', () => {
            loadAnalytics();
        });

        document.getElementById('export-analytics-main').addEventListener('click', () => {
            if (window.AnalyticsDashboardAPI) {
                window.AnalyticsDashboardAPI.exportAnalyticsData();
            } else {
                alert('Analytics-Modul nicht verfügbar');
            }
        });

        // ProximaDB actions
        document.getElementById('force-proxima-update').addEventListener('click', () => {
            loadProximaData();
            alert('ProximaDB Update ausgeführt!');
        });

        document.getElementById('view-proxima-data').addEventListener('click', () => {
            if (state.proximaData) {
                const dataPreview = state.proximaData.slice(0, 10).map(system =>
                    `${system.name} - Score: ${system.score} - ${system.coordinates}`
                ).join('\n');
                
                document.getElementById('proxima-data-content').innerHTML = `
                    <pre style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; overflow: auto; max-height: 400px;">
${dataPreview}
${state.proximaData.length > 10 ? `\n... und ${state.proximaData.length - 10} weitere Systeme` : ''}
                    </pre>
                `;
                openModal('view-proxima-modal');
            } else {
                alert('Keine ProximaDB Daten verfügbar');
            }
        });

        // Approve all alliances
        document.getElementById('approve-all-alliances').addEventListener('click', async () => {
            const pendingAlliances = state.alliances.filter(a => a.status === 'pending');
            if (pendingAlliances.length === 0) {
                alert('Keine ausstehenden Allianzen gefunden');
                return;
            }
            
            if (confirm(`${pendingAlliances.length} Allianzen genehmigen?`)) {
                for (const alliance of pendingAlliances) {
                    await approveAlliance(alliance.id);
                }
                alert('Alle Allianzen genehmigt!');
            }
        });

        // Reject all alliances
        document.getElementById('reject-all-alliances').addEventListener('click', async () => {
            const pendingAlliances = state.alliances.filter(a => a.status === 'pending');
            if (pendingAlliances.length === 0) {
                alert('Keine ausstehenden Allianzen gefunden');
                return;
            }
            
            if (confirm(`${pendingAlliances.length} Allianzen ablehnen?`)) {
                for (const alliance of pendingAlliances) {
                    await rejectAlliance(alliance.id);
                }
                alert('Alle Allianzen abgelehnt!');
            }
        });

        // Modal close on click outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    // Update admin user info with current Super Admin status
    async function updateAdminUserInfo() {
        try {
            const currentUser = window.AuthAPI.getCurrentUser();
            const status = await window.AdminAuth.checkSuperAdminStatus(currentUser.uid);
            
            const username = status.userData?.username || currentUser?.email || 'Admin';
            const superStatus = status.isSuperAdmin ? '<span class="pill super">Super</span>' : '<span class="pill user">User</span>';
            const lastUpdate = status.userData?.updatedAt ? 
                `<div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 4px;">
                    Aktualisiert: ${formatTimestamp(status.userData.updatedAt)}
                </div>` : '';
            
            document.getElementById('admin-user-info').innerHTML = `
                <div>${username} · ${superStatus}</div>
                ${lastUpdate}
            `;
            
            // Update system status mini with Super Admin info
            document.getElementById('system-status-mini').innerHTML = `
                <div style="font-size: 0.8rem;">
                    <div>🟢 System Online</div>
                    <div style="color: var(--text-secondary);">Super-Admin: ${status.isSuperAdmin ? '✅ Ja' : '❌ Nein'}</div>
                    <div style="color: var(--text-secondary);">Letztes Update: ${formatTimestamp(new Date())}</div>
                </div>
            `;
            
        } catch (error) {
            console.error('Fehler beim Aktualisieren der Admin-Info:', error);
        }
    }

    // Initialize dashboard with retry mechanism
    async function gateAndInit(){
        try {
            // Show loading state
            document.getElementById('admin-user-info').innerHTML = '🔄 Firebase wird initialisiert...';
            
            // Wait for Firebase with retry
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    await window.AdminAuth.requireSuperAdmin();
                    break; // Success
                } catch (error) {
                    retryCount++;
                    console.warn(`⚠️ Versuch ${retryCount}/${maxRetries} fehlgeschlagen:`, error);
                    
                    if (retryCount < maxRetries) {
                        document.getElementById('admin-user-info').innerHTML = `🔄 Retry ${retryCount}/${maxRetries}...`;
                        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                    } else {
                        throw error; // Final attempt failed
                    }
                }
            }
            
            document.getElementById('access-ok').style.display = 'block';
            
            // Update admin user info with current status
            await updateAdminUserInfo();

            attachEvents();
            subscribeUsers();
            subscribeAlliances();
            subscribeAllianceMembers();
            loadSystemStatus();
            loadProximaData();
            
            // Set up periodic status updates
            setInterval(updateAdminUserInfo, 30000); // Update every 30 seconds
            
        } catch (e){
            console.warn('Access denied', e);
            document.getElementById('access-denied').style.display = 'block';
            
            // Show detailed error message
            const errorDiv = document.getElementById('access-denied');
            errorDiv.innerHTML = `
                <strong>Zugriff verweigert: Nur Super-Admins</strong><br><br>
                <strong>Fehler:</strong> ${e.message}<br><br>
                <strong>Lösungen:</strong><br>
                1. Bei einem bestehenden Super-Admin-Konto anmelden, oder einen bestehenden Super-Admin bitten, Ihr Konto freizuschalten<br>
                2. Seite neu laden (F5)<br>
                3. Browser-Extensions temporär deaktivieren<br><br>
                <strong>Debugging:</strong> Öffnen Sie die Browser-Konsole (F12) für weitere Details.
            `;
            
            setTimeout(() => { window.location.href = 'index.html'; }, 5000);
        }
    }

    // Global functions for modals
    window.closeModal = closeModal;

    document.addEventListener('DOMContentLoaded', gateAndInit);
})();