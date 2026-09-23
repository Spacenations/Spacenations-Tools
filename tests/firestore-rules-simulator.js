const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { setDoc, updateDoc, doc, collection, getDoc, getDocs, addDoc } = require('firebase/firestore');

// Firestore-Regeln gegen den lokalen Emulator pruefen:  npm run test:rules
// (startet firebase emulators:exec --only firestore und fuehrt diese Datei aus)

(async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: 'spacenations-tools',
    firestore: {
      rules: require('fs').readFileSync(require('path').join(__dirname, '..', 'firestore.rules'), 'utf8'),
    },
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  const user = testEnv.authenticatedContext('user-1').firestore();
  const admin = testEnv.authenticatedContext('admin-1').firestore();

  // Seed (Regeln umgangen)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin-1'), { globalRole: 'global_admin', username: 'Admin' });
    await setDoc(doc(db, 'users/user-1'), { globalRole: 'user', username: 'User', displayName: 'User' });
    await setDoc(doc(db, 'alliances/A1'), { name: 'Alpha', tag: 'A', members: ['User'] });
  });

  let oks = 0, fails = 0;
  const must = async (label, p, expectOk) => {
    try {
      await (expectOk ? assertSucceeds(p) : assertFails(p));
      oks++;
    } catch (e) {
      fails++;
      console.error(`❌ ${label} — ${e.message}`);
    }
  };

  // --- KRITISCH: keine Selbst-Eskalation der Rollen-/Privileg-Felder ---
  await must('user kann eigenes globalRole NICHT auf global_admin setzen',
    updateDoc(doc(user, 'users/user-1'), { globalRole: 'global_admin' }), false);
  await must('user kann eigenes isSuperAdmin NICHT auf true setzen',
    updateDoc(doc(user, 'users/user-1'), { isSuperAdmin: true }), false);
  await must('user kann eigenes systemRole NICHT auf superadmin setzen',
    updateDoc(doc(user, 'users/user-1'), { systemRole: 'superadmin' }), false);
  await must('user kann sich NICHT selbst permissions geben',
    updateDoc(doc(user, 'users/user-1'), { permissions: { alliance_admin: true } }), false);
  await must('user kann per set() KEIN isSuperAdmin setzen',
    setDoc(doc(user, 'users/user-1'), { isSuperAdmin: true, username: 'User' }), false);

  // --- Erlaubt: eigenes Nicht-Rollen-Feld aendern ---
  await must('user darf eigenes displayName aendern',
    updateDoc(doc(user, 'users/user-1'), { displayName: 'Neuer Name' }), true);

  // --- Registrierung: Default-Dokument (inkl. permissions-Objekt) muss klappen ---
  const reg = testEnv.authenticatedContext('reg-1').firestore();
  await must('Registrierung mit Default-permissions ist erlaubt',
    setDoc(doc(reg, 'users/reg-1'), {
      username: 'Reg', isSuperAdmin: false, systemRole: 'user', role: 'user',
      permissions: { dashboard_access: true, admin_dashboard: false },
    }), true);
  const esc = testEnv.authenticatedContext('esc-1').firestore();
  await must('Anlegen mit isSuperAdmin=true wird abgelehnt',
    setDoc(doc(esc, 'users/esc-1'), { username: 'Esc', isSuperAdmin: true }), false);

  // --- Admin darf Rollen verwalten ---
  await must('admin darf einem Nutzer eine Rolle setzen',
    updateDoc(doc(admin, 'users/user-1'), { globalRole: 'global_admin' }), true);
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'users/user-1'), { globalRole: 'user', username: 'User' });
  });

  // --- Nutzer-Isolation ---
  await must('user kann fremdes User-Dokument NICHT lesen',
    getDoc(doc(user, 'users/admin-1')), false);
  await must('admin darf jedes User-Dokument lesen',
    getDoc(doc(admin, 'users/user-1')), true);
  await must('anon kann users NICHT lesen',
    getDocs(collection(anon, 'users')), false);

  // --- App-Collections: eingeloggt erforderlich (kein if-true mehr) ---
  await must('eingeloggter user darf userRaids schreiben',
    addDoc(collection(user, 'userRaids'), { uid: 'user-1', loot: 5 }), true);
  await must('anon darf userRaids NICHT schreiben',
    addDoc(collection(anon, 'userRaids'), { uid: 'x' }), false);
  await must('eingeloggter user darf Allianz-Chat schreiben',
    addDoc(collection(user, 'allianceChats/A1/messages'), { text: 'hi' }), true);
  await must('anon kann alliances NICHT lesen',
    getDocs(collection(anon, 'alliances')), false);

  // --- Analytics: anonymes create ja, lesen nur Admin ---
  await must('anon darf ein analytics-Event schreiben',
    addDoc(collection(anon, 'analytics_events'), { type: 'pageview' }), true);
  await must('nicht-Admin kann analytics NICHT lesen',
    getDocs(collection(user, 'analytics_events')), false);
  await must('admin darf analytics lesen',
    getDocs(collection(admin, 'analytics_events')), true);

  // --- Unbekannte Collection -> deny ---
  await must('unbekannte Collection ist gesperrt',
    addDoc(collection(user, 'some_random_collection'), { x: 1 }), false);

  console.log(`\n${oks} bestanden, ${fails} fehlgeschlagen`);
  await testEnv.cleanup();
  process.exit(fails ? 1 : 0);
})();
