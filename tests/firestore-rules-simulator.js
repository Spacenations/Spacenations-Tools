const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { setDoc, updateDoc, getDoc, doc, collection, getDocs, addDoc, deleteDoc, serverTimestamp, query, where } = require('firebase/firestore');

// Checks laufen bewusst SEQUENZIELL (nicht parallel): mehrere Fälle bauen aufeinander auf
// (z.B. "Allianz erstellen" vor "Allianz-Status ändern"), und parallele, unsequenzierte
// Schreibzugriffe auf dieselben Dokumente führten zu Race-Conditions gegen den Emulator.
(async () => {
  const testEnv = await initializeTestEnvironment({
    projectId: 'spacenations-tools',
    firestore: { rules: require('fs').readFileSync(require('path').join(__dirname, '..', 'firestore.rules'), 'utf8') }
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  const user1 = testEnv.authenticatedContext('user-1').firestore();
  const user2 = testEnv.authenticatedContext('user-2').firestore();
  const outsider = testEnv.authenticatedContext('user-3').firestore();
  const admin = testEnv.authenticatedContext('admin-1').firestore();
  const promotee = testEnv.authenticatedContext('user-4').firestore();

  // Seed: admin-1 ist Global-Admin, user-1 Gründer/Admin von Allianz A1, user-2 einfaches
  // Mitglied, user-3 gehört zu keiner Allianz, user-4 ist ein separates Konto ausschließlich
  // für den Beförderungs-Test (damit es nicht mit den user-2-Tests kollidiert).
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users/admin-1'), { globalRole: 'global_admin' });
    await setDoc(doc(db, 'users/user-1'), { globalRole: 'user', username: 'Founder' });
    await setDoc(doc(db, 'users/user-2'), { globalRole: 'user', username: 'Member' });
    await setDoc(doc(db, 'users/user-3'), { globalRole: 'user', username: 'Outsider' });
    await setDoc(doc(db, 'users/user-4'), { globalRole: 'user', username: 'Promotee' });
    await setDoc(doc(db, 'alliances/A1'), { name: 'Alpha', tag: 'A', founderUid: 'user-1', status: 'approved' });
    await setDoc(doc(db, 'allianceMembers', 'A1_user-1'), { allianceId: 'A1', uid: 'user-1', role: 'founder' });
    await setDoc(doc(db, 'allianceMembers', 'A1_user-2'), { allianceId: 'A1', uid: 'user-2', role: 'member' });
  });

  const results = [];
  async function check(name, promise) {
    try {
      await promise;
      results.push({ name, ok: true });
    } catch (e) {
      results.push({ name, ok: false, error: e.message });
    }
  }

  // --- users ---
  await check('Anon darf users nicht lesen', assertFails(getDocs(collection(anon, 'users'))));
  await check('user1 darf eigenes Profil lesen', assertSucceeds(getDoc(doc(user1, 'users/user-1'))));
  await check('user1 darf fremdes Profil NICHT lesen', assertFails(getDoc(doc(user1, 'users/user-2'))));
  await check(
    'user1 darf sich NICHT selbst zum Global-Admin befördern (Kernfix)',
    assertFails(updateDoc(doc(user1, 'users/user-1'), { globalRole: 'global_admin' }))
  );
  await check(
    'user1 darf andere eigene Felder aktualisieren, ohne globalRole zu berühren',
    assertSucceeds(updateDoc(doc(user1, 'users/user-1'), { username: 'FounderRenamed', globalRole: 'user' }))
  );
  await check(
    'Global-Admin darf globalRole eines anderen Nutzers setzen',
    assertSucceeds(updateDoc(doc(admin, 'users/user-4'), { globalRole: 'global_admin' }))
  );
  await check(
    'Neuanmeldung darf sich nicht direkt als global_admin anlegen',
    assertFails(setDoc(doc(outsider, 'users/user-3-fake'), { globalRole: 'global_admin' }))
  );

  // --- alliances ---
  await check(
    'Beliebiger Nutzer darf eigene Allianz im Status pending erstellen',
    assertSucceeds(setDoc(doc(outsider, 'alliances/A2'), { name: 'Beta', tag: 'B', founderUid: 'user-3', status: 'pending' }))
  );
  await check(
    'Nutzer darf KEINE Allianz mit fremder founderUid erstellen',
    assertFails(setDoc(doc(outsider, 'alliances/A3'), { name: 'Gamma', tag: 'G', founderUid: 'user-1', status: 'pending' }))
  );
  await check(
    'Allianz-Admin darf Beschreibung ändern, aber NICHT den Status selbst freigeben',
    assertFails(updateDoc(doc(user1, 'alliances/A1'), { status: 'rejected' }))
  );
  await check(
    'Allianz-Admin darf andere Felder ändern, solange status gleich bleibt',
    assertSucceeds(updateDoc(doc(user1, 'alliances/A1'), { description: 'Neue Beschreibung', status: 'approved' }))
  );
  await check(
    'Global-Admin darf Allianz-Status ändern (Freigabe)',
    assertSucceeds(updateDoc(doc(admin, 'alliances/A2'), { status: 'approved' }))
  );
  await check('Einfaches Mitglied darf Allianz NICHT löschen', assertFails(deleteDoc(doc(user2, 'alliances/A1'))));

  // --- allianceMembers ---
  await check(
    'Gründer darf direkt nach Alliance-Erstellung die eigene Founder-Mitgliedschaft anlegen',
    assertSucceeds(setDoc(doc(outsider, 'allianceMembers/A2_user-3'), { allianceId: 'A2', uid: 'user-3', role: 'founder' }))
  );
  await check(
    'Einfaches Mitglied darf KEINE fremde Mitgliedschaft anlegen',
    assertFails(setDoc(doc(user2, 'allianceMembers/A1_user-3'), { allianceId: 'A1', uid: 'user-3', role: 'member' }))
  );
  await check(
    'Allianz-Admin darf neue Mitglieder aufnehmen',
    assertSucceeds(setDoc(doc(user1, 'allianceMembers/A1_user-3'), { allianceId: 'A1', uid: 'user-3', role: 'member' }))
  );
  await check(
    'Allianz-Admin darf Mitglied entfernen',
    assertSucceeds(deleteDoc(doc(user1, 'allianceMembers/A1_user-3')))
  );

  // --- allianceChats ---
  await check(
    'Mitglied darf im eigenen Allianz-Chat schreiben',
    assertSucceeds(addDoc(collection(user2, 'allianceChats/A1/messages'), {
      content: 'Hallo Allianz', authorUid: 'user-2', timestamp: serverTimestamp()
    }))
  );
  await check(
    'Nicht-Mitglied darf NICHT im fremden Allianz-Chat schreiben',
    assertFails(addDoc(collection(outsider, 'allianceChats/A1/messages'), {
      content: 'Eindringling', authorUid: 'user-3', timestamp: serverTimestamp()
    }))
  );
  await check(
    'Nicht-Mitglied darf fremden Allianz-Chat NICHT lesen',
    assertFails(getDocs(collection(outsider, 'allianceChats/A1/messages')))
  );

  // --- spyReports ---
  await check(
    'Mitglied darf Spionagebericht für eigene Allianz erstellen',
    assertSucceeds(addDoc(collection(user2, 'spyReports'), {
      allianceId: 'A1', createdByUid: 'user-2', playerName: 'Zeratul', planetCoordinates: '1:2:3', createdAt: new Date()
    }))
  );
  await check(
    'Nicht-Mitglied darf Spionagebericht einer fremden Allianz NICHT lesen',
    assertFails(getDocs(query(collection(outsider, 'spyReports'), where('allianceId', '==', 'A1'))))
  );

  // --- userBattles ---
  await check(
    'Nutzer darf eigenen Kampf-Datensatz anlegen',
    assertSucceeds(addDoc(collection(user1, 'userBattles'), { userId: 'user-1', result: 'win', createdAt: new Date() }))
  );
  await check(
    'Nutzer darf KEINEN Kampf-Datensatz für einen anderen Nutzer anlegen',
    assertFails(addDoc(collection(user1, 'userBattles'), { userId: 'user-2', result: 'win', createdAt: new Date() }))
  );

  // --- userActivities ---
  await check(
    'Nutzer darf eigenen Aktivitäts-Eintrag anlegen',
    assertSucceeds(addDoc(collection(user1, 'userActivities'), { userId: 'user-1', icon: '✅', text: 'Login', timestamp: serverTimestamp() }))
  );
  await check(
    'Nutzer darf KEINEN Aktivitäts-Eintrag für einen anderen Nutzer anlegen',
    assertFails(addDoc(collection(user1, 'userActivities'), { userId: 'user-2', icon: '✅', text: 'Fake', timestamp: serverTimestamp() }))
  );
  await check(
    'Nutzer darf fremden Aktivitäts-Eintrag NICHT lesen',
    assertFails(getDocs(query(collection(user2, 'userActivities'), where('userId', '==', 'user-1'))))
  );
  await check(
    'Global-Admin darf alle Aktivitäts-Einträge lesen (Admin-Dashboard-Feed)',
    assertSucceeds(getDocs(collection(admin, 'userActivities')))
  );

  // --- Analytics ---
  await check(
    'Angemeldeter Nutzer darf Analytics-Seitenaufruf schreiben',
    assertSucceeds(addDoc(collection(user1, 'analytics_pageViews'), { sessionId: 's1', pagePath: '/index.html', timestamp: serverTimestamp() }))
  );
  await check(
    'Anonymer Besucher darf KEINEN Analytics-Seitenaufruf schreiben',
    assertFails(addDoc(collection(anon, 'analytics_pageViews'), { sessionId: 's2', pagePath: '/index.html', timestamp: serverTimestamp() }))
  );
  await check(
    'Normaler Nutzer darf Analytics-Daten NICHT lesen (nur Global-Admin)',
    assertFails(getDocs(collection(user1, 'analytics_pageViews')))
  );
  await check(
    'Global-Admin darf Analytics-Daten lesen',
    assertSucceeds(getDocs(collection(admin, 'analytics_pageViews')))
  );

  await testEnv.cleanup();

  const failed = results.filter(r => !r.ok);
  for (const r of results) {
    console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.ok ? '' : ' — ' + r.error}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} Regel-Checks bestanden.`);

  if (failed.length > 0) {
    console.error(`\n❌ ${failed.length} Regel-Check(s) fehlgeschlagen.`);
    process.exitCode = 1;
    return;
  }
  console.log('\n✅ Alle Firestore-Regel-Checks bestanden.');
  process.exitCode = 0;
})().catch((err) => {
  console.error('❌ Testlauf abgebrochen:', err);
  process.exitCode = 1;
});
