// Runs against the Auth + Firestore emulators: `npm test` in firebase/.
// Part 1: pure logic. Part 2: the security rules. Part 3: the real data layer
// (site/app/core.js) signed in as coach and as students, under those rules.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import * as fbStore from 'firebase/firestore';
import * as core from '../../site/app/core.js';

const PROJECT = 'demo-shubhamchess';
const HOUR = 3600000;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
});
after(async () => { await env.cleanup(); });

// ---------- 1. logic ----------

test('access codes: shape, parsing, sign-in name stays the same', () => {
  const id = core.makeLoginId('Aarav K.');
  assert.equal(id, 'aaravk');
  const code = core.makeCode(id);
  assert.match(code, /^AARAVK-[A-HJKMNP-Z2-9]{4}$/);
  assert.deepEqual(core.parseCode('  aaravk-7k3q '), { loginId: 'aaravk', email: 'aaravk@students.local', password: 'AARAVK-7K3Q' });
  assert.equal(core.parseCode('AARAV'), null);
  assert.equal(core.parseCode('a-b'), null);
  assert.equal(core.makeLoginId('Aarav', new Set(['aarav', 'aarav2'])), 'aarav3');
  assert.equal(core.makeLoginId('आरव'), 'student');
  assert.ok(core.makeCode('a').length >= 6, 'Firebase needs 6+ characters');
});

test('coach id maps to an email; junk is refused', () => {
  assert.equal(core.coachEmail(' Coach.One '), 'coach.one@coach.local');
  assert.equal(core.coachEmail(' Coach@Example.com '), 'coach@example.com', 'a full email is used as typed');
  assert.equal(core.coachEmail('coach@nodot'), null);
  assert.equal(core.coachEmail('a b'), null);
  assert.equal(core.coachEmail(''), null);
});

test('IST conversion and batch expansion', () => {
  // 17:00 IST = 11:30 UTC
  assert.equal(new Date(core.istToUtcMs('2026-11-16', '17:00')).toISOString(), '2026-11-16T11:30:00.000Z');
  // 02:00 IST is the previous day in UTC but still Monday in India
  assert.equal(new Date(core.istToUtcMs('2026-11-16', '02:00')).toISOString(), '2026-11-15T20:30:00.000Z');
  assert.deepEqual(core.istParts(core.istToUtcMs('2026-11-16', '02:00')), { date: '2026-11-16', time: '02:00', weekday: 1 });
  // 16 Nov 2026 is a Monday. Mon + Thu for 12 weeks = 24 classes of 50 minutes.
  const slots = core.expandSeries({ startDate: '2026-11-16', weekdays: [1, 4], startTime: '17:00', durationMin: 50, weeks: 12 });
  assert.equal(slots.length, 24);
  assert.equal(core.istParts(slots[0].startsAtMs).date, '2026-11-16');
  assert.equal(core.istParts(slots[1].startsAtMs).date, '2026-11-19');
  assert.equal(core.istParts(slots[23].startsAtMs).date, '2027-02-04');
  assert.ok(slots.every((s) => s.endsAtMs - s.startsAtMs === 50 * 60000));
  assert.ok(slots.every((s) => [1, 4].includes(core.istParts(s.startsAtMs).weekday)));
  // starting mid-week skips the days already gone
  assert.equal(core.expandSeries({ startDate: '2026-11-18', weekdays: [1, 4], startTime: '17:00', durationMin: 50, weeks: 1 }).length, 2);
});

test('join button opens 10 minutes before and closes at the end', () => {
  const s = { startsAtMs: 10 * HOUR, endsAtMs: 11 * HOUR, status: 'scheduled' };
  assert.equal(core.joinState(s, 10 * HOUR - 11 * 60000), 'upcoming');
  assert.equal(core.joinState(s, 10 * HOUR - 10 * 60000), 'open');
  assert.equal(core.joinState(s, 11 * HOUR - 1), 'open');
  assert.equal(core.joinState(s, 11 * HOUR), 'over');
  assert.equal(core.joinState({ ...s, status: 'cancelled' }, 10 * HOUR), 'cancelled');
});

