// The data layer (site/app/core.js makeApi) against the Auth + Firestore emulators, for the
// paths portal.test.mjs's end-to-end flow does not reach.
//   cd firebase && node --test tests/api.edge.test.mjs
// All logins and passwords here are throwaway emulator values.
import test, { before, after, beforeEach, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { initializeApp, deleteApp } from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import * as fbStore from 'firebase/firestore';
import * as core from '../../site/app/core.js';

const PROJECT = 'demo-shubhamchess';
const MIN = 60000;
const HOUR = 60 * MIN;
const ACCOUNTS = `http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`;
const COACH_ID = 'edgecoach', COACH_PW = 'emulator-only-pw';

let env, C, coachUid;
const clients = [];
let tagCount = 0;
// Unique, readable nickname suffix per test, so sign-in names never collide across tests.
const nextTag = () => 'T' + (++tagCount);

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
  const c = { api, auth, db, close: () => Promise.all([deleteApp(app), deleteApp(second)]) };
  clients.push(c);
  return c;
}

// Read or write as the emulator admin (rules off): for seeding and for checking the truth.
// (withSecurityRulesDisabled resolves to undefined, so the callback's result is passed out by hand.)
async function admin(fn) {
  let out;
  await env.withSecurityRulesDisabled(async (ctx) => { out = await fn(ctx.firestore()); });
  return out;
}
const readDoc = (path) => admin(async (db) => (await fbStore.getDoc(fbStore.doc(db, path))).data());
const sessionsOf = (seriesId) => admin(async (db) => {
  const snap = await fbStore.getDocs(fbStore.query(fbStore.collection(db, 'sessions'), fbStore.where('seriesId', '==', seriesId)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), startsAtMs: d.data().startsAt.toMillis(), endsAtMs: d.data().endsAt.toMillis() }))
    .sort((a, b) => a.startsAtMs - b.startsAtMs);
});

// Fresh Firestore with only config/coach. Auth accounts are left alone, so each test uses
// its own nicknames to stay independent of the others.
async function resetData() {
  await env.clearFirestore();
  await admin((db) => fbStore.setDoc(fbStore.doc(db, 'config/coach'), { uid: coachUid }));
}

// A batch and its classes written straight to the database, like the coach's earlier work.
async function seedSeries(id, classStartsMs, { durationMin = 60, extra = {} } = {}) {
  const series = { name: 'Seeded ' + id, studentIds: ['kidX'], weekdays: [1], startTime: '17:00', durationMin,
    startDate: '2026-01-05', weeks: 4, link: 'https://meet.example/old', ...extra };
  await admin(async (db) => {
    await fbStore.setDoc(fbStore.doc(db, 'series', id), series);
    for (const [i, ms] of classStartsMs.entries()) {
      await fbStore.setDoc(fbStore.doc(db, 'sessions', `${id}-${i}`), {
        seriesId: id, seriesName: series.name, startsAt: fbStore.Timestamp.fromMillis(ms),
        endsAt: fbStore.Timestamp.fromMillis(ms + durationMin * MIN), link: series.link, studentIds: series.studentIds,
        status: 'scheduled', note: '', joins: {}, absences: {}, attendance: {},
      });
    }
  });
  return { id, ...series };
}

async function makeLeftoverAccount(loginId) {
  const x = client('leftover-' + loginId);
  await fbAuth.createUserWithEmailAndPassword(x.auth, core.studentEmail(loginId), 'LEFTOVER-AAAA');
  await x.close();
  clients.splice(clients.indexOf(x), 1);
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
  await fetch(ACCOUNTS, { method: 'DELETE' });
  C = client('edge-coach');
  coachUid = (await fbAuth.createUserWithEmailAndPassword(C.auth, core.coachEmail(COACH_ID), COACH_PW)).user.uid;
  await resetData();
});

after(async () => {
  await Promise.all(clients.map((c) => c.close()));
  await env.clearFirestore();
  await fetch(ACCOUNTS, { method: 'DELETE' });
  await env.cleanup();
});

// ---------- students ----------

