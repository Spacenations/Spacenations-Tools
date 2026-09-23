/**
 * Alliance Member Management System
 * Arbeitet auf der vereinheitlichten allianceMembers-Collection statt auf einem
 * members-Array/admin-Feld direkt am alliances-Dokument.
 */

class AllianceMemberManager {
    constructor() {
        this.currentAlliance = null;
        this.currentUid = null;
        this.isAdmin = false;
        this.members = [];
        this.unsub = null;
    }

    async initialize(allianceId, uid) {
        this.currentAlliance = allianceId;
        this.currentUid = uid;

        if (typeof window.FirebaseConfig === 'undefined') {
            console.log('Firebase nicht verfügbar, verwende lokale Mitglieder-Verwaltung');
            this.loadLocalMembers();
            return;
        }

        await this.loadMembers();
        this.setupRealTimeUpdates();
    }

    async loadMembers() {
        try {
            const db = window.FirebaseConfig.getDB();
            const snap = await db.collection('allianceMembers')
                .where('allianceId', '==', this.currentAlliance)
                .get();

            this.members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            this.applyOwnStatus();
        } catch (error) {
            console.error('Fehler beim Laden der Mitglieder:', error);
        }
    }

    applyOwnStatus() {
        const mine = this.members.find(m => m.uid === this.currentUid);
        this.isAdmin = !!mine && (mine.role === 'admin' || mine.role === 'founder');
    }

    loadLocalMembers() {
        this.isAdmin = true;
        this.members = [{ uid: this.currentUid, username: 'Du', role: 'founder', permissions: {} }];
    }

    getMembers() { return this.members; }
    getFounder() { return this.members.find(m => m.role === 'founder') || null; }
    getAdmins() { return this.members.filter(m => m.role === 'admin' || m.role === 'founder'); }
    isMember(uid) { return this.members.some(m => m.uid === uid); }
    findByUid(uid) { return this.members.find(m => m.uid === uid) || null; }
    findByUsername(username) { return this.members.find(m => m.username === username) || null; }

    async addMemberByUsername(username) {
        if (!this.isAdmin) {
            throw new Error('Nur Allianz-Admins können Mitglieder hinzufügen');
        }
        if (this.findByUsername(username)) {
            throw new Error(`"${username}" ist bereits Mitglied der Allianz`);
        }

        if (typeof window.FirebaseConfig === 'undefined') {
            this.members.push({ uid: `local-${username}`, username, role: 'member', permissions: {} });
            this.onMembersUpdated();
            return;
        }

        const db = window.FirebaseConfig.getDB();
        const userQuery = await db.collection('users').where('username', '==', username).limit(1).get();
        if (userQuery.empty) {
            throw new Error(`Benutzer "${username}" existiert nicht`);
        }
        const uid = userQuery.docs[0].id;

        await db.collection('allianceMembers').doc(`${this.currentAlliance}_${uid}`).set({
            allianceId: this.currentAlliance,
            uid,
            username,
            role: 'member',
            permissions: { chatWrite: true, memberManage: false, spyDatabase: true },
            joinedAt: window.FirebaseConfig.getServerTimestamp()
        });

        await db.collection('allianceActivities').add({
            allianceId: this.currentAlliance,
            type: 'member_added',
            member: username,
            addedBy: this.currentUid,
            timestamp: window.FirebaseConfig.getServerTimestamp()
        });
    }

    async addMemberByEmail(email) {
        if (!this.isAdmin) {
            throw new Error('Nur Allianz-Admins können Mitglieder hinzufügen');
        }

        const db = window.FirebaseConfig.getDB();
        const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
        if (userQuery.empty) {
            throw new Error(`Kein Benutzer mit E-Mail "${email}" gefunden`);
        }

        await this.addMemberByUsername(userQuery.docs[0].data().username);
    }

    async removeMember(uid) {
        if (!this.isAdmin) {
            throw new Error('Nur Allianz-Admins können Mitglieder entfernen');
        }

        const target = this.findByUid(uid);
        if (!target) {
            throw new Error('Mitglied nicht gefunden');
        }
        if (target.role === 'founder') {
            throw new Error('Der Gründer kann nicht entfernt werden');
        }

        if (typeof window.FirebaseConfig === 'undefined') {
            this.members = this.members.filter(m => m.uid !== uid);
            this.onMembersUpdated();
            return;
        }

        const db = window.FirebaseConfig.getDB();
        await db.collection('allianceMembers').doc(`${this.currentAlliance}_${uid}`).delete();

        await db.collection('allianceActivities').add({
            allianceId: this.currentAlliance,
            type: 'member_removed',
            member: target.username,
            removedBy: this.currentUid,
            timestamp: window.FirebaseConfig.getServerTimestamp()
        });
    }

    async setAllianceAdmin(uid) {
        if (!this.isAdmin) {
            throw new Error('Nur der aktuelle Allianzadmin kann einen neuen Admin setzen');
        }

        const target = this.findByUid(uid);
        if (!target) {
            throw new Error('Mitglied nicht gefunden');
        }

        const db = window.FirebaseConfig.getDB();
        await db.collection('allianceMembers').doc(`${this.currentAlliance}_${uid}`).update({
            role: 'admin',
            lastUpdated: window.FirebaseConfig.getServerTimestamp()
        });

        // Vorherige (nicht-Gründer) Admins auf einfaches Mitglied zurückstufen.
        const previousAdmins = this.members.filter(m => m.role === 'admin' && m.uid !== uid);
        for (const previous of previousAdmins) {
            await db.collection('allianceMembers').doc(`${this.currentAlliance}_${previous.uid}`).update({
                role: 'member',
                lastUpdated: window.FirebaseConfig.getServerTimestamp()
            });
        }

        await db.collection('allianceActivities').add({
            allianceId: this.currentAlliance,
            type: 'admin_changed',
            newAdmin: target.username,
            changedBy: this.currentUid,
            timestamp: window.FirebaseConfig.getServerTimestamp()
        });
    }

    setupRealTimeUpdates() {
        if (typeof window.FirebaseConfig === 'undefined') return;

        try {
            const db = window.FirebaseConfig.getDB();
            this.unsub = db.collection('allianceMembers')
                .where('allianceId', '==', this.currentAlliance)
                .onSnapshot(snap => {
                    this.members = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    this.applyOwnStatus();
                    this.onMembersUpdated();
                });
        } catch (error) {
            console.error('Fehler beim Setup der Real-time Updates:', error);
        }
    }

    onMembersUpdated() {
        // Wird von der UI überschrieben
    }
}

window.AllianceMemberManager = AllianceMemberManager;