test('only https meeting links are accepted', () => {
  assert.ok(core.isHttpsUrl('https://meet.google.com/abc-defg-hij'));
  for (const bad of ['javascript:alert(1)', 'http://zoom.us/j/1', 'zoom.us/j/1', '', null]) assert.equal(core.isHttpsUrl(bad), false);
  assert.match(core.validateSeries({ name: 'A', studentIds: ['x'], weekdays: [1], startDate: '2026-11-16', startTime: '17:00', durationMin: 50, weeks: 12, link: 'javascript:1' }), /https/);
});

test("can't attend closes 2 hours before; status and monthly summary", () => {
  const s = { startsAtMs: 17 * HOUR, endsAtMs: 18 * HOUR, status: 'scheduled', studentIds: ['a', 'b', 'c', 'd'], joins: { a: 1 }, absences: { b: { reason: 'trip' }, d: {} }, attendance: { d: 'present' } };
  assert.equal(core.canCancel(s, 15 * HOUR - 1), true, 'class at 5, 2:59 is fine');
  assert.equal(core.canCancel(s, 15 * HOUR), false, 'class at 5, closed from 3');
  assert.equal(core.canCancel({ ...s, status: 'cancelled' }, 0), false);
  const before = 10 * HOUR, after = 19 * HOUR;
  assert.deepEqual(['a', 'b', 'c', 'd'].map((u) => core.studentStatus(s, u, before)), ['present', 'informed', 'upcoming', 'present']);
  assert.deepEqual(['a', 'b', 'c', 'd'].map((u) => core.studentStatus(s, u, after)), ['present', 'informed', 'absent', 'present']);
  assert.equal(core.studentStatus({ ...s, attendance: { a: 'absent' } }, 'a', after), 'absent', 'the coach mark beats a Join press');
  assert.equal(core.studentStatus({ ...s, joins: { b: 1 } }, 'b', after), 'present', 'turned up after saying no');
  assert.equal(core.studentStatus({ ...s, status: 'cancelled' }, 'a', after), 'cancelled');
  const sum = core.attendanceSummary([s, { ...s, joins: {}, absences: {}, attendance: {} }, { ...s, status: 'cancelled' }, { ...s, startsAtMs: 40 * HOUR, endsAtMs: 41 * HOUR }], after);
  assert.deepEqual([sum.a.held, sum.a.present, sum.a.informed, sum.a.absent], [2, 1, 0, 1]);
  assert.deepEqual([sum.b.held, sum.b.present, sum.b.informed, sum.b.absent], [2, 0, 1, 1]);
  assert.equal(core.percent(sum.a), 50);
  assert.equal(core.percent({ held: 0, present: 0 }), 0);
  assert.deepEqual(Object.values(core.monthRangeIST('2026-12')).map((ms) => new Date(ms).toISOString()), ['2026-11-30T18:30:00.000Z', '2026-12-31T18:30:00.000Z']);
});

// ---------- 2. security rules ----------