describe('addStudent', () => {
  beforeEach(resetData);

  test('skips a sign-in name still held by a removed student and uses the next one', async () => {
    await makeLeftoverAccount('zara');
    const zara = await C.api.addStudent({ fullName: 'Zara Khan', nickname: 'Zara' });
    assert.equal(zara.loginId, 'zara2');
    assert.match(zara.accessCode, /^ZARA2-/);
    assert.equal(C.auth.currentUser.uid, coachUid, 'the coach stays signed in');
    const S = client('zara-device');
    assert.equal((await S.api.signInStudent(zara.accessCode)).uid, zara.id);
  });

  test('skips up to five leftover names in a row', async () => {
    for (const id of ['yuvi', 'yuvi2', 'yuvi3', 'yuvi4', 'yuvi5']) await makeLeftoverAccount(id);
    assert.equal((await C.api.addStudent({ fullName: 'Yuvi', nickname: 'Yuvi' })).loginId, 'yuvi6');
  });

  test('gives up after six leftover names, adds no record, and keeps the coach signed in', async () => {
    for (const id of ['omar', 'omar2', 'omar3', 'omar4', 'omar5', 'omar6']) await makeLeftoverAccount(id);
    await assert.rejects(C.api.addStudent({ fullName: 'Omar', nickname: 'Omar' }), (e) => e.code === 'auth/email-already-in-use');
    assert.equal((await C.api.listStudents()).length, 0);
    assert.equal(C.auth.currentUser.uid, coachUid);
  });

  test('nicknames that differ only in punctuation or case get numbered sign-in names', async () => {
    const one = await C.api.addStudent({ fullName: 'Ria Sen', nickname: 'Ria!' });
    const two = await C.api.addStudent({ fullName: 'Ria Das', nickname: 'ria' });
    assert.deepEqual([one.loginId, two.loginId], ['ria', 'ria2']);
    assert.deepEqual([one.nickname, two.nickname], ['Ria!', 'ria'], 'the nickname is kept as typed');
    assert.notEqual(one.id, two.id);
  });

  test('two Hindi-script nicknames both get working codes', async () => {
    const a = await C.api.addStudent({ fullName: 'आरव शर्मा', nickname: 'आरव' });
    const b = await C.api.addStudent({ fullName: 'दिया राव', nickname: 'दिया' });
    assert.deepEqual([a.loginId, b.loginId], ['student', 'student2']);
    const S = client('hindi-device');
    assert.equal((await S.api.signInStudent(b.accessCode)).uid, b.id);
  });

  test('trims what the coach typed and stores blanks for missing contact details', async () => {
    const s = await C.api.addStudent({ fullName: '  Neel Roy ', nickname: ' Neel  ', mobile: ' 90000 00000 ' });
    const stored = await readDoc('students/' + s.id);
    assert.equal(stored.fullName, 'Neel Roy');
    assert.equal(stored.nickname, 'Neel');
    assert.equal(stored.mobile, '90000 00000');
    assert.equal(stored.email, '');
    assert.equal(stored.active, true);
    assert.equal(stored.loginId, 'neel');
    assert.ok(stored.createdAt, 'creation time is stamped');
  });
});

describe('regenerateCode', () => {
  beforeEach(resetData);

  test('twice in a row: each new code works and every earlier one stops', async () => {
    const kiaan = await C.api.addStudent({ fullName: 'Kiaan', nickname: 'Kiaan' });
    const first = await C.api.regenerateCode(kiaan);
    const current = (await C.api.listStudents()).find((s) => s.id === kiaan.id);
    assert.equal(current.accessCode, first);
    const second = await C.api.regenerateCode(current);
    assert.equal(new Set([kiaan.accessCode, first, second]).size, 3);
    assert.match(second, /^KIAAN-/, 'the sign-in name never changes');
    assert.equal(C.auth.currentUser.uid, coachUid);

    const S = client('kiaan-device');
    await assert.rejects(S.api.signInStudent(kiaan.accessCode));
    await assert.rejects(S.api.signInStudent(first));
    assert.equal((await S.api.signInStudent(second)).uid, kiaan.id);
    assert.equal((await readDoc('students/' + kiaan.id)).accessCode, second);
  });

  test('with an out-of-date record (old code) it fails and the current code keeps working', async () => {
    const mira = await C.api.addStudent({ fullName: 'Mira', nickname: 'Mira' });
    const fresh = await C.api.regenerateCode(mira);
    await assert.rejects(C.api.regenerateCode(mira));
    assert.equal((await readDoc('students/' + mira.id)).accessCode, fresh);
    const S = client('mira-device');
    assert.equal((await S.api.signInStudent(fresh)).uid, mira.id);
  });
});

