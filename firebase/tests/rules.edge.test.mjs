// Security-rule edge cases not covered by portal.test.mjs. Needs the Firestore emulator
// on 127.0.0.1:8080:  cd firebase && node --test tests/rules.edge.test.mjs
import test, { before, after, beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, deleteField, collection, query, where, serverTimestamp, Timestamp } from 'firebase/firestore';

const PROJECT = 'demo-shubhamchess';
const MIN = 60000;
const HOUR = 60 * MIN;
let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  await env.clearFirestore();
});
after(async () => {
  await env.clearFirestore();
  await env.cleanup();
});

const as = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

// A class `hoursAhead` from now (negative = in the past), one hour long.
function makeClass(hoursAhead, overrides = {}) {
  const start = Date.now() + hoursAhead * HOUR;
  return {
    seriesId: 's1', seriesName: 'Batch 1', startsAt: Timestamp.fromMillis(start), endsAt: Timestamp.fromMillis(start + HOUR),
    link: 'https://meet.example/1', studentIds: ['kidA', 'kidB'], status: 'scheduled', note: '',
    joins: {}, absences: {}, attendance: {}, ...overrides,
  };
}

const note = (reason = 'Exam') => ({ at: serverTimestamp(), reason });

async function seed(docs) {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, data] of Object.entries(docs)) await setDoc(doc(db, path), data);
  });
}

const standard = () => ({
  'config/coach': { uid: 'coach1' },
  'students/kidA': { fullName: 'Kid A', active: true },
  'students/kidB': { fullName: 'Kid B', active: true },
  'students/kidOff': { fullName: 'Kid Off', active: false },
  'series/s1': { name: 'Batch 1' },
});

describe('no config/coach document', () => {
  beforeEach(() => seed({
    'students/kidA': { fullName: 'Kid A', active: true },
    'series/s1': { name: 'Batch 1' },
    'sessions/c1': makeClass(24, { studentIds: ['kidA'] }),
  }));

  test('nobody is the coach: the would-be coach can read and write nothing', async () => {
    const c = as('coach1');
    await assertFails(getDocs(collection(c, 'students')));
    await assertFails(getDoc(doc(c, 'series/s1')));
    await assertFails(setDoc(doc(c, 'series/s2'), { name: 'x' }));
    await assertFails(getDoc(doc(c, 'sessions/c1')));
    await assertFails(setDoc(doc(c, 'config/coach'), { uid: 'coach1' }));
  });

  test('an active student still reads their own record and classes and can write their own join', async () => {
    const a = as('kidA');
    await assertSucceeds(getDoc(doc(a, 'students/kidA')));
    await assertSucceeds(getDocs(query(collection(a, 'sessions'), where('studentIds', 'array-contains', 'kidA'))));
    await assertSucceeds(updateDoc(doc(a, 'sessions/c1'), { 'joins.kidA': serverTimestamp() }));
    await assertFails(getDocs(collection(a, 'students')));
  });

  test('signed out still gets nothing', async () => {
    await assertFails(getDoc(doc(as(null), 'sessions/c1')));
    await assertFails(getDoc(doc(as(null), 'config/coach')));
  });
});

describe('odd student records', () => {
  beforeEach(() => seed({
    ...standard(),
    'students/kidNoFlag': { fullName: 'No Flag' },
    'students/kidStringFlag': { fullName: 'String Flag', active: 'true' },
    'sessions/c1': makeClass(24, { studentIds: ['kidA', 'kidNoFlag', 'kidStringFlag', 'ghost'] }),
  }));

  test('a student record with no active field is treated as paused', async () => {
    const s = as('kidNoFlag');
    await assertSucceeds(getDoc(doc(s, 'students/kidNoFlag')));
    await assertFails(getDoc(doc(s, 'sessions/c1')));
    await assertFails(updateDoc(doc(s, 'sessions/c1'), { 'joins.kidNoFlag': serverTimestamp() }));
  });

  test('active must be the boolean true, not the string "true"', async () => {
    await assertFails(getDoc(doc(as('kidStringFlag'), 'sessions/c1')));
  });

  test('an account listed on a class but with no student record sees and writes nothing', async () => {
    const g = as('ghost');
    await assertFails(getDoc(doc(g, 'sessions/c1')));
    await assertFails(getDocs(query(collection(g, 'sessions'), where('studentIds', 'array-contains', 'ghost'))));
    await assertFails(updateDoc(doc(g, 'sessions/c1'), { 'joins.ghost': serverTimestamp() }));
    await assertFails(updateDoc(doc(g, 'sessions/c1'), { 'absences.ghost': note() }));
  });

  test('that account may look up its own (missing) record, and cannot create it', async () => {
    const g = as('ghost');
    const snap = await assertSucceeds(getDoc(doc(g, 'students/ghost')));
    if (snap.exists()) throw new Error('expected no record');
    await assertFails(setDoc(doc(g, 'students/ghost'), { fullName: 'Ghost', active: true }));
  });
});