test('rules: who can read and write what', async () => {
  const { doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField, getDocs, collection, query, where, serverTimestamp, Timestamp } = fbStore;
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'config/coach'), { uid: 'coach1' });
    await setDoc(doc(db, 'students/kidA'), { fullName: 'Kid A', nickname: 'A', active: true, accessCode: 'A-AAAA', mobile: '900' });
    await setDoc(doc(db, 'students/kidB'), { fullName: 'Kid B', nickname: 'B', active: true, accessCode: 'B-BBBB' });
    await setDoc(doc(db, 'students/kidOff'), { fullName: 'Kid Off', nickname: 'Off', active: false, accessCode: 'O-OOOO' });
    await setDoc(doc(db, 'series/s1'), { name: 'Batch 1', link: 'https://meet.example/1' });
    const base = { seriesId: 's1', startsAt: Timestamp.fromMillis(1), endsAt: Timestamp.fromMillis(2), link: 'https://meet.example/1', status: 'scheduled', joins: {} };
    await setDoc(doc(db, 'sessions/forA'), { ...base, studentIds: ['kidA', 'kidOff'] });
    await setDoc(doc(db, 'sessions/forB'), { ...base, studentIds: ['kidB'] });
    const at = (h) => ({ startsAt: Timestamp.fromMillis(Date.now() + h * HOUR), endsAt: Timestamp.fromMillis(Date.now() + (h + 1) * HOUR) });
    await setDoc(doc(db, 'sessions/later'), { ...base, ...at(5), studentIds: ['kidA', 'kidB', 'kidOff'], absences: {}, attendance: {} });
    await setDoc(doc(db, 'sessions/laterOld'), { ...base, ...at(5), studentIds: ['kidA'] });            // made before this feature: no absences field
    await setDoc(doc(db, 'sessions/soon'), { ...base, ...at(1.9), studentIds: ['kidA'], absences: {} });
    await setDoc(doc(db, 'sessions/laterCancelled'), { ...base, ...at(5), studentIds: ['kidA'], status: 'cancelled', absences: {} });
    await setDoc(doc(db, 'sessions/soonNoted'), { ...base, ...at(1), studentIds: ['kidA'], absences: { kidA: { reason: 'x' } } });
  });
  const as = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
  const anon = as(null), coach = as('coach1'), a = as('kidA'), off = as('kidOff'), stranger = as('nobody');

  // signed out: nothing
  for (const path of ['config/coach', 'students/kidA', 'series/s1', 'sessions/forA']) await assertFails(getDoc(doc(anon, path)));
  await assertFails(getDocs(collection(anon, 'students')));

  // a signed-in account with no student record (anyone can create one): nothing
  for (const path of ['config/coach', 'students/kidA', 'series/s1', 'sessions/forA']) await assertFails(getDoc(doc(stranger, path)));
  await assertFails(setDoc(doc(stranger, 'students/nobody'), { active: true, fullName: 'x' }));
  await assertFails(setDoc(doc(stranger, 'config/coach'), { uid: 'nobody' }));

  // student A: own record and own classes only
  await assertSucceeds(getDoc(doc(a, 'students/kidA')));
  await assertFails(getDoc(doc(a, 'students/kidB')));
  await assertFails(getDocs(collection(a, 'students')));
  await assertFails(getDoc(doc(a, 'config/coach')));
  await assertFails(getDoc(doc(a, 'series/s1')));
  await assertSucceeds(getDoc(doc(a, 'sessions/forA')));
  await assertFails(getDoc(doc(a, 'sessions/forB')));
  await assertSucceeds(getDocs(query(collection(a, 'sessions'), where('studentIds', 'array-contains', 'kidA'))));
  await assertFails(getDocs(query(collection(a, 'sessions'), where('studentIds', 'array-contains', 'kidB'))));
  await assertFails(getDocs(collection(a, 'sessions')));

  // student A may write only their own join stamp
  await assertSucceeds(updateDoc(doc(a, 'sessions/forA'), { 'joins.kidA': serverTimestamp() }));
  await assertFails(updateDoc(doc(a, 'sessions/forA'), { 'joins.kidOff': serverTimestamp() }));
  await assertFails(updateDoc(doc(a, 'sessions/forA'), { 'joins.kidA': Timestamp.fromMillis(5) }));
  await assertFails(updateDoc(doc(a, 'sessions/forA'), { link: 'https://evil.example' }));
  await assertFails(updateDoc(doc(a, 'sessions/forA'), { studentIds: ['kidA'] }));
  await assertFails(updateDoc(doc(a, 'sessions/forB'), { 'joins.kidA': serverTimestamp() }));
  await assertFails(deleteDoc(doc(a, 'sessions/forA')));
  await assertFails(updateDoc(doc(a, 'students/kidA'), { active: true }));
  await assertFails(setDoc(doc(a, 'sessions/new'), { studentIds: ['kidA'] }));

  // "can't attend": own note only, well-formed, and only until 2 hours before the start
  const note = (reason = 'Family trip') => ({ at: serverTimestamp(), reason });
  await assertSucceeds(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': note() }));
  await assertSucceeds(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': note('') }));
  await assertSucceeds(updateDoc(doc(a, 'sessions/laterOld'), { 'absences.kidA': note() }));
  await assertSucceeds(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': deleteField() }));
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'absences.kidB': note() }));
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': { at: Timestamp.fromMillis(5), reason: 'x' } }));
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': note('x'.repeat(201)) }));
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': { ...note(), extra: 1 } }));
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': 'yes' }));
  await assertFails(updateDoc(doc(a, 'sessions/soon'), { 'absences.kidA': note() }));
  await assertFails(updateDoc(doc(a, 'sessions/soonNoted'), { 'absences.kidA': deleteField() }));
  await assertFails(updateDoc(doc(a, 'sessions/laterCancelled'), { 'absences.kidA': note() }));
  await assertFails(updateDoc(doc(a, 'sessions/forA'), { 'absences.kidA': note() }));          // already over
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'attendance.kidA': 'present' }));    // the coach's mark is not theirs
  await assertFails(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': note(), status: 'cancelled' }));
  await assertSucceeds(updateDoc(doc(a, 'sessions/later'), { 'absences.kidA': note(), 'joins.kidA': serverTimestamp() }));
  await assertFails(updateDoc(doc(off, 'sessions/later'), { 'absences.kidOff': note() }));
  await assertSucceeds(updateDoc(doc(coach, 'sessions/later'), { 'attendance.kidB': 'absent' }));

  // a deactivated student keeps their own record but loses the classes
  await assertSucceeds(getDoc(doc(off, 'students/kidOff')));
  await assertFails(getDoc(doc(off, 'sessions/forA')));
  await assertFails(getDocs(query(collection(off, 'sessions'), where('studentIds', 'array-contains', 'kidOff'))));
  await assertFails(updateDoc(doc(off, 'sessions/forA'), { 'joins.kidOff': serverTimestamp() }));
  await assertFails(updateDoc(doc(off, 'students/kidOff'), { active: true }));

  // coach: everything except config
  await assertSucceeds(getDoc(doc(coach, 'config/coach')));
  await assertFails(setDoc(doc(coach, 'config/coach'), { uid: 'someone-else' }));
  await assertSucceeds(getDocs(collection(coach, 'students')));
  await assertSucceeds(getDocs(collection(coach, 'sessions')));
  await assertSucceeds(setDoc(doc(coach, 'students/kidC'), { fullName: 'Kid C', active: true }));
  await assertSucceeds(updateDoc(doc(coach, 'sessions/forB'), { status: 'cancelled' }));
  await assertSucceeds(setDoc(doc(coach, 'series/s2'), { name: 'Batch 2' }));
  await assertSucceeds(deleteDoc(doc(coach, 'sessions/forB')));
});