// ---------- batches ----------

describe('updateSeries', () => {
  beforeEach(resetData);

  test('changes the batch and only the classes that have not started', async () => {
    const now = Date.now();
    const series = await seedSeries('u1', [now - 3 * 24 * HOUR, now - 10 * MIN, now + 2 * HOUR, now + 7 * 24 * HOUR]);
    const changed = await C.api.updateSeries(series, { name: '  Renamed  ', link: ' https://meet.example/new ', studentIds: ['kidX', 'kidY'] });
    assert.equal(changed, 2);

    const [past, running, soon, later] = await sessionsOf('u1');
    for (const s of [past, running]) {
      assert.deepEqual([s.seriesName, s.link, s.studentIds], ['Seeded u1', 'https://meet.example/old', ['kidX']]);
    }
    for (const s of [soon, later]) {
      assert.deepEqual([s.seriesName, s.link, s.studentIds], ['Renamed', 'https://meet.example/new', ['kidX', 'kidY']]);
    }
    const stored = await readDoc('series/u1');
    assert.deepEqual([stored.name, stored.link, stored.studentIds], ['Renamed', 'https://meet.example/new', ['kidX', 'kidY']]);
  });

  test('a patch with only the link leaves the name and students alone', async () => {
    const series = await seedSeries('u2', [Date.now() + 24 * HOUR]);
    await C.api.updateSeries(series, { link: 'https://meet.example/only-link' });
    const [s] = await sessionsOf('u2');
    assert.deepEqual([s.seriesName, s.link, s.studentIds], ['Seeded u2', 'https://meet.example/only-link', ['kidX']]);
  });

  test('a non-https link is refused and nothing is changed', async () => {
    const series = await seedSeries('u3', [Date.now() + 24 * HOUR]);
    await assert.rejects(C.api.updateSeries(series, { name: 'New', link: 'http://meet.example/x' }), (e) => e.code === 'portal/invalid');
    assert.equal((await readDoc('series/u3')).name, 'Seeded u3');
    assert.equal((await sessionsOf('u3'))[0].link, 'https://meet.example/old');
  });

  test('a batch whose classes are all over changes only the batch itself', async () => {
    const series = await seedSeries('u4', [Date.now() - 48 * HOUR, Date.now() - 24 * HOUR]);
    assert.equal(await C.api.updateSeries(series, { name: 'Archive' }), 0);
    assert.equal((await readDoc('series/u4')).name, 'Archive');
    assert.ok((await sessionsOf('u4')).every((s) => s.seriesName === 'Seeded u4'));
  });
});

describe('addSeries', () => {
  beforeEach(resetData);

  test('days that never fall inside the period are refused and nothing is written', async () => {
    await assert.rejects(C.api.addSeries({ name: 'Never', studentIds: ['kidX'], weekdays: [7], startTime: '17:00', durationMin: 50,
      startDate: '2030-01-07', weeks: 2, link: 'https://meet.example/n' }), /No class falls/);
    assert.equal((await C.api.listSeries()).length, 0);
  });

  test('form values given as strings are stored as numbers, and name and link are trimmed', async () => {
    const { id, sessions } = await C.api.addSeries({ name: ' Evening ', studentIds: ['kidX'], weekdays: ['1', '4'], startTime: '17:00',
      durationMin: '45', startDate: '2030-01-07', weeks: '1', link: ' https://meet.example/e ' });
    assert.equal(sessions, 2);
    const stored = await readDoc('series/' + id);
    assert.deepEqual([stored.name, stored.weekdays, stored.durationMin, stored.weeks, stored.link],
      ['Evening', [1, 4], 45, 1, 'https://meet.example/e']);
    assert.ok((await sessionsOf(id)).every((s) => s.endsAtMs - s.startsAtMs === 45 * MIN && s.status === 'scheduled'));
  });
});