describe('collections the rules do not name', () => {
  beforeEach(() => seed({ ...standard(), 'payments/p1': { amount: 1 } }));

  test('are closed to everyone, the coach included', async () => {
    for (const uid of [null, 'kidA', 'coach1']) {
      const db = as(uid);
      await assertFails(getDoc(doc(db, 'payments/p1')));
      await assertFails(setDoc(doc(db, 'payments/p2'), { amount: 2 }));
      await assertFails(getDocs(collection(db, 'payments')));
    }
  });

  test('sub-collections under a student are closed too', async () => {
    await assertFails(setDoc(doc(as('coach1'), 'students/kidA/notes/n1'), { t: 'x' }));
    await assertFails(setDoc(doc(as('kidA'), 'students/kidA/notes/n1'), { t: 'x' }));
  });
});

describe('student writes to a class: joins', () => {
  const joinedAt = Timestamp.fromMillis(Date.now() - 5 * MIN);
  beforeEach(() => seed({ ...standard(), 'sessions/c1': makeClass(-0.5, { joins: { kidA: joinedAt, kidB: joinedAt } }) }));

  test('pressing Join again re-stamps their own join with the server time', async () => {
    await assertSucceeds(updateDoc(doc(as('kidA'), 'sessions/c1'), { 'joins.kidA': serverTimestamp() }));
  });

  test('they cannot backdate or erase their own join stamp', async () => {
    const a = as('kidA');
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'joins.kidA': Timestamp.fromMillis(Date.now() - HOUR) }));
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'joins.kidA': deleteField() }));
  });

  test("replacing the whole joins map, dropping another student's stamp, is refused", async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/c1'), { joins: { kidA: serverTimestamp() } }));
  });

  test("they cannot stamp someone else, or erase someone else's stamp", async () => {
    const a = as('kidA');
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'joins.kidB': serverTimestamp() }));
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'joins.kidB': deleteField() }));
  });
});

describe('student writes to a class: everything except joins and absences is off-limits', () => {
  beforeEach(() => seed({ ...standard(), 'sessions/c1': makeClass(24) }));

  const forbidden = {
    'a new top-level field': { homework: 'done' },
    'the attendance map': { 'attendance.kidA': 'present' },
    'the whole attendance map': { attendance: { kidA: 'present' } },
    'the start time': { startsAt: Timestamp.fromMillis(Date.now() + 48 * HOUR) },
    'the end time': { endsAt: Timestamp.fromMillis(Date.now() + 48 * HOUR) },
    'the status': { status: 'cancelled' },
    'the note': { note: 'hi' },
    'the series id': { seriesId: 'other' },
    'the batch name': { seriesName: 'Mine now' },
    'the student list (adding a friend)': { studentIds: ['kidA', 'kidB', 'kidC'] },
  };
  for (const [what, patch] of Object.entries(forbidden)) {
    test(`changing ${what} is refused`, async () => {
      await assertFails(updateDoc(doc(as('kidA'), 'sessions/c1'), patch));
    });
  }

  test('setDoc that rewrites the class with only a join added is still refused if anything else differs', async () => {
    const data = makeClass(24);
    await assertFails(setDoc(doc(as('kidA'), 'sessions/c1'), { ...data, joins: { kidA: serverTimestamp() }, link: 'https://evil.example' }));
  });

  test('a student cannot delete their own record', async () => {
    await assertFails(deleteDoc(doc(as('kidA'), 'students/kidA')));
  });

  test('a student cannot read or list series, nor query classes by batch', async () => {
    const a = as('kidA');
    await assertFails(getDocs(collection(a, 'series')));
    await assertFails(getDocs(query(collection(a, 'sessions'), where('seriesId', '==', 's1'))));
  });

  test('signed out cannot write a join', async () => {
    await assertFails(updateDoc(doc(as(null), 'sessions/c1'), { 'joins.kidA': serverTimestamp() }));
  });
});

describe("can't attend: the 2-hour cut-off", () => {
  const cut = 2; // hours
  beforeEach(() => seed({
    ...standard(),
    'sessions/justOutside': makeClass(cut + 5 / 60),
    'sessions/justInside': makeClass(cut - 5 / 60),
    'sessions/notedOutside': makeClass(cut + 5 / 60, { absences: { kidA: { at: Timestamp.fromMillis(Date.now() - HOUR), reason: 'x' } } }),
    'sessions/notedInside': makeClass(cut - 5 / 60, { absences: { kidA: { at: Timestamp.fromMillis(Date.now() - HOUR), reason: 'x' } } }),
    'sessions/inProgress': makeClass(-0.25),
  }));

  test('a note 2 h 5 min before the start is accepted', async () => {
    await assertSucceeds(updateDoc(doc(as('kidA'), 'sessions/justOutside'), { 'absences.kidA': note() }));
  });

  test('a note 1 h 55 min before the start is refused', async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/justInside'), { 'absences.kidA': note() }));
  });

  test('taking a note back 2 h 5 min before the start is accepted', async () => {
    await assertSucceeds(updateDoc(doc(as('kidA'), 'sessions/notedOutside'), { 'absences.kidA': deleteField() }));
  });

  test('taking a note back 1 h 55 min before the start is refused', async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/notedInside'), { 'absences.kidA': deleteField() }));
  });

  test('changing the reason of an existing note follows the same cut-off', async () => {
    await assertSucceeds(updateDoc(doc(as('kidA'), 'sessions/notedOutside'), { 'absences.kidA': note('changed') }));
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/notedInside'), { 'absences.kidA': note('changed') }));
  });

  test('a note on a class already in progress is refused', async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/inProgress'), { 'absences.kidA': note() }));
  });

  test('pressing Join stays allowed inside the cut-off (only notes are cut off)', async () => {
    await assertSucceeds(updateDoc(doc(as('kidA'), 'sessions/justInside'), { 'joins.kidA': serverTimestamp() }));
  });

  test('the coach may still edit notes inside the cut-off', async () => {
    await assertSucceeds(updateDoc(doc(as('coach1'), 'sessions/notedInside'), { 'absences.kidA': deleteField() }));
  });
});