// ---------- 3. the data layer, end to end ----------

function client(name) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'demo-key' }, name);
  const auth = fbAuth.getAuth(app);
  fbAuth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = fbStore.getFirestore(app);
  fbStore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const second = initializeApp({ projectId: PROJECT, apiKey: 'demo-key' }, name + '-second');
  const sAuth = fbAuth.getAuth(second);
  fbAuth.connectAuthEmulator(sAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const api = core.makeApi({ fb: { ...fbAuth, ...fbStore }, auth, db, secondaryAuth: async () => sAuth });
  return { api, auth, close: () => Promise.all([deleteApp(app), deleteApp(second)]) };
}

test('flow: coach adds students and a batch; students see and join only their own classes', async () => {
  await env.clearFirestore();
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const coachId = 'testcoach', coachPw = 'test-only-pw';     // emulator only, not the real login
  const C = client('coach'), S = client('student'), T = client('other');
  try {
    // console step, simulated: create the coach account and point config/coach at it
    const made = await fbAuth.createUserWithEmailAndPassword(C.auth, core.coachEmail(coachId), coachPw);
    await env.withSecurityRulesDisabled((ctx) => fbStore.setDoc(fbStore.doc(ctx.firestore(), 'config/coach'), { uid: made.user.uid }));
    await C.api.signOut();

    await assert.rejects(C.api.signInCoach(coachId, 'wrong-password'));
    const coachUser = await C.api.signInCoach(coachId, coachPw);
    assert.deepEqual(await C.api.whoAmI(coachUser), { role: 'coach' });

    const aarav = await C.api.addStudent({ fullName: 'Aarav Kumar', nickname: 'Aarav', mobile: '', email: '' });
    const aarav2 = await C.api.addStudent({ fullName: 'Aarav Mehta', nickname: 'Aarav' });
    const diya = await C.api.addStudent({ fullName: 'Diya Rao', nickname: 'Diya' });
    assert.equal(aarav.loginId, 'aarav');
    assert.equal(aarav2.loginId, 'aarav2');
    assert.equal(C.auth.currentUser.uid, coachUser.uid, 'adding a student must not sign the coach out');
    assert.equal((await C.api.listStudents()).length, 3);

    // a batch for Aarav + Diya starting an hour from now, daily for 1 week
    const start = core.istParts(Date.now() + HOUR);
    const made1 = await C.api.addSeries({ name: 'Beginners A', studentIds: [aarav.id, diya.id], weekdays: [0, 1, 2, 3, 4, 5, 6],
      startTime: start.time, durationMin: 50, startDate: start.date, weeks: 1, link: 'https://meet.example/batch-a' });
    assert.equal(made1.sessions, 7);
    await C.api.addSeries({ name: 'One-to-one', studentIds: [aarav2.id], weekdays: [start.weekday],
      startTime: start.time, durationMin: 50, startDate: start.date, weeks: 2, link: 'https://meet.example/solo' });
    await assert.rejects(C.api.addSeries({ name: 'Bad', studentIds: [diya.id], weekdays: [1], startTime: '17:00', durationMin: 50,
      startDate: start.date, weeks: 1, link: 'javascript:alert(1)' }), /https/);

    // student signs in with the code alone
    await assert.rejects(S.api.signInStudent('AARAV-ZZZZ'));
    await assert.rejects(S.api.signInStudent('nonsense'));
    const sUser = await S.api.signInStudent(aarav.accessCode.toLowerCase());
    assert.equal(sUser.uid, aarav.id);
    const me = await S.api.whoAmI(sUser);
    assert.equal(me.role, 'student');
    assert.equal(me.student.nickname, 'Aarav');
    const mine = await S.api.listMySessions(sUser.uid);
    assert.equal(mine.length, 7);
    assert.ok(mine.every((s) => s.seriesName === 'Beginners A' && s.link === 'https://meet.example/batch-a'));
    await assert.rejects(S.api.listStudents(), /permission/i);
    await assert.rejects(S.api.listSeries(), /permission/i);
    await assert.rejects(S.api.listMySessions(aarav2.id), /permission/i);
    await assert.rejects(S.api.listSessionsBetween(0, Date.now() + 30 * 24 * HOUR), /permission/i);

    // join is recorded and shows up for the coach as attendance
    await S.api.recordJoin(mine[0], sUser.uid);
    const today = await C.api.listSessionsBetween(Date.now() - HOUR, Date.now() + 2 * HOUR);
    const first = today.find((s) => s.seriesName === 'Beginners A');
    assert.ok(first.joins[aarav.id], 'join stamp visible to the coach');
    assert.equal(first.joins[diya.id], undefined);

    // can't attend: refused for the class an hour away, accepted for tomorrow's, and can be taken back
    await assert.rejects(S.api.setAbsence(mine[0], sUser.uid, 'late'), /permission/i);
    await S.api.setAbsence(mine[1], sUser.uid, '  Family trip  ');
    let seen = (await C.api.listSessionsBetween(mine[1].startsAtMs - 1, mine[1].startsAtMs + 1))[0];
    assert.equal(seen.absences[aarav.id].reason, 'Family trip');
    assert.equal(core.studentStatus(seen, aarav.id, Date.now()), 'informed');
    await S.api.clearAbsence(mine[1], sUser.uid);
    seen = (await C.api.listSessionsBetween(mine[1].startsAtMs - 1, mine[1].startsAtMs + 1))[0];
    assert.equal(core.studentStatus(seen, aarav.id, Date.now()), 'upcoming');
    // coach mark overrides, and null puts it back to automatic
    await C.api.markAttendance(first, aarav.id, 'absent');
    seen = (await S.api.listMySessions(sUser.uid))[0];
    assert.equal(core.studentStatus(seen, aarav.id, Date.now()), 'absent');
    await C.api.markAttendance(first, aarav.id, null);
    seen = (await S.api.listMySessions(sUser.uid))[0];
    assert.equal(core.studentStatus(seen, aarav.id, Date.now()), 'present');
    await assert.rejects(S.api.markAttendance(mine[1], sUser.uid, 'present'), /permission/i);

    // coach edits: batch link changes every class that has not started; one class cancelled; one moved
    const batch = (await C.api.listSeries()).find((s) => s.name === 'Beginners A');
    assert.equal(await C.api.updateSeries(batch, { link: 'https://meet.example/new', studentIds: [aarav.id] }), 7);
    await C.api.updateSession(first, { status: 'cancelled' });
    const moved = (await S.api.listMySessions(sUser.uid))[1];
    await C.api.updateSession(moved, { date: '2030-01-05', time: '09:15' });
    const after = await S.api.listMySessions(sUser.uid);
    assert.ok(after.every((s) => s.link === 'https://meet.example/new'));
    assert.equal(after.find((s) => s.id === first.id).status, 'cancelled');
    const m = after.find((s) => s.id === moved.id);
    assert.deepEqual([core.istParts(m.startsAtMs).date, core.istParts(m.startsAtMs).time, m.endsAtMs - m.startsAtMs], ['2030-01-05', '09:15', 50 * 60000]);

    // Diya was taken out of the batch: her classes are gone
    const dUser = await T.api.signInStudent(diya.accessCode);
    assert.equal((await T.api.listMySessions(dUser.uid)).length, 0);

    // extend, then delete
    assert.equal(await C.api.extendSeries({ ...batch, studentIds: [aarav.id], link: 'https://meet.example/new' }, 1), 7);
    assert.equal((await S.api.listMySessions(sUser.uid)).length, 14);
    await C.api.deleteSeries(batch);
    assert.equal((await S.api.listMySessions(sUser.uid)).length, 0);
    assert.equal((await C.api.listSeries()).length, 1);

    // new code: the old one stops working, the new one opens the same account
    const newCode = await C.api.regenerateCode(aarav);
    assert.notEqual(newCode, aarav.accessCode);
    assert.equal(C.auth.currentUser.uid, coachUser.uid);
    await S.api.signOut();
    await assert.rejects(S.api.signInStudent(aarav.accessCode));
    assert.equal((await S.api.signInStudent(newCode)).uid, aarav.id);

    // deactivated: can still sign in, sees no classes
    const a2 = await T.api.signInStudent(aarav2.accessCode);
    assert.equal((await T.api.listMySessions(a2.uid)).length, 2);
    await C.api.setStudentActive(aarav2.id, false);
    await assert.rejects(T.api.listMySessions(a2.uid), /permission/i);
    assert.equal((await T.api.whoAmI(a2)).student.active, false);

    // an account that is neither coach nor student
    await T.api.signOut();
    const stray = await fbAuth.createUserWithEmailAndPassword(T.auth, 'stray@students.local', 'STRAY-AAAA');
    assert.deepEqual(await T.api.whoAmI(stray.user), { role: 'none' });
  } finally {
    await Promise.all([C.close(), S.close(), T.close()]);
  }
});