describe('extendSeries', () => {
  beforeEach(resetData);
  const ist = (s) => core.istParts(s.startsAtMs);

  test('continues straight after the last class, with no gap and no duplicate, for a class just after India midnight', async () => {
    // Mon 7 Jan 2030; Mon + Thu at 00:30 India time (the UTC date is the day before)
    const { id } = await C.api.addSeries({ name: 'Night owls', studentIds: ['kidX'], weekdays: [1, 4], startTime: '00:30',
      durationMin: 40, startDate: '2030-01-07', weeks: 2, link: 'https://meet.example/owl' });
    const series = (await C.api.listSeries()).find((s) => s.id === id);
    assert.equal(await C.api.extendSeries(series, 2), 4);

    const all = await sessionsOf(id);
    assert.deepEqual(all.map((s) => ist(s).date),
      ['2030-01-07', '2030-01-10', '2030-01-14', '2030-01-17', '2030-01-21', '2030-01-24', '2030-01-28', '2030-01-31']);
    assert.ok(all.every((s) => ist(s).time === '00:30' && s.endsAtMs - s.startsAtMs === 40 * MIN));
    assert.ok(all.every((s) => s.link === 'https://meet.example/owl' && s.seriesName === 'Night owls' && s.status === 'scheduled'));
    assert.equal((await readDoc('series/' + id)).weeks, 4);
  });

  test('a batch that started mid-week continues on its own weekdays, not from the start weekday', async () => {
    // Wed 9 Jan 2030 start, Mon + Fri: Fri 11, Mon 14 → next week Fri 18, Mon 21
    const { id } = await C.api.addSeries({ name: 'Midweek', studentIds: ['kidX'], weekdays: [1, 5], startTime: '18:00',
      durationMin: 50, startDate: '2030-01-09', weeks: 1, link: 'https://meet.example/mid' });
    const series = (await C.api.listSeries()).find((s) => s.id === id);
    await C.api.extendSeries(series, 1);
    assert.deepEqual((await sessionsOf(id)).map((s) => ist(s).date), ['2030-01-11', '2030-01-14', '2030-01-18', '2030-01-21']);
  });

  test('uses the batch values it is given, so a changed link carries into the new classes', async () => {
    const { id } = await C.api.addSeries({ name: 'Linky', studentIds: ['kidX'], weekdays: [2], startTime: '17:00',
      durationMin: 50, startDate: '2030-01-07', weeks: 1, link: 'https://meet.example/v1' });
    const series = (await C.api.listSeries()).find((s) => s.id === id);
    await C.api.updateSeries(series, { link: 'https://meet.example/v2' });
    const updated = (await C.api.listSeries()).find((s) => s.id === id);
    await C.api.extendSeries(updated, 1);
    assert.deepEqual((await sessionsOf(id)).map((s) => s.link), ['https://meet.example/v2', 'https://meet.example/v2']);
  });

  test('a very long extension (more than one write batch) writes every class', async () => {
    const { id } = await C.api.addSeries({ name: 'Daily', studentIds: ['kidX'], weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '07:00',
      durationMin: 30, startDate: '2030-01-07', weeks: 1, link: 'https://meet.example/d' });
    const series = (await C.api.listSeries()).find((s) => s.id === id);
    assert.equal(await C.api.extendSeries(series, 60), 420);
    const all = await sessionsOf(id);
    assert.equal(all.length, 427);
    assert.equal(new Set(all.map((s) => ist(s).date)).size, 427, 'one class per day, no duplicates');
  });
});