describe("can't attend: whose note, which class, what shape", () => {
  beforeEach(() => seed({
    ...standard(),
    'sessions/c1': makeClass(24, { absences: { kidB: { at: Timestamp.fromMillis(Date.now() - HOUR), reason: 'B away' } } }),
    'sessions/notMine': makeClass(24, { studentIds: ['kidB'] }),
    'sessions/done': makeClass(24, { status: 'done' }),
    'sessions/pausedNoted': makeClass(24, { studentIds: ['kidA', 'kidOff'], absences: { kidOff: { at: Timestamp.fromMillis(Date.now() - HOUR), reason: 'x' } } }),
  }));

  test("removing someone else's note is refused", async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/c1'), { 'absences.kidB': deleteField() }));
  });

  test("replacing the whole absences map (wiping another student's note) is refused", async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/c1'), { absences: { kidA: note() } }));
  });

  test('a note on a class the student is not in is refused', async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/notMine'), { 'absences.kidA': note() }));
  });

  test('a note on a class that is not "scheduled" is refused, even days ahead', async () => {
    await assertFails(updateDoc(doc(as('kidA'), 'sessions/done'), { 'absences.kidA': note() }));
  });

  test('a reason of exactly 200 characters is accepted; a note with no reason, or a non-text reason, is refused', async () => {
    const a = as('kidA');
    await assertSucceeds(updateDoc(doc(a, 'sessions/c1'), { 'absences.kidA': note('x'.repeat(200)) }));
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'absences.kidA': { at: serverTimestamp() } }));
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'absences.kidA': { at: serverTimestamp(), reason: 42 } }));
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'absences.kidA': { at: serverTimestamp(), reason: null } }));
    await assertFails(updateDoc(doc(a, 'sessions/c1'), { 'absences.kidA': {} }));
  });

  test('a 200-character reason in Hindi is accepted like one in English', async () => {
    await assertSucceeds(updateDoc(doc(as('kidA'), 'sessions/c1'), { 'absences.kidA': note('क'.repeat(200)) }));
  });

  test("a paused student cannot take back an earlier note", async () => {
    await assertFails(updateDoc(doc(as('kidOff'), 'sessions/pausedNoted'), { 'absences.kidOff': deleteField() }));
  });
});

describe('coach', () => {
  beforeEach(() => seed({ ...standard(), 'sessions/c1': makeClass(1, { absences: { kidA: { at: Timestamp.fromMillis(1), reason: 'x' } } }) }));

  test('can create, change and delete students, batches and classes', async () => {
    const c = as('coach1');
    await assertSucceeds(updateDoc(doc(c, 'students/kidA'), { active: false }));
    await assertSucceeds(deleteDoc(doc(c, 'students/kidB')));
    await assertSucceeds(updateDoc(doc(c, 'series/s1'), { name: 'Renamed' }));
    await assertSucceeds(deleteDoc(doc(c, 'series/s1')));
    await assertSucceeds(setDoc(doc(c, 'sessions/c2'), makeClass(48)));
    await assertSucceeds(updateDoc(doc(c, 'sessions/c1'), { startsAt: Timestamp.fromMillis(Date.now() + 72 * HOUR), link: 'https://meet.example/2', studentIds: ['kidB'] }));
    await assertSucceeds(updateDoc(doc(c, 'sessions/c1'), { 'joins.kidA': Timestamp.fromMillis(5), 'absences.kidA': deleteField() }));
    await assertSucceeds(deleteDoc(doc(c, 'sessions/c1')));
  });

  test('can read but never write any config document', async () => {
    const c = as('coach1');
    await assertSucceeds(getDoc(doc(c, 'config/coach')));
    await assertSucceeds(getDoc(doc(c, 'config/other')));
    await assertFails(updateDoc(doc(c, 'config/coach'), { email: 'x@example.com' }));
    await assertFails(deleteDoc(doc(c, 'config/coach')));
    await assertFails(setDoc(doc(c, 'config/other'), { a: 1 }));
  });

  test('a student cannot read config/other either', async () => {
    await assertFails(getDoc(doc(as('kidA'), 'config/other')));
  });
});
