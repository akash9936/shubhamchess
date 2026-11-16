// Student portal — logic and data layer. No DOM and no Firebase import in here: the SDK
// functions are passed in, so the same file runs in the browser (app.js) and in the
// emulator tests (firebase/tests). Design: docs/student-portal-plan.md.

export const STUDENT_DOMAIN = 'students.local';
export const COACH_DOMAIN = 'coach.local';
export const JOIN_OPENS_MIN = 10;
const IST_OFFSET_MS = 330 * 60000;            // India has no daylight saving
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0, 1

// ---------- access codes ----------

export function slugNick(nickname) {
  const s = String(nickname || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return s || 'STUDENT';
}

export function randomPart(len = 4) {
  const buf = new Uint32Array(len);
  globalThis.crypto.getRandomValues(buf);
  let out = '';
  for (const n of buf) out += CODE_ALPHABET[n % CODE_ALPHABET.length];
  return out;
}

// The part before the dash is the sign-in name and never changes; the whole code is the
// password, so a new code only needs a password change.
export function makeLoginId(nickname, taken = new Set()) {
  const base = slugNick(nickname).toLowerCase();
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!taken.has(base + n)) return base + n;
  throw new Error('No free sign-in name for ' + nickname);
}

export const makeCode = (loginId) => loginId.toUpperCase() + '-' + randomPart();
export const studentEmail = (loginId) => loginId.toLowerCase() + '@' + STUDENT_DOMAIN;

export function parseCode(input) {
  const code = String(input || '').toUpperCase().replace(/\s+/g, '').replace(/[–—]/g, '-');
  const m = /^([A-Z0-9]{1,14})-([A-Z0-9]{4,8})$/.exec(code);
  if (!m) return null;
  return { loginId: m[1].toLowerCase(), email: studentEmail(m[1]), password: code };
}

// A plain ID gets the coach domain; a full email address is used as typed. Either way
// it is config/coach, not the address, that makes an account the coach.
export function coachEmail(id) {
  const typed = String(id || '').trim().toLowerCase();
  if (typed.includes('@')) return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(typed) ? typed : null;
  return /^[a-z0-9._-]{3,30}$/.test(typed) ? typed + '@' + COACH_DOMAIN : null;
}

// ---------- time ----------

export function istToUtcMs(dateStr, timeStr) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  const t = /^(\d{1,2}):(\d{2})$/.exec(timeStr || '');
  if (!d || !t) return NaN;
  return Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1], +t[2]) - IST_OFFSET_MS;
}

export function istParts(ms) {
  const d = new Date(ms + IST_OFFSET_MS);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate()),
    time: p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()),
    weekday: d.getUTCDay(),
  };
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// weekdays: 0 = Sunday … 6 = Saturday, read on the Indian calendar.
export function expandSeries({ startDate, weekdays, startTime, durationMin, weeks }) {
  const out = [];
  const days = new Set(weekdays.map(Number));
  for (let i = 0; i < weeks * 7; i++) {
    const date = addDays(startDate, i);
    const [y, m, d] = date.split('-').map(Number);
    if (!days.has(new Date(Date.UTC(y, m - 1, d)).getUTCDay())) continue;
    const startsAtMs = istToUtcMs(date, startTime);
    out.push({ startsAtMs, endsAtMs: startsAtMs + durationMin * 60000 });
  }
  return out;
}

export function validateSeries(s) {
  if (!String(s.name || '').trim()) return 'Give the batch a name.';
  if (!s.studentIds || !s.studentIds.length) return 'Pick at least one student.';
  if (!s.weekdays || !s.weekdays.length) return 'Pick at least one day of the week.';
  if (Number.isNaN(istToUtcMs(s.startDate, s.startTime))) return 'Set the start date and the class time.';
  if (!(s.durationMin >= 10 && s.durationMin <= 240)) return 'Class length must be between 10 and 240 minutes.';
  if (!(s.weeks >= 1 && s.weeks <= 26)) return 'Weeks must be between 1 and 26.';
  if (!isHttpsUrl(s.link)) return 'The meeting link must start with https://';
  return null;
}

export function isHttpsUrl(s) {
  try { return new URL(String(s)).protocol === 'https:'; } catch (e) { return false; }
}

// 'cancelled' | 'upcoming' | 'open' (10 min before start until the end) | 'over'
export function joinState(session, nowMs) {
  if (session.status === 'cancelled') return 'cancelled';
  if (nowMs >= session.endsAtMs) return 'over';
  if (nowMs >= session.startsAtMs - JOIN_OPENS_MIN * 60000) return 'open';
  return 'upcoming';
}