describe('deleteSeries', () => {
  beforeEach(resetData);

  test('removes the batch and its coming classes but keeps past and running ones as the record', async () => {
    const now = Date.now();
    const series = await seedSeries('d1', [now - 7 * 24 * HOUR, now - 10 * MIN, now + HOUR, now + 7 * 24 * HOUR]);
    assert.equal(await C.api.deleteSeries(series), 2);
    assert.equal(await readDoc('series/d1'), undefined);
    const left = await sessionsOf('d1');
    assert.deepEqual(left.map((s) => s.id), ['d1-0', 'd1-1']);
  });

  test('does not touch classes of other batches', async () => {
    const a = await seedSeries('d2', [Date.now() + HOUR]);
    await seedSeries('d3', [Date.now() + HOUR]);
    await C.api.deleteSeries(a);
    assert.equal((await sessionsOf('d3')).length, 1);
    assert.deepEqual((await C.api.listSeries()).map((s) => s.id), ['d3']);
  });
});

// ---------- one class ----------

describe('updateSession', () => {
  let session;
  beforeEach(async () => {
    await resetData();
    await seedSeries('m1', [core.istToUtcMs('2030-03-04', '17:00')], { durationMin: 90 });
    [session] = await C.api.listSessionsBetween(0, core.istToUtcMs('2031-01-01', '00:00'));
  });

  test('moving a class keeps its length, across a month end', async () => {
    await C.api.updateSession(session, { date: '2030-03-31', time: '23:30' });
    const [moved] = await sessionsOf('m1');
    assert.deepEqual(core.istParts(moved.startsAtMs), { date: '2030-03-31', time: '23:30', weekday: 0 });
    assert.equal(moved.endsAtMs - moved.startsAtMs, 90 * MIN);
    assert.deepEqual(core.istParts(moved.endsAtMs).date, '2030-04-01', 'a late class can end the next day');
  });

  test('a non-https link is refused and the class is unchanged', async () => {
    for (const link of ['http://meet.example/x', 'javascript:alert(1)', '']) {
      await assert.rejects(C.api.updateSession(session, { link }), (e) => e.code === 'portal/invalid', JSON.stringify(link));
    }
    assert.equal((await sessionsOf('m1'))[0].link, 'https://meet.example/old');
  });

  test('a badly shaped date or time is refused', async () => {
    await assert.rejects(C.api.updateSession(session, { date: '04/03/2030', time: '17:00' }), /date and the time/);
    await assert.rejects(C.api.updateSession(session, { date: '2030-03-04', time: '5pm' }), /date and the time/);
    assert.equal((await sessionsOf('m1'))[0].startsAtMs, session.startsAtMs);
  });

  test('a date without a time (or a time without a date) is refused', async () => {
    await assert.rejects(C.api.updateSession(session, { date: '2030-03-10' }), /date and the time/);
    await assert.rejects(C.api.updateSession(session, { time: '09:00' }), /date and the time/);
  });

  test('a half-filled date/time leaves the class where it was', async () => {
    await C.api.updateSession(session, { date: '2030-03-10' }).catch(() => {});
    await C.api.updateSession(session, { time: '09:00' }).catch(() => {});
    assert.equal((await sessionsOf('m1'))[0].startsAtMs, session.startsAtMs);
  });

  test('link is trimmed; note can be cleared to empty; status and note change together', async () => {
    await C.api.updateSession(session, { link: '  https://meet.example/one-off ', note: 'Bring a board' });
    await C.api.updateSession(session, { note: '', status: 'cancelled' });
    const [s] = await sessionsOf('m1');
    assert.deepEqual([s.link, s.note, s.status], ['https://meet.example/one-off', '', 'cancelled']);
  });
});

// ---------- student notes and coach marks ----------

