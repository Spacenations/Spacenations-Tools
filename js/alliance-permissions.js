/**
 * Alliance Permission System
 * Arbeitet auf der vereinheitlichten allianceMembers-Collection (ein Dokument pro
 * Mitglied, Schlüssel `${allianceId}_${uid}`, mit eingebettetem `permissions`-Objekt).
 */

class AlliancePermissionManager {
    constructor() {
        this.currentAlliance = null;
        this.currentUid = null;
        this.isAdmin = false;
        this.members = [];
        this.unsub = null;
        this.permissionDefs = [
            { id: 'chatWrite', description: 'Chat schreiben' },
            { id: 'memberManage', description: 'Mitglieder verwalten' },
            { id: 'spyDatabase', description: 'Spy-Datenbank' }
        ];
    }

    async initialize(allianceId, uid) {
        this.currentAlliance = allianceId;
        this.currentUid = uid;

        if (typeof window.FirebaseConfig === 'undefined') {
            console.log('Firebase nicht verfügbar, verwende lokale Berechtigungen');
            this.isAdmin = true;
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
            console.error('Fehler beim Laden der Allianz-Mitgliedschaften:', error);
        }
    }

    applyOwnStatus() {
        const mine = this.members.find(m => m.uid === this.currentUid);
        this.isAdmin = !!mine && (mine.role === 'admin' || mine.role === 'founder');
    }

    getPermissionList() {
        return this.permissionDefs.map(def => ({ ...def, enabled: true }));
    }

    getMemberPermissionList(uid) {
        const member = this.members.find(m => m.uid === uid);
        const isAdminMember = !!member && (member.role === 'admin' || member.role === 'founder');

        return this.permissionDefs.map(def => ({
            id: def.id,
            description: def.description,
            enabled: isAdminMember ? true : !!(member?.permissions && member.permissions[def.id]),
            isCustom: !isAdminMember && !!(member?.permissions && member.permissions[def.id] !== undefined)
        }));
    }

    hasPermission(permission, uid = null) {
        const targetUid = uid || this.currentUid;
        const member = this.members.find(m => m.uid === targetUid);
        if (!member) return false;
        if (member.role === 'admin' || member.role === 'founder') return true;
        return !!(member.permissions && member.permissions[permission]);
    }

    canAccessSpyDatabase(uid = null) {
        return this.hasPermission('spyDatabase', uid);
    }

    canReadChat() {
        return true; // Jedes Allianz-Mitglied darf den Chat lesen.
    }

    canWriteChat(uid = null) {
        return this.hasPermission('chatWrite', uid);
    }

    canManageMembers(uid = null) {
        const targetUid = uid || this.currentUid;
        const member = this.members.find(m => m.uid === targetUid);
        if (member && (member.role === 'admin' || member.role === 'founder')) return true;
        return this.hasPermission('memberManage', uid);
    }

    async setMemberPermission(uid, permission, enabled) {
        if (!this.isAdmin) {
            throw new Error('Nur Allianz-Admins können Berechtigungen setzen');
        }

        const db = window.FirebaseConfig.getDB();
        await db.collection('allianceMembers').doc(`${this.currentAlliance}_${uid}`).update({
            [`permissions.${permission}`]: enabled,
            updatedAt: window.FirebaseConfig.getServerTimestamp(),
            updatedBy: this.currentUid
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
                    this.onPermissionsUpdated();
                    this.onMemberPermissionsUpdated();
                });
        } catch (error) {
            console.error('Fehler beim Setup der Real-time Updates:', error);
        }
    }

    onPermissionsUpdated() {
        // Wird von der UI überschrieben
    }

    onMemberPermissionsUpdated() {
        // Wird von der UI überschrieben
    }
}

window.AlliancePermissionManager = AlliancePermissionManager;