// ---------- data layer ----------

const BATCH_LIMIT = 400;

export function makeApi({ fb, auth, db, secondaryAuth }) {
  const col = (name) => fb.collection(db, name);
  const ref = (name, id) => fb.doc(db, name, id);
  const ts = (ms) => fb.Timestamp.fromMillis(ms);
  const rows = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const toSession = (s) => ({
    ...s,
    startsAtMs: s.startsAt.toMillis(),
    endsAtMs: s.endsAt.toMillis(),
    joins: s.joins || {},
  });
  const byStart = (a, b) => a.startsAtMs - b.startsAtMs;

  async function commitInChunks(ops) {
    for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
      const batch = fb.writeBatch(db);
      for (const op of ops.slice(i, i + BATCH_LIMIT)) op(batch);
      await batch.commit();
    }
  }

  async function seriesSessions(seriesId) {
    const snap = await fb.getDocs(fb.query(col('sessions'), fb.where('seriesId', '==', seriesId)));
    return rows(snap).map(toSession).sort(byStart);
  }

  const sessionDoc = (seriesId, series, slot) => ({
    seriesId,
    seriesName: series.name,
    startsAt: ts(slot.startsAtMs),
    endsAt: ts(slot.endsAtMs),
    link: series.link,
    studentIds: series.studentIds,
    status: 'scheduled',
    note: '',
    joins: {},
  });

  return {
    // ----- sign-in -----
    async signInStudent(codeInput) {
      const c = parseCode(codeInput);
      if (!c) throw Object.assign(new Error('bad-code'), { code: 'portal/bad-code' });
      return (await fb.signInWithEmailAndPassword(auth, c.email, c.password)).user;
    },
    async signInCoach(id, password) {
      const email = coachEmail(id);
      if (!email || !password) throw Object.assign(new Error('bad-coach-id'), { code: 'portal/bad-code' });
      return (await fb.signInWithEmailAndPassword(auth, email, password)).user;
    },
    signOut: () => fb.signOut(auth),

    // Who is this signed-in user? Only the coach may read config/coach, so a refusal
    // there simply means "not the coach".
    async whoAmI(user) {
      try {
        const c = await fb.getDoc(ref('config', 'coach'));
        if (c.exists() && c.data().uid === user.uid) return { role: 'coach' };
      } catch (e) { /* permission-denied: not the coach */ }
      try {
        const s = await fb.getDoc(ref('students', user.uid));
        if (s.exists()) return { role: 'student', student: { id: s.id, ...s.data() } };
      } catch (e) { /* no record */ }
      return { role: 'none' };
    },

    // ----- students (coach) -----
    async listStudents() {
      return rows(await fb.getDocs(col('students')))
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    },

    async addStudent({ fullName, nickname, mobile, email }) {
      const taken = new Set((await this.listStudents()).map((s) => s.loginId));
      const sa = await secondaryAuth();
      let loginId, code, uid;
      for (let attempt = 0; ; attempt++) {
        loginId = makeLoginId(nickname, taken);
        code = makeCode(loginId);
        try {
          uid = (await fb.createUserWithEmailAndPassword(sa, studentEmail(loginId), code)).user.uid;
          break;
        } catch (e) {
          // a sign-in name left over from a removed student: skip it and try the next
          if (e.code !== 'auth/email-already-in-use' || attempt >= 5) throw e;
          taken.add(loginId);
        }
      }
      await fb.signOut(sa);
      const student = {
        fullName: fullName.trim(), nickname: nickname.trim(),
        mobile: (mobile || '').trim(), email: (email || '').trim(),
        loginId, accessCode: code, active: true, createdAt: fb.serverTimestamp(),
      };
      await fb.setDoc(ref('students', uid), student);
      return { id: uid, ...student };
    },

    async regenerateCode(student) {
      const sa = await secondaryAuth();
      const user = (await fb.signInWithEmailAndPassword(sa, studentEmail(student.loginId), student.accessCode)).user;
      const code = makeCode(student.loginId);
      await fb.updatePassword(user, code);
      await fb.signOut(sa);
      await fb.updateDoc(ref('students', student.id), { accessCode: code });
      return code;
    },

    setStudentActive: (id, active) => fb.updateDoc(ref('students', id), { active: !!active }),

    // ----- batches (coach) -----
    async listSeries() {
      return rows(await fb.getDocs(col('series'))).sort((a, b) => a.name.localeCompare(b.name));
    },

    async addSeries(input) {
      const series = {
        name: input.name.trim(), studentIds: input.studentIds, weekdays: input.weekdays.map(Number),
        startTime: input.startTime, durationMin: Number(input.durationMin),
        startDate: input.startDate, weeks: Number(input.weeks), link: input.link.trim(),
      };
      const problem = validateSeries(series);
      if (problem) throw Object.assign(new Error(problem), { code: 'portal/invalid' });
      const slots = expandSeries(series);
      if (!slots.length) throw Object.assign(new Error('No class falls on those days.'), { code: 'portal/invalid' });
      const sRef = fb.doc(col('series'));
      const ops = [(b) => b.set(sRef, { ...series, createdAt: fb.serverTimestamp() })];
      for (const slot of slots) {
        const r = fb.doc(col('sessions'));
        ops.push((b) => b.set(r, sessionDoc(sRef.id, series, slot)));
      }
      await commitInChunks(ops);
      return { id: sRef.id, sessions: slots.length };
    },

    // Name, students and link: changes the batch and every class that has not started.
    async updateSeries(series, patch, nowMs = Date.now()) {
      const next = {};
      if (patch.name != null) next.name = patch.name.trim();
      if (patch.studentIds) next.studentIds = patch.studentIds;
      if (patch.link != null) {
        if (!isHttpsUrl(patch.link)) throw Object.assign(new Error('The meeting link must start with https://'), { code: 'portal/invalid' });
        next.link = patch.link.trim();
      }
      const sPatch = {};
      if (next.name) sPatch.seriesName = next.name;
      if (next.studentIds) sPatch.studentIds = next.studentIds;
      if (next.link) sPatch.link = next.link;
      const future = (await seriesSessions(series.id)).filter((s) => s.startsAtMs > nowMs);
      const ops = [(b) => b.update(ref('series', series.id), next)];
      for (const s of future) ops.push((b) => b.update(ref('sessions', s.id), sPatch));
      await commitInChunks(ops);
      return future.length;
    },

    async extendSeries(series, weeks) {
      const all = await seriesSessions(series.id);
      const lastMs = all.length ? all[all.length - 1].startsAtMs : istToUtcMs(series.startDate, series.startTime);
      const slots = expandSeries({ ...series, startDate: addDays(istParts(lastMs).date, 1), weeks });
      const ops = [(b) => b.update(ref('series', series.id), { weeks: series.weeks + weeks })];
      for (const slot of slots) {
        const r = fb.doc(col('sessions'));
        ops.push((b) => b.set(r, sessionDoc(series.id, series, slot)));
      }
      await commitInChunks(ops);
      return slots.length;
    },

    // Removes the batch and its classes that have not started; past classes stay as the
    // attendance record.
    async deleteSeries(series, nowMs = Date.now()) {
      const future = (await seriesSessions(series.id)).filter((s) => s.startsAtMs > nowMs);
      const ops = [(b) => b.delete(ref('series', series.id))];
      for (const s of future) ops.push((b) => b.delete(ref('sessions', s.id)));
      await commitInChunks(ops);
      return future.length;
    },

    // ----- classes -----
    async listSessionsBetween(fromMs, toMs) {           // coach
      const snap = await fb.getDocs(fb.query(col('sessions'),
        fb.where('startsAt', '>=', ts(fromMs)), fb.where('startsAt', '<', ts(toMs))));
      return rows(snap).map(toSession).sort(byStart);
    },

    async listMySessions(uid) {                         // student
      const snap = await fb.getDocs(fb.query(col('sessions'), fb.where('studentIds', 'array-contains', uid)));
      return rows(snap).map(toSession).sort(byStart);
    },

    async updateSession(session, patch) {               // coach: one class only
      const next = {};
      if (patch.status) next.status = patch.status;
      if (patch.note != null) next.note = patch.note;
      if (patch.link != null) {
        if (!isHttpsUrl(patch.link)) throw Object.assign(new Error('The meeting link must start with https://'), { code: 'portal/invalid' });
        next.link = patch.link.trim();
      }
      if (patch.date && patch.time) {
        const startMs = istToUtcMs(patch.date, patch.time);
        if (Number.isNaN(startMs)) throw Object.assign(new Error('Set both the date and the time.'), { code: 'portal/invalid' });
        next.startsAt = ts(startMs);
        next.endsAt = ts(startMs + (session.endsAtMs - session.startsAtMs));
      }
      await fb.updateDoc(ref('sessions', session.id), next);
    },

    // The student's own join time — the only thing a student can write.
    recordJoin: (session, uid) =>
      fb.updateDoc(ref('sessions', session.id), { ['joins.' + uid]: fb.serverTimestamp() }),
  };
}