describe("setAbsence, clearAbsence and markAttendance", () => {
  let kid, other, S, mySession;
  beforeEach(async () => {
    await resetData();
    const tag = nextTag();
    kid = await C.api.addStudent({ fullName: 'Absence Kid', nickname: 'Abs' + tag });
    other = await C.api.addStudent({ fullName: 'Other Kid', nickname: 'Oth' + tag });
    await C.api.addSeries({ name: 'Notes batch', studentIds: [kid.id, other.id], weekdays: [3], startTime: '17:00', durationMin: 50,
      startDate: '2030-01-07', weeks: 1, link: 'https://meet.example/notes' });
    S = client('abs-device-' + tag);
    await S.api.signInStudent(kid.accessCode);
    [mySession] = await S.api.listMySessions(kid.id);
  });
  const stored = async () => (await sessionsOf(mySession.seriesId))[0];

  test('the reason is trimmed and cut to 200 characters, and the save goes through', async () => {
    await S.api.setAbsence(mySession, kid.id, '   ' + 'x'.repeat(250) + '   ');
    const note = (await stored()).absences[kid.id];
    assert.equal(note.reason, 'x'.repeat(200));
    assert.ok(note.at, 'the time of the note is stamped by the server');
  });

  test('a long Hindi reason is cut to 200 characters and saved', async () => {
    await S.api.setAbsence(mySession, kid.id, 'क'.repeat(250));
    assert.equal((await stored()).absences[kid.id].reason, 'क'.repeat(200));
  });

  test('a long emoji reason is saved without error', async () => {
    await S.api.setAbsence(mySession, kid.id, 'a' + '😀'.repeat(150));
    const reason = (await stored()).absences[kid.id].reason;
    assert.ok(reason.startsWith('a😀'));
    assert.ok(reason.length <= 200);
  });

  test('no reason is stored as an empty reason', async () => {
    await S.api.setAbsence(mySession, kid.id);
    assert.equal((await stored()).absences[kid.id].reason, '');
  });

  test("clearAbsence takes the note back and leaves other students' notes alone", async () => {
    const O = client('other-device-' + other.loginId);
    await O.api.signInStudent(other.accessCode);
    await O.api.setAbsence(mySession, other.id, 'Away');
    await S.api.setAbsence(mySession, kid.id, 'Ill');
    await S.api.clearAbsence(mySession, kid.id);
    const s = await stored();
    assert.equal(s.absences[kid.id], undefined);
    assert.equal(s.absences[other.id].reason, 'Away');
  });

  test('clearAbsence with no note there is harmless', async () => {
    await S.api.clearAbsence(mySession, kid.id);
    assert.deepEqual((await stored()).absences, {});
  });

  test("a student cannot clear another student's note through the data layer", async () => {
    await admin((db) => fbStore.updateDoc(fbStore.doc(db, 'sessions', mySession.id), { ['absences.' + other.id]: { at: fbStore.Timestamp.now(), reason: 'x' } }));
    await assert.rejects(S.api.clearAbsence(mySession, other.id), /permission/i);
  });

  test('markAttendance sets, flips and resets one student without touching the other', async () => {
    await C.api.markAttendance(mySession, other.id, 'present');
    await C.api.markAttendance(mySession, kid.id, 'present');
    assert.equal((await stored()).attendance[kid.id], 'present');
    await C.api.markAttendance(mySession, kid.id, 'absent');
    assert.equal((await stored()).attendance[kid.id], 'absent');
    await C.api.markAttendance(mySession, kid.id, null);
    assert.deepEqual((await stored()).attendance, { [other.id]: 'present' });
    await C.api.markAttendance(mySession, kid.id, '');
    assert.deepEqual((await stored()).attendance, { [other.id]: 'present' }, 'an empty value also means back to automatic');
  });
});

// ---------- lists and roles ----------

