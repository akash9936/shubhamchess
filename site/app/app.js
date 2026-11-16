// Student portal — screens. Data and rules of the game live in core.js; this file only
// draws. Everything from the database is written with textContent, never as HTML.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import * as fbAuth from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import * as fbStore from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
import { makeApi, joinState, isHttpsUrl, istParts, JOIN_OPENS_MIN, CANCEL_CUTOFF_MIN, canCancel, studentStatus, attendanceSummary, percent, monthRangeIST, waLink, welcomeMessage, reminderMessage } from './core.js';

const root = document.getElementById('app');
const signoutBtn = document.getElementById('signout');
const WA = 'https://wa.me/918223820430';
const DAY = 86400000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CUTOFF_HOURS = CANCEL_CUTOFF_MIN / 60;
const STATUS = { present: ['Attended', ''], informed: ['Told us', ' warn'], absent: ['Missed', ' off'], cancelled: ['Cancelled', ' off'] };

// ---------- tiny DOM helper ----------
function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'open') el[k] = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}
const show = (...nodes) => root.replaceChildren(...nodes.flat().filter((n) => n != null && n !== false));
const field = (label, input, cls) => h('label', { class: 'p-field' + (cls ? ' ' + cls : '') }, h('span', {}, label), input);

// ---------- time ----------
const fmt = (opts, tz) => new Intl.DateTimeFormat(undefined, tz ? { ...opts, timeZone: tz } : opts);
const WHEN = { weekday: 'long', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true };
const whenLocal = (ms) => fmt(WHEN).format(ms);
const whenIST = (ms) => fmt(WHEN, 'Asia/Kolkata').format(ms);
const timeIST = (ms) => fmt({ hour: 'numeric', minute: '2-digit', hour12: true }, 'Asia/Kolkata').format(ms);
const dayIST = (ms) => fmt({ weekday: 'long', day: 'numeric', month: 'short' }, 'Asia/Kolkata').format(ms);
const inIndia = () => whenLocal(0) === whenIST(0) && whenLocal(15552000000) === whenIST(15552000000);

function untilText(ms, now) {
  const mins = Math.round((ms - now) / 60000);
  if (mins <= 0) return 'now';
  if (mins < 60) return 'in ' + mins + ' min';
  if (mins < 24 * 60) return 'in ' + Math.floor(mins / 60) + ' h ' + (mins % 60) + ' min';
  const days = Math.round(mins / 1440);
  return days === 1 ? 'tomorrow' : 'in ' + days + ' days';
}

function friendly(e) {
  const c = (e && e.code) || '';
  if (c === 'portal/invalid') return e.message;
  if (c === 'portal/bad-code') return 'That does not look right. Check it and try again.';
  if (/invalid-credential|wrong-password|user-not-found|invalid-email|invalid-login/.test(c)) return 'That code did not work. Check it and try again.';
  if (/too-many-requests/.test(c)) return 'Too many tries. Wait a few minutes, then try again.';
  if (/network/.test(c) || c === 'unavailable') return 'No internet connection. Try again.';
  if (/permission-denied/.test(c)) return 'This login is not allowed to do that.';
  return 'Something went wrong. Try again, or message us on WhatsApp.';
}