describe('listSessionsBetween', () => {
  const T = core.istToUtcMs('2030-05-01', '00:00');
  beforeEach(async () => {
    await resetData();
    await seedSeries('r1', [T - 1, T, T + HOUR, T + 2 * HOUR]);
  });
  const ids = async (from, to) => (await C.api.listSessionsBetween(from, to)).map((s) => s.id);

  test('the start of the range is included and the end is excluded', async () => {
    assert.deepEqual(await ids(T, T + 2 * HOUR), ['r1-1', 'r1-2']);
  });

  test('one millisecond either side moves a class in or out', async () => {
    assert.deepEqual(await ids(T - 1, T + 2 * HOUR + 1), ['r1-0', 'r1-1', 'r1-2', 'r1-3']);
    assert.deepEqual(await ids(T + 1, T + 2 * HOUR), ['r1-2']);
  });

  test('an empty or reversed range gives nothing', async () => {
    assert.deepEqual(await ids(T, T), []);
    assert.deepEqual(await ids(T + HOUR, T), []);
  });

  test('a class is placed by its start, even if it runs past the end of the range', async () => {
    assert.deepEqual(await ids(T + 2 * HOUR, T + 2 * HOUR + 1), ['r1-3']);
    assert.deepEqual(await ids(T + 2 * HOUR + 1, T + 3 * HOUR), []);
  });

  test('cancelled classes are still listed for the coach, in time order', async () => {
    await admin((db) => fbStore.updateDoc(fbStore.doc(db, 'sessions/r1-2'), { status: 'cancelled' }));
    const got = await C.api.listSessionsBetween(T - HOUR, T + 3 * HOUR);
    assert.deepEqual(got.map((s) => [s.id, s.status]), [['r1-0', 'scheduled'], ['r1-1', 'scheduled'], ['r1-2', 'cancelled'], ['r1-3', 'scheduled']]);
    assert.ok(got.every((s, i) => i === 0 || s.startsAtMs >= got[i - 1].startsAtMs));
  });

  test('sessions saved without the attendance maps come back with empty maps', async () => {
    await admin((db) => fbStore.setDoc(fbStore.doc(db, 'sessions/bare'), { seriesId: 'r1', startsAt: fbStore.Timestamp.fromMillis(T + 30 * MIN),
      endsAt: fbStore.Timestamp.fromMillis(T + 90 * MIN), studentIds: [], status: 'scheduled' }));
    const bare = (await C.api.listSessionsBetween(T, T + HOUR)).find((s) => s.id === 'bare');
    assert.deepEqual([bare.joins, bare.absences, bare.attendance], [{}, {}, {}]);
  });
});

describe('whoAmI', () => {
  beforeEach(resetData);

  test('tells coach, active student, paused student and a stranger apart', async () => {
    assert.deepEqual(await C.api.whoAmI(C.auth.currentUser), { role: 'coach' });

    const tag = nextTag();
    const act = await C.api.addStudent({ fullName: 'Active Kid', nickname: 'Act' + tag });
    const paused = await C.api.addStudent({ fullName: 'Paused Kid', nickname: 'Pau' + tag });
    await C.api.setStudentActive(paused.id, false);

    const A = client('who-active-' + tag);
    const me = await A.api.whoAmI(await A.api.signInStudent(act.accessCode));
    assert.equal(me.role, 'student');
    assert.deepEqual([me.student.id, me.student.fullName, me.student.active], [act.id, 'Active Kid', true]);

    const P = client('who-paused-' + tag);
    const pausedMe = await P.api.whoAmI(await P.api.signInStudent(paused.accessCode));
    assert.deepEqual([pausedMe.role, pausedMe.student.active], ['student', false]);

    const X = client('who-stranger-' + tag);
    const stray = (await fbAuth.createUserWithEmailAndPassword(X.auth, `stray${tag.toLowerCase()}@students.local`, 'STRAY-AAAA')).user;
    assert.deepEqual(await X.api.whoAmI(stray), { role: 'none' });
  });

  test('the coach is the coach even if a student record exists under the same account', async () => {
    await admin((db) => fbStore.setDoc(fbStore.doc(db, 'students', coachUid), { fullName: 'Coach as kid', active: true }));
    assert.deepEqual(await C.api.whoAmI(C.auth.currentUser), { role: 'coach' });
  });

  test('with no config/coach document the coach account has no role', async () => {
    await env.clearFirestore();
    assert.deepEqual(await C.api.whoAmI(C.auth.currentUser), { role: 'none' });
  });

  test('a paused student still sees no classes even when listed on one', async () => {
    const tag = nextTag();
    const p = await C.api.addStudent({ fullName: 'Paused Two', nickname: 'Pt' + tag });
    await C.api.addSeries({ name: 'P batch', studentIds: [p.id], weekdays: [1], startTime: '17:00', durationMin: 50,
      startDate: '2030-01-07', weeks: 1, link: 'https://meet.example/p' });
    await C.api.setStudentActive(p.id, 0);
    assert.equal((await readDoc('students/' + p.id)).active, false, 'any falsy value is stored as false');
    const P = client('paused-two-' + tag);
    await P.api.signInStudent(p.accessCode);
    await assert.rejects(P.api.listMySessions(p.id), /permission/i);
  });
});