// A button that runs an async action, disables itself meanwhile and reports problems.
function action(label, cls, run, out) {
  const b = h('button', { type: 'button', class: cls }, label);
  b.addEventListener('click', async () => {
    b.disabled = true;
    if (out) { out.className = 'p-error'; out.textContent = ''; }
    try { await run(b); } catch (e) { if (!/^portal\//.test(e.code || '')) console.error(e); if (out) out.textContent = friendly(e); }
    b.disabled = false;
  });
  return b;
}

// ---------- start ----------
const params = new URLSearchParams(location.search);
const emulator = params.has('emu') && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
let api, auth, timer;

function start() {
  const config = emulator ? { projectId: 'demo-shubhamchess', apiKey: 'demo-key' } : firebaseConfig;
  if (!config) {
    show(h('div', { class: 'p-narrow p-card' },
      h('h2', {}, 'The student login is not open yet'),
      h('p', { class: 'p-sub' }, 'We are setting it up. Until then your coach sends the class link on WhatsApp.'),
      h('p', { style: 'margin-top:14px' }, h('a', { class: 'btn primary', href: WA, target: '_blank', rel: 'noopener' }, 'Message us on WhatsApp'))));
    return;
  }
  const app = initializeApp(config);
  auth = fbAuth.getAuth(app);
  const db = fbStore.getFirestore(app);
  const second = initializeApp(config, 'second');           // creates student logins without signing the coach out
  const secondAuth = fbAuth.getAuth(second);
  if (emulator) {
    fbAuth.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fbAuth.connectAuthEmulator(secondAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fbStore.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  fbAuth.setPersistence(secondAuth, fbAuth.inMemoryPersistence);
  api = makeApi({ fb: { ...fbAuth, ...fbStore }, auth, db, secondaryAuth: async () => secondAuth });
  signoutBtn.addEventListener('click', () => api.signOut());
  fbAuth.onAuthStateChanged(auth, route);
}

async function route(user) {
  clearInterval(timer);
  signoutBtn.hidden = !user;
  if (!user) return signInView();
  show(h('p', { class: 'p-loading' }, 'Loading…'));
  const who = await api.whoAmI(user);
  if (who.role === 'coach') return coachView();
  if (who.role === 'student' && who.student.active) return studentView(user, who.student);
  show(h('div', { class: 'p-narrow p-card' },
    h('h2', {}, who.role === 'student' ? 'This login is paused' : 'This login is not linked to a student'),
    h('p', { class: 'p-sub' }, 'Message us on WhatsApp and we will sort it out.'),
    h('p', { style: 'margin-top:14px' }, h('a', { class: 'btn primary', href: WA, target: '_blank', rel: 'noopener' }, 'Message us on WhatsApp'))));
}

// ---------- sign-in ----------
function signInView(who) {
  // Step 1: say who you are. Step 2: the matching form.
  const pick = (id, title, sub) => h('button', { type: 'button', id: 'as-' + id, class: 'p-choice', 'aria-pressed': String(who === id), onclick: () => signInView(id) },
    h('b', {}, title), h('span', {}, sub));
  const chooser = h('div', { class: 'p-choose', role: 'group', 'aria-label': 'Who is signing in' },
    pick('student', 'Student', 'I have an access code'),
    pick('coach', 'Coach', 'I have a coach ID and password'));
  const err = h('p', { class: 'p-error', role: 'alert' });
  let form = null, first = null;

  if (who === 'student') {
    const code = first = h('input', { type: 'text', class: 'p-code', id: 'code', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'NAME-XXXX', required: true });
    const go = h('button', { type: 'submit', class: 'btn primary' }, 'Open my classes');
    form = h('form', { class: 'p-stack', onsubmit: submit(() => api.signInStudent(code.value), go, err) },
      h('p', { class: 'p-sub' }, 'Type the access code your coach gave you. There is no password.'),
      field('Your access code', code), go, err,
      h('p', { class: 'p-sub' }, 'Lost your code? ', h('a', { href: WA, target: '_blank', rel: 'noopener' }, 'Message us on WhatsApp'), '.'));
  } else if (who === 'coach') {
    const cid = first = h('input', { type: 'text', id: 'coach-id', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', required: true });
    const cpw = h('input', { type: 'password', id: 'coach-pw', autocomplete: 'current-password', required: true });
    const go = h('button', { type: 'submit', class: 'btn primary' }, 'Coach sign-in');
    form = h('form', { class: 'p-stack', onsubmit: submit(() => api.signInCoach(cid.value, cpw.value), go, err, 'That coach ID or password did not work. Check both and try again.') },
      field('Coach ID or email', cid), field('Password', cpw), go, err);
  }

  show(h('div', { class: 'p-narrow' },
    h('div', { class: 'p-card' },
      h('span', { class: 'eyebrow' }, 'Login'),
      h('h2', { style: 'margin-block:10px 14px' }, who ? (who === 'student' ? 'Student login' : 'Coach login') : 'Who is signing in?'),
      chooser, form)));
  if (first) first.focus();
}

function submit(run, btn, err, wrongMsg) {
  return async (ev) => {
    ev.preventDefault();
    btn.disabled = true; err.textContent = '';
    try { await run(); } catch (e) {
      const msg = friendly(e);
      err.textContent = wrongMsg && /did not work|does not look right/.test(msg) ? wrongMsg : msg;
      btn.disabled = false;
    }
  };
}

// ---------- student ----------
async function studentView(user, student) {
  let sessions = [], editing = null, draft = '', problem = '';
  const abroad = !inIndia();
  const uid = user.uid;

  const draw = () => {
    const now = Date.now();
    const live = sessions.filter((s) => s.status !== 'cancelled' && s.endsAtMs > now);
    const next = live[0];
    const upcoming = sessions.filter((s) => s.endsAtMs > now && s !== next).slice(0, 12);
    const past = sessions.filter((s) => s.endsAtMs <= now).reverse().slice(0, 12);
    const month = monthRangeIST(istParts(now).date.slice(0, 7));
    const mine = attendanceSummary(sessions.filter((s) => s.startsAtMs >= month.fromMs && s.startsAtMs < month.toMs), now)[uid];
    show(
      h('div', { class: 'p-head' }, h('div', {}, h('h1', {}, 'Hello, ' + student.nickname),
        h('p', { id: 'month-line' }, mine ? 'This month: attended ' + mine.present + ' of ' + mine.held + (mine.held === 1 ? ' class' : ' classes') : 'Your chess classes'))),
      next ? nextCard(next, now) : h('div', { class: 'p-card p-next' },
        h('h2', {}, 'No class is scheduled yet'),
        h('p', { class: 'p-sub' }, 'Your coach will add your classes here. Ask on WhatsApp if you expected one.')),
      upcoming.length ? h('div', { class: 'p-card' }, h('h2', {}, 'Coming up'), h('ul', { class: 'p-rows' }, upcoming.map((s) => studentRow(s, now)))) : null,
      past.length ? h('div', { class: 'p-card' }, h('details', { class: 'p-more' }, h('summary', {}, 'Past classes'),
        h('ul', { class: 'p-rows' }, past.map((s) => studentRow(s, now))))) : null);
    const box = document.getElementById('reason');
    if (box) box.focus();
  };

  // "Can't attend": offered until 2 hours before the start, and can be taken back until then.
  const cancelControls = (s, now) => {
    const told = s.absences[uid], openNow = canCancel(s, now);
    const run = (fn) => async () => {
      problem = '';
      try { await fn(); editing = null; draft = ''; } catch (e) {
        problem = /permission-denied/.test(e.code || '') ? 'It is less than ' + CUTOFF_HOURS + ' hours to this class, so this is closed. Message us on WhatsApp.' : friendly(e);
      }
      draw();
    };
    if (told) return h('div', { class: 'p-actions' },
      h('span', { class: 'p-pill warn' }, 'You told us you can\u2019t attend'),
      openNow ? h('button', { type: 'button', class: 'p-link', 'data-undo': s.id, onclick: run(async () => { await api.clearAbsence(s, uid); delete s.absences[uid]; }) }, 'I can attend after all') : null);
    if (!openNow) return null;
    if (editing !== s.id) return h('div', { class: 'p-actions' },
      h('button', { type: 'button', class: 'p-link', 'data-cant': s.id, onclick: () => { editing = s.id; draft = ''; problem = ''; draw(); } }, 'Can\u2019t attend this class'));
    const reason = h('input', { type: 'text', id: 'reason', maxlength: '200', placeholder: 'Reason (optional)', value: draft, oninput: (e) => { draft = e.target.value; } });
    return h('form', { class: 'p-stack', onsubmit: (e) => { e.preventDefault(); run(async () => { await api.setAbsence(s, uid, draft); s.absences[uid] = { reason: draft }; })(); } },
      field('Tell your coach you can\u2019t attend', reason),
      h('div', { class: 'p-actions' },
        h('button', { type: 'submit', class: 'btn primary small' }, 'Tell the coach'),
        h('button', { type: 'button', class: 'p-link', onclick: () => { editing = null; problem = ''; draw(); } }, 'Back')),
      problem ? h('p', { class: 'p-error' }, problem) : null);
  };

  const nextCard = (s, now) => {
    const state = joinState(s, now);
    const open = state === 'open' && isHttpsUrl(s.link);
    const started = now >= s.startsAtMs;
    const join = h('a', open
      ? { class: 'btn primary', id: 'join', href: s.link, target: '_blank', rel: 'noopener', onclick: () => { if (!s.joins[uid]) { s.joins[uid] = true; api.recordJoin(s, uid).catch(console.error); } } }
      : { class: 'btn primary', id: 'join', 'aria-disabled': 'true', role: 'link' }, 'Join class');
    const controls = cancelControls(s, now);
    return h('div', { class: 'p-card p-next' },
      h('span', { class: 'p-pill' + (open ? ' live' : '') }, started ? 'Class is on now' : open ? 'Starts ' + untilText(s.startsAtMs, now) : 'Next class · ' + untilText(s.startsAtMs, now)),
      h('p', { class: 'p-when' }, whenLocal(s.startsAtMs)),
      abroad ? h('p', { class: 'p-sub' }, whenIST(s.startsAtMs) + ' in India') : null,
      h('p', { class: 'p-sub' }, s.seriesName + (s.note ? ' · ' + s.note : '')),
      join,
      open ? null : h('p', { class: 'p-sub', style: 'margin-top:10px' }, 'The button turns on ' + JOIN_OPENS_MIN + ' minutes before the class starts.'),
      controls ? h('div', { style: 'margin-top:14px' }, controls) : null,
      !controls && !started ? h('p', { class: 'p-sub', id: 'cutoff-note', style: 'margin-top:10px' },
        'You can say you can\u2019t attend up to ' + CUTOFF_HOURS + ' hours before a class. For this one, ',
        h('a', { href: WA, target: '_blank', rel: 'noopener' }, 'message us on WhatsApp'), '.') : null);
  };

  const studentRow = (s, now) => {
    const st = studentStatus(s, uid, now);
    const isPast = s.endsAtMs <= now;
    const pill = st === 'cancelled' || isPast ? h('span', { class: 'p-pill' + STATUS[st][1] }, STATUS[st][0]) : null;
    return h('li', { class: 'p-row' + (st === 'cancelled' ? ' cancelled' : '') },
      h('div', { class: 'p-row-top' }, h('b', {}, whenLocal(s.startsAtMs)), pill),
      h('span', { class: 'p-sub' }, s.seriesName + (abroad ? ' · ' + whenIST(s.startsAtMs) + ' in India' : '') + (s.note ? ' · ' + s.note : '')),
      isPast || st === 'cancelled' ? null : cancelControls(s, now));
  };

  const load = async () => { try { sessions = await api.listMySessions(uid); draw(); } catch (e) { console.error(e); } };
  await load();
  let ticks = 0;
  // redraw every 30 s, refetch every 5 min; hold still while a reason is being typed
  timer = setInterval(() => { if (editing) return; (++ticks % 10 === 0) ? load() : draw(); }, 30000);
}

// ---------- coach ----------
async function coachView() {
  let tab = 'classes', students = [], series = [], sessions = [], notice = '';
  const att = { month: istParts(Date.now()).date.slice(0, 7), batch: '', sessions: null };
  const nameOf = (id) => { const s = students.find((x) => x.id === id); return s ? s.nickname : 'removed'; };

  const reload = async () => {
    const from = Date.now() - 3 * 3600000;
    [students, series, sessions] = await Promise.all([api.listStudents(), api.listSeries(), api.listSessionsBetween(from, from + 8 * DAY)]);
    draw();
  };
  const done = async (msg) => { notice = msg; await reload(); };
  const loadAtt = async () => {
    const r = monthRangeIST(att.month);
    att.sessions = await api.listSessionsBetween(r.fromMs, r.toMs);
    draw();
  };
  // One line per student: a WhatsApp link with the message written, plus Copy. The coach
  // presses send in WhatsApp himself. No mobile saved → Copy only.
  const sendLines = (ids, makeText, kind) => ids.map((id) => {
    const st = students.find((x) => x.id === id);
    if (!st) return null;
    const text = makeText(st), link = waLink(st.mobile, text);
    const copied = h('span', { class: 'p-ok' });
    return h('div', { class: 'p-actions p-send', 'data-send': kind, 'data-student': st.nickname },
      h('span', { class: 'p-send-name' }, st.nickname),
      link ? h('a', { class: 'p-link', href: link, target: '_blank', rel: 'noopener' }, 'Open WhatsApp')
        : h('span', { class: 'p-sub' }, st.mobile ? 'Number looks wrong' : 'No WhatsApp number saved'),
      h('button', { type: 'button', class: 'p-link', onclick: async () => { try { await navigator.clipboard.writeText(text); copied.textContent = 'Copied'; } catch (e) { copied.textContent = 'Could not copy'; } } }, 'Copy message'),
      copied);
  });

  // Coach's own mark on one student in one class: automatic → present → absent → automatic.
  const flip = async (s, id) => {
    const cur = s.attendance[id];
    const next = !cur ? 'present' : cur === 'present' ? 'absent' : null;
    await api.markAttendance(s, id, next);
    if (next) s.attendance[id] = next; else delete s.attendance[id];
    draw();
  };

  const draw = () => {
    const tabs = [['classes', 'Classes'], ['students', 'Students (' + students.filter((s) => s.active).length + ')'], ['batches', 'Batches (' + series.length + ')'], ['attendance', 'Attendance']];
    show(
      h('div', { class: 'p-head' }, h('div', {}, h('h1', {}, 'Coach desk'), h('p', {}, 'All times are India time.'))),
      h('div', { class: 'p-tabs', role: 'tablist' }, tabs.map(([id, label]) =>
        h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === id), 'data-tab': id, onclick: () => { tab = id; notice = ''; draw(); if (id === 'attendance') loadAtt().catch(console.error); } }, label))),
      notice ? h('p', { class: 'p-ok', id: 'notice', style: 'margin-bottom:14px' }, notice) : null,
      tab === 'classes' ? classesTab() : tab === 'students' ? studentsTab() : tab === 'batches' ? batchesTab() : attendanceTab());
  };

  // ----- classes: today and the next 7 days -----
  const classesTab = () => {
    if (!sessions.length) return h('div', { class: 'p-card' }, h('h2', {}, 'No classes in the next 7 days'),
      h('p', { class: 'p-sub' }, students.length ? 'Add a batch to put classes on the calendar.' : 'Add your students first, then a batch.'));
    const out = [];
    let lastDay = '';
    for (const s of sessions) {
      const day = dayIST(s.startsAtMs);
      if (day !== lastDay) { out.push(h('p', { class: 'p-day' }, day)); lastDay = day; }
      out.push(sessionRow(s));
    }
    return h('div', { class: 'p-card' }, h('h2', {}, 'Today and the next 7 days'),
      h('p', { class: 'p-sub' }, 'Green: attended. Amber: said they can\u2019t attend. Red: missed. Tap a name to mark it yourself; a dot means you marked it.'), out);
  };

  const sessionRow = (s) => {
    const cancelled = s.status === 'cancelled';
    const err = h('p', { class: 'p-error' });
    const p = istParts(s.startsAtMs);
    const link = h('input', { type: 'url', value: s.link });
    const date = h('input', { type: 'date', value: p.date });
    const time = h('input', { type: 'time', value: p.time });
    return h('div', { class: 'p-row' + (cancelled ? ' cancelled' : ''), style: 'margin-top:10px' },
      h('div', { class: 'p-row-top' },
        h('b', {}, timeIST(s.startsAtMs) + ' – ' + timeIST(s.endsAtMs) + ' · ' + s.seriesName),
        cancelled ? h('span', { class: 'p-pill off' }, 'Cancelled') : isHttpsUrl(s.link) ? h('a', { href: s.link, target: '_blank', rel: 'noopener' }, 'Open link') : null),
      h('div', { class: 'p-names' }, s.studentIds.map((id) => {
        const st = studentStatus(s, id, Date.now());
        const cls = st === 'present' ? 'in' : st === 'informed' ? 'away' : st === 'absent' ? 'out' : '';
        return h('button', { type: 'button', class: cls, 'data-student': nameOf(id), title: 'Tap to mark attended or missed', onclick: () => flip(s, id).catch((e) => { err.textContent = friendly(e); }) },
          nameOf(id) + (s.attendance[id] ? ' \u2022' : ''));
      })),
      s.studentIds.filter((id) => s.absences[id] && !s.joins[id]).map((id) =>
        h('span', { class: 'p-sub p-away-note' }, nameOf(id) + ' can\u2019t attend' + (s.absences[id].reason ? ': ' + s.absences[id].reason : ''))),
      cancelled || s.endsAtMs <= Date.now() ? null : h('details', { class: 'p-more', 'data-remind': '' }, h('summary', {}, 'Remind on WhatsApp'),
        h('div', { class: 'p-stack' }, sendLines(s.studentIds, (st) => reminderMessage(st, s), 'remind'))),
      h('details', { class: 'p-more' }, h('summary', {}, 'Change this class'),
        h('div', { class: 'p-grid' },
          field('Date', date), field('Start time', time), field('Meeting link (this class only)', link, 'wide'),
          h('div', { class: 'p-actions wide' },
            action('Save', 'btn primary small', async () => {
              const patch = {};
              if (link.value.trim() !== s.link) patch.link = link.value;
              if (date.value !== p.date || time.value !== p.time) { patch.date = date.value; patch.time = time.value; }
              await api.updateSession(s, patch);
              await done('Class updated.');
            }, err),
            action(cancelled ? 'Put this class back' : 'Cancel this class', 'btn ghost small', async () => {
              await api.updateSession(s, { status: cancelled ? 'scheduled' : 'cancelled' });
              await done(cancelled ? 'Class is back on.' : 'Class cancelled. Students see it as cancelled.');
            }, err)),
          err)));
  };

  // ----- attendance: one month, classes that have ended -----
  const attendanceTab = () => {
    const monthIn = h('input', { type: 'month', id: 'att-month', value: att.month, onchange: (e) => { if (e.target.value) { att.month = e.target.value; att.sessions = null; draw(); loadAtt().catch(console.error); } } });
    const batchIn = h('select', { id: 'att-batch', onchange: (e) => { att.batch = e.target.value; draw(); } },
      h('option', { value: '' }, 'All batches'), series.map((b) => h('option', { value: b.id, selected: att.batch === b.id }, b.name)));
    const head = h('div', { class: 'p-grid' }, field('Month', monthIn), field('Batch', batchIn));
    if (!att.sessions) return h('div', { class: 'p-card' }, h('h2', {}, 'Attendance'), head, h('p', { class: 'p-loading', style: 'margin-top:14px' }, 'Loading…'));

    const now = Date.now();
    const list = att.sessions.filter((s) => !att.batch || s.seriesId === att.batch);
    const sum = attendanceSummary(list, now);
    const ids = Object.keys(sum).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    const fullName = (id) => { const st = students.find((x) => x.id === id); return st ? st.fullName : 'Removed student'; };
    const monthName = fmt({ month: 'long', year: 'numeric' }, 'UTC').format(new Date(att.month + '-15T00:00:00Z'));
    const dayShort = (ms) => fmt({ day: 'numeric', month: 'short' }, 'Asia/Kolkata').format(ms);
    if (!ids.length) return h('div', { class: 'p-card' }, h('h2', {}, 'Attendance'), head,
      h('p', { class: 'p-sub', style: 'margin-top:14px' }, 'No class has finished in ' + monthName + (att.batch ? ' for this batch' : '') + ' yet.'));

    const summaryText = (id) => {
      const r = sum[id];
      const missed = r.rows.filter((x) => x.status !== 'present').map((x) => dayShort(x.session.startsAtMs) + (x.status === 'informed' ? ' (told us)' : ''));
      return fullName(id) + ' \u2014 attendance for ' + monthName + ': attended ' + r.present + ' of ' + r.held + (r.held === 1 ? ' class' : ' classes') + ' (' + percent(r) + '%).'
        + (missed.length ? ' Missed: ' + missed.join(', ') + '.' : '');
    };
    const csv = () => {
      const cell = (v) => { const t = String(v); return '"' + (/^[=+\-@]/.test(t) ? "'" : '') + t.replace(/"/g, '""') + '"'; };
      const lines = [['Student', 'Classes held', 'Attended', 'Told us', 'Missed without notice', 'Percent'].map(cell).join(',')];
      for (const id of ids) { const r = sum[id]; lines.push([fullName(id), r.held, r.present, r.informed, r.absent, percent(r)].map(cell).join(',')); }
      const a = h('a', { href: URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' })), download: 'attendance-' + att.month + '.csv' });
      document.body.append(a); a.click(); a.remove();
    };
    const err = h('p', { class: 'p-error' });
    return [
      h('div', { class: 'p-card' }, h('h2', {}, 'Attendance'), head,
        h('div', { class: 'p-scroll' }, h('table', { class: 'p-table', id: 'att-table' },
          h('thead', {}, h('tr', {}, ['Student', 'Held', 'Attended', 'Told us', 'No notice', '%'].map((t) => h('th', {}, t)))),
          h('tbody', {}, ids.map((id) => { const r = sum[id]; return h('tr', { 'data-student': nameOf(id) },
            h('td', {}, fullName(id)), h('td', {}, String(r.held)), h('td', {}, String(r.present)), h('td', {}, String(r.informed)), h('td', {}, String(r.absent)), h('td', {}, percent(r) + '%')); })))),
        h('p', { class: 'p-sub', style: 'margin-top:10px' }, 'Counts classes that have finished. Cancelled classes are left out.'),
        h('div', { class: 'p-actions', style: 'margin-top:12px' }, h('button', { type: 'button', class: 'btn ghost small', id: 'att-csv', onclick: csv }, 'Download as a spreadsheet'))),
      h('div', { class: 'p-card' }, h('h2', {}, 'Class by class'),
        h('p', { class: 'p-sub' }, 'Open a student to see each class and correct it.'), err,
        ids.map((id) => { const copied = h('span', { class: 'p-ok' }); return h('details', { class: 'p-more p-att', 'data-student': nameOf(id) },
          h('summary', {}, fullName(id) + ' \u00b7 ' + sum[id].present + ' of ' + sum[id].held),
          h('ul', { class: 'p-rows' }, sum[id].rows.map(({ session: s, status }) => h('li', { class: 'p-row' },
            h('div', { class: 'p-row-top' }, h('b', {}, dayShort(s.startsAtMs) + ' \u00b7 ' + timeIST(s.startsAtMs) + ' \u00b7 ' + s.seriesName),
              h('span', { class: 'p-pill' + STATUS[status][1] }, STATUS[status][0] + (s.attendance[id] ? ' \u2022' : ''))),
            s.absences[id] && s.absences[id].reason ? h('span', { class: 'p-sub' }, 'Reason given: ' + s.absences[id].reason) : null,
            h('div', { class: 'p-actions' }, [['present', 'Mark attended'], ['absent', 'Mark missed'], [null, 'Automatic']].filter(([v]) => (s.attendance[id] || null) !== v).map(([v, label]) =>
              action(label, 'p-link', async () => { await api.markAttendance(s, id, v); if (v) s.attendance[id] = v; else delete s.attendance[id]; draw(); }, err)))))),
          h('div', { class: 'p-actions', style: 'margin-top:10px' },
            action('Copy summary for WhatsApp', 'p-link', async () => { await navigator.clipboard.writeText(summaryText(id)); copied.textContent = 'Copied'; }, err), copied),
          h('p', { class: 'p-sub p-summary', style: 'margin-top:6px' }, summaryText(id))); })),
    ];
  };

  // ----- students -----
  const studentsTab = () => {
    const full = h('input', { type: 'text', name: 'fullName', required: true, autocomplete: 'off' });
    const nick = h('input', { type: 'text', name: 'nickname', required: true, autocomplete: 'off', maxlength: '20' });
    const mobile = h('input', { type: 'tel', name: 'mobile', autocomplete: 'off' });
    const email = h('input', { type: 'email', name: 'email', autocomplete: 'off' });
    const err = h('p', { class: 'p-error wide' });
    const add = action('Add student', 'btn primary', async () => {
      if (!full.value.trim() || !nick.value.trim()) throw Object.assign(new Error('Fill in the full name and the nickname.'), { code: 'portal/invalid' });
      const s = await api.addStudent({ fullName: full.value, nickname: nick.value, mobile: mobile.value, email: email.value });
      await done('Added ' + s.nickname + '. Access code: ' + s.accessCode);
    }, err);
    return [
      h('div', { class: 'p-card' }, h('h2', {}, 'Add a student'),
        h('p', { class: 'p-sub', style: 'margin-bottom:14px' }, 'The access code is made for you. Send it to the parent on WhatsApp.'),
        h('div', { class: 'p-grid', id: 'add-student' },
          field('Full name', full), field('Nickname (shown to the child, starts the code)', nick),
          field('Parent WhatsApp number (optional)', mobile), field('Parent email (optional)', email),
          h('div', { class: 'wide' }, add), err)),
      h('div', { class: 'p-card' }, h('h2', {}, 'Students'),
        students.length ? h('ul', { class: 'p-rows' }, students.map(studentCard)) : h('p', { class: 'p-sub' }, 'No students yet.')),
    ];
  };

  const studentCard = (s) => {
    const err = h('p', { class: 'p-error' });
    const copied = h('span', { class: 'p-ok' });
    return h('li', { class: 'p-row' + (s.active ? '' : ' cancelled') },
      h('div', { class: 'p-row-top' }, h('b', {}, s.fullName + ' (' + s.nickname + ')'), s.active ? null : h('span', { class: 'p-pill off' }, 'Paused')),
      (s.mobile || s.email) ? h('span', { class: 'p-sub' }, [s.mobile, s.email].filter(Boolean).join(' · ')) : null,
      h('div', { class: 'p-actions' },
        h('span', { class: 'p-codebox' }, s.accessCode),
        action('Copy', 'p-link', async () => { await navigator.clipboard.writeText(s.accessCode); copied.textContent = 'Copied'; }, err),
        action('New code', 'p-link', async () => { const c = await api.regenerateCode(s); await done('New code for ' + s.nickname + ': ' + c + '. The old code no longer works.'); }, err),
        action(s.active ? 'Pause login' : 'Turn login back on', 'p-link' + (s.active ? ' p-danger' : ''), async () => {
          await api.setStudentActive(s.id, !s.active);
          await done(s.active ? s.nickname + ' can no longer see classes.' : s.nickname + ' can sign in again.');
        }, err),
        copied),
      h('details', { class: 'p-more' }, h('summary', {}, 'Change WhatsApp number or email'), (() => {
        const m = h('input', { type: 'tel', value: s.mobile || '', autocomplete: 'off' });
        const e = h('input', { type: 'email', value: s.email || '', autocomplete: 'off' });
        return h('div', { class: 'p-grid' }, field('Parent WhatsApp number', m), field('Parent email', e),
          h('p', { class: 'p-sub wide' }, 'Ten digits are read as an Indian number. For other countries start with the country code, for example +971…'),
          h('div', { class: 'wide' }, action('Save', 'btn primary small', async () => {
            await api.updateStudentContact(s.id, { mobile: m.value, email: e.value });
            await done('Contact saved for ' + s.nickname + '.');
          }, err)));
      })()),
      err);
  };

  // ----- batches -----
  const studentChecks = (picked) => h('div', { class: 'p-checks' },
    students.filter((s) => s.active || picked.includes(s.id)).map((s) =>
      h('label', {}, h('input', { type: 'checkbox', name: 'student', value: s.id, checked: picked.includes(s.id) }), s.nickname)));
  const checked = (box, name) => [...box.querySelectorAll('input[name="' + name + '"]:checked')].map((i) => i.value);

  const batchesTab = () => {
    const today = istParts(Date.now()).date;
    const name = h('input', { type: 'text', name: 'name', required: true, autocomplete: 'off', placeholder: 'Beginners, Mon and Thu' });
    const who = studentChecks([]);
    const days = h('div', { class: 'p-checks' }, WEEKDAYS.map((d, i) => h('label', {}, h('input', { type: 'checkbox', name: 'day', value: String(i) }), d)));
    const time = h('input', { type: 'time', name: 'time', value: '17:00', required: true });
    const mins = h('input', { type: 'number', name: 'mins', value: '50', min: '10', max: '240', required: true });
    const date = h('input', { type: 'date', name: 'date', value: today, required: true });
    const weeks = h('input', { type: 'number', name: 'weeks', value: '12', min: '1', max: '26', required: true });
    const link = h('input', { type: 'url', name: 'link', placeholder: 'https://meet.google.com/… or https://zoom.us/j/…', required: true });
    const err = h('p', { class: 'p-error wide' });
    const add = action('Create batch', 'btn primary', async () => {
      const r = await api.addSeries({ name: name.value, studentIds: checked(who, 'student'), weekdays: checked(days, 'day'),
        startTime: time.value, durationMin: Number(mins.value), startDate: date.value, weeks: Number(weeks.value), link: link.value });
      await done('Batch created with ' + r.sessions + ' classes. Send the class details to each parent from the batch below.');
    }, err);
    return [
      h('div', { class: 'p-card' }, h('h2', {}, 'Add a batch'),
        h('p', { class: 'p-sub', style: 'margin-bottom:14px' }, 'One meeting link for the whole batch. Every class in it uses that link.'),
        students.some((s) => s.active) ? h('div', { class: 'p-grid', id: 'add-batch' },
          field('Batch name', name, 'wide'),
          h('div', { class: 'p-field wide' }, h('span', { class: 'p-legend' }, 'Students'), who),
          h('div', { class: 'p-field wide' }, h('span', { class: 'p-legend' }, 'Days of the week'), days),
          field('Start time (India)', time), field('Class length in minutes', mins),
          field('First class on or after', date), field('How many weeks', weeks),
          field('Meeting link', link, 'wide'),
          h('div', { class: 'wide' }, add), err)
          : h('p', { class: 'p-sub' }, 'Add your students first.')),
      h('div', { class: 'p-card' }, h('h2', {}, 'Batches'),
        series.length ? h('ul', { class: 'p-rows' }, series.map(batchCard)) : h('p', { class: 'p-sub' }, 'No batches yet.')),
    ];
  };

  const batchCard = (b) => {
    const err = h('p', { class: 'p-error' });
    const who = studentChecks(b.studentIds);
    const link = h('input', { type: 'url', value: b.link });
    let armed = false;
    return h('li', { class: 'p-row' },
      h('div', { class: 'p-row-top' }, h('b', {}, b.name),
        h('span', { class: 'p-time' }, b.weekdays.map((d) => WEEKDAYS[d]).join(' · ') + ' · ' + b.startTime + ' · ' + b.durationMin + ' min')),
      h('div', { class: 'p-field' }, h('span', { class: 'p-legend' }, 'Send class details and login on WhatsApp'),
        sendLines(b.studentIds, (st) => welcomeMessage(st, b, Date.now()), 'welcome')),
      h('span', { class: 'p-url' }, b.link),
      h('details', { class: 'p-more' }, h('summary', {}, 'Change this batch'),
        h('div', { class: 'p-stack' },
          h('div', { class: 'p-field' }, h('span', { class: 'p-legend' }, 'Students'), who),
          field('Meeting link (all classes that have not started)', link),
          h('div', { class: 'p-actions' },
            action('Save', 'btn primary small', async () => {
              const n = await api.updateSeries(b, { studentIds: checked(who, 'student'), link: link.value });
              await done('Batch saved. ' + n + ' coming classes updated.');
            }, err),
            action('Add 12 more weeks', 'btn ghost small', async () => {
              const n = await api.extendSeries(b, 12);
              await done(n + ' classes added to ' + b.name + '.');
            }, err),
            action('Delete batch', 'p-link p-danger', async (btn) => {
              if (!armed) { armed = true; btn.textContent = 'Press again to delete this batch and its coming classes'; return; }
              const n = await api.deleteSeries(b);
              await done(b.name + ' deleted, with ' + n + ' coming classes. Past classes are kept.');
            }, err)),
          err)));
  };

  show(h('p', { class: 'p-loading' }, 'Loading…'));
  try { await reload(); } catch (e) { console.error(e); show(h('p', { class: 'p-error' }, friendly(e))); }
}

start();
