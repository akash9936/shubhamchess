// Edge cases for the pure helpers in site/app/core.js. No emulator needed:
//   cd firebase && node --test tests/core.edge.test.mjs
// The happy paths are in portal.test.mjs; this file covers boundaries and odd inputs.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../../site/app/core.js';

const MIN = 60000;
const HOUR = 60 * MIN;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const iso = (ms) => new Date(ms).toISOString();

// A class as the data layer hands it over (toSession fills the three maps).
function makeSession(overrides = {}) {
  return {
    startsAtMs: 100 * HOUR, endsAtMs: 101 * HOUR, status: 'scheduled',
    studentIds: ['u1'], joins: {}, absences: {}, attendance: {}, ...overrides,
  };
}

function makeSeries(overrides = {}) {
  return {
    name: 'Beginners', studentIds: ['u1'], weekdays: [1], startDate: '2026-11-16',
    startTime: '17:00', durationMin: 50, weeks: 4, link: 'https://meet.example/a', ...overrides,
  };
}

// ---------- access codes ----------

describe('slugNick', () => {
  test('keeps only Latin letters and digits, upper-cased', () => {
    assert.equal(core.slugNick("Aarav K. O'Neil-2"), 'AARAVKONEI');
    assert.equal(core.slugNick('r2d2'), 'R2D2');
  });

  test('caps the result at 10 characters', () => {
    assert.equal(core.slugNick('Bartholomew Montgomery'), 'BARTHOLOME');
  });

  test('falls back to STUDENT when nothing usable is left', () => {
    for (const nick of ['आरव', '李小龙', '!!! ...', '', '   ', null, undefined]) assert.equal(core.slugNick(nick), 'STUDENT', String(nick));
  });

  test('drops accented letters rather than failing', () => {
    assert.equal(core.slugNick('José'), 'JOS');
  });

  test('accepts a number as the nickname', () => {
    assert.equal(core.slugNick(42), '42');
  });
});

describe('makeLoginId', () => {
  test('is the lower-case slug when the name is free', () => {
    assert.equal(core.makeLoginId('Diya R.'), 'diyar');
    assert.equal(core.makeLoginId('Diya', new Set(['aarav'])), 'diya');
  });

  test('takes the first free number from 2 upwards, filling gaps', () => {
    assert.equal(core.makeLoginId('Diya', new Set(['diya'])), 'diya2');
    assert.equal(core.makeLoginId('Diya', new Set(['diya', 'diya3'])), 'diya2');
    assert.equal(core.makeLoginId('Diya', new Set(['diya', 'diya2', 'diya3'])), 'diya4');
  });

  test('two nicknames that slug the same collide on one base', () => {
    assert.equal(core.makeLoginId('Diya!', new Set([core.makeLoginId('diya')])), 'diya2');
  });

  test('non-Latin names share the "student" base and get numbered', () => {
    assert.equal(core.makeLoginId('आरव'), 'student');
    assert.equal(core.makeLoginId('李', new Set(['student'])), 'student2');
  });

  test('a long name keeps a 10-character base and still parses back as a code', () => {
    const taken = new Set(['bartholome', ...Array.from({ length: 98 }, (_, i) => 'bartholome' + (i + 2))]);
    const id = core.makeLoginId('Bartholomew', taken);
    assert.equal(id, 'bartholome100');
    assert.equal(core.parseCode(core.makeCode(id)).loginId, id);
  });

  test('gives up with an error once 2..999 are all taken', () => {
    const taken = new Set(['x', ...Array.from({ length: 998 }, (_, i) => 'x' + (i + 2))]);
    assert.throws(() => core.makeLoginId('x', taken), /No free sign-in name/);
  });
});

describe('randomPart and makeCode', () => {
  test('randomPart has the requested length and uses only the unambiguous alphabet', () => {
    for (const len of [1, 4, 8, 32]) {
      const part = core.randomPart(len);
      assert.equal(part.length, len);
      for (const ch of part) assert.ok(ALPHABET.includes(ch), `unexpected ${ch}`);
    }
    assert.equal(core.randomPart().length, 4);
    assert.equal(core.randomPart(0), '');
  });

  test('randomPart never produces I, L, O, 0 or 1 over many draws', () => {
    const many = Array.from({ length: 500 }, () => core.randomPart(8)).join('');
    assert.doesNotMatch(many, /[ILO01]/);
    assert.ok(new Set(many).size > 20, 'draws spread over the alphabet');
  });

  test('makeCode is the upper-case sign-in name, a dash, and 4 random characters', () => {
    assert.match(core.makeCode('diya2'), /^DIYA2-[A-HJKMNP-Z2-9]{4}$/);
  });

  test('two codes for the same name differ (random part changes)', () => {
    const codes = new Set(Array.from({ length: 20 }, () => core.makeCode('diya')));
    assert.ok(codes.size > 1);
  });

  test('every generated code parses back to the same account', () => {
    for (const nick of ['Aarav', 'आरव', 'Bartholomew Montgomery', 'r2']) {
      const id = core.makeLoginId(nick);
      const code = core.makeCode(id);
      assert.deepEqual(core.parseCode(code), { loginId: id, email: core.studentEmail(id), password: code });
    }
  });
});

describe('studentEmail', () => {
  test('lower-cases the sign-in name and adds the student domain', () => {
    assert.equal(core.studentEmail('DIYA2'), 'diya2@students.local');
  });
});

describe('parseCode', () => {
  test('ignores case and every kind of whitespace, inside the code too', () => {
    const want = { loginId: 'aarav', email: 'aarav@students.local', password: 'AARAV-7K3Q' };
    for (const typed of ['aarav-7k3q', ' AARAV - 7K3Q ', 'aa rav-7k 3q', '\tAARAV-7K3Q\n', 'AARAV -7K3Q']) {
      assert.deepEqual(core.parseCode(typed), want, JSON.stringify(typed));
    }
  });

  test('accepts an en dash or em dash in place of the hyphen (phone keyboards)', () => {
    assert.equal(core.parseCode('AARAV–7K3Q').password, 'AARAV-7K3Q');
    assert.equal(core.parseCode('AARAV—7K3Q').password, 'AARAV-7K3Q');
  });

  test('sign-in name may be 1 to 14 characters', () => {
    assert.equal(core.parseCode('A-AAAA').loginId, 'a');
    assert.equal(core.parseCode('ABCDEFGHIJKLMN-AAAA').loginId, 'abcdefghijklmn');
    assert.equal(core.parseCode('ABCDEFGHIJKLMNO-AAAA'), null);
  });

  test('random part may be 4 to 8 characters', () => {
    assert.equal(core.parseCode('AARAV-AAA'), null);
    assert.ok(core.parseCode('AARAV-AAAA'));
    assert.ok(core.parseCode('AARAV-AAAAAAAA'));
    assert.equal(core.parseCode('AARAV-AAAAAAAAA'), null);
  });

  test('refuses codes with no dash, two dashes, or other punctuation', () => {
    for (const bad of ['AARAV7K3Q', 'AARAV--7K3Q', 'AA-RAV-7K3Q', '-7K3Q', 'AARAV-', 'AARAV_7K3Q', 'AARAV.-7K3Q', 'AARAV-7K3Q!']) {
      assert.equal(core.parseCode(bad), null, bad);
    }
  });

  test('refuses non-Latin characters', () => {
    assert.equal(core.parseCode('आरव-7K3Q'), null);
  });

  test('refuses empty and non-string input without throwing', () => {
    for (const bad of ['', '   ', null, undefined, 0, {}, []]) assert.equal(core.parseCode(bad), null, String(bad));
  });

  test('a number-only code still parses (digits are allowed on both sides)', () => {
    assert.equal(core.parseCode('42-2345').loginId, '42');
  });
});

describe('coachEmail', () => {
  test('a plain ID of 3 to 30 allowed characters gets the coach domain', () => {
    assert.equal(core.coachEmail('abc'), 'abc@coach.local');
    assert.equal(core.coachEmail('a'.repeat(30)), 'a'.repeat(30) + '@coach.local');
    assert.equal(core.coachEmail('Coach_1-x.y'), 'coach_1-x.y@coach.local');
  });

  test('a plain ID that is too short, too long, or has other characters is refused', () => {
    for (const bad of ['ab', 'a'.repeat(31), 'coach!', 'coach one', 'कोच', 'coach+1']) assert.equal(core.coachEmail(bad), null, bad);
  });

  test('a full email is lower-cased, trimmed and used as typed', () => {
    assert.equal(core.coachEmail('  Shubham.Coach+Desk@Example.CO.in '), 'shubham.coach+desk@example.co.in');
  });

  test('a badly shaped email is refused', () => {
    for (const bad of ['@example.com', 'coach@', 'coach@example', 'co ach@example.com', 'coach@@example.com', 'a@b@c.com']) {
      assert.equal(core.coachEmail(bad), null, bad);
    }
  });

  test('empty and non-string input is refused without throwing', () => {
    for (const bad of ['', '   ', null, undefined]) assert.equal(core.coachEmail(bad), null);
  });
});

// ---------- time ----------

describe('istToUtcMs', () => {
  test('midnight India time is 18:30 UTC the day before', () => {
    assert.equal(iso(core.istToUtcMs('2026-11-16', '00:00')), '2026-11-15T18:30:00.000Z');
  });

  test('05:30 India time is exactly UTC midnight', () => {
    assert.equal(iso(core.istToUtcMs('2026-11-16', '05:30')), '2026-11-16T00:00:00.000Z');
  });

  test('just after India midnight on 1 January is still 31 December in UTC', () => {
    assert.equal(iso(core.istToUtcMs('2027-01-01', '00:15')), '2026-12-31T18:45:00.000Z');
  });

  test('leap day converts normally', () => {
    assert.equal(iso(core.istToUtcMs('2028-02-29', '23:59')), '2028-02-29T18:29:00.000Z');
  });

  test('accepts a one-digit hour', () => {
    assert.equal(core.istToUtcMs('2026-11-16', '7:05'), core.istToUtcMs('2026-11-16', '07:05'));
  });

  test('wrongly shaped or missing strings give NaN', () => {
    const bad = [['2026-11-16', '7:5'], ['2026-11-16', '17:00:00'], ['2026-11-16', '5pm'], ['16-11-2026', '17:00'],
      ['2026/11/16', '17:00'], ['2026-1-16', '17:00'], ['', '17:00'], ['2026-11-16', ''], [undefined, undefined], [null, null]];
    for (const [d, t] of bad) assert.ok(Number.isNaN(core.istToUtcMs(d, t)), `${d} ${t}`);
  });

  test('impossible calendar dates and clock times are refused', { todo: 'istToUtcMs checks only the shape: 2026-02-30 rolls over to 2 March and 24:00 / 17:60 are accepted' }, () => {
    for (const [d, t] of [['2026-02-30', '10:00'], ['2027-02-29', '10:00'], ['2026-13-01', '10:00'], ['2026-11-00', '10:00'],
      ['2026-11-16', '24:00'], ['2026-11-16', '17:60']]) {
      assert.ok(Number.isNaN(core.istToUtcMs(d, t)), `${d} ${t}`);
    }
  });
});

describe('istParts', () => {
  test('reads the India date, time and weekday from a UTC instant', () => {
    // 2026-11-15T18:30Z is Monday 16 Nov 00:00 in India
    assert.deepEqual(core.istParts(Date.parse('2026-11-15T18:30:00Z')), { date: '2026-11-16', time: '00:00', weekday: 1 });
    // one millisecond earlier is still Sunday in India
    assert.deepEqual(core.istParts(Date.parse('2026-11-15T18:30:00Z') - 1), { date: '2026-11-15', time: '23:59', weekday: 0 });
  });

  test('rolls over the year in India before UTC does', () => {
    assert.deepEqual(core.istParts(Date.parse('2026-12-31T18:30:00Z')), { date: '2027-01-01', time: '00:00', weekday: 5 });
  });

  test('is the inverse of istToUtcMs for every half hour of a day', () => {
    for (let h = 0; h < 24; h++) for (const m of ['00', '30']) {
      const time = String(h).padStart(2, '0') + ':' + m;
      assert.equal(core.istParts(core.istToUtcMs('2028-02-29', time)).time, time);
      assert.equal(core.istParts(core.istToUtcMs('2028-02-29', time)).date, '2028-02-29');
    }
  });
});

describe('addDays', () => {
  test('rolls over month and year ends', () => {
    assert.equal(core.addDays('2026-01-31', 1), '2026-02-01');
    assert.equal(core.addDays('2026-12-31', 1), '2027-01-01');
    assert.equal(core.addDays('2027-01-01', -1), '2026-12-31');
  });

  test('knows leap years', () => {
    assert.equal(core.addDays('2028-02-28', 1), '2028-02-29');
    assert.equal(core.addDays('2027-02-28', 1), '2027-03-01');
    assert.equal(core.addDays('2100-02-28', 1), '2100-03-01', '2100 is not a leap year');
  });

  test('adding zero returns the same date; large steps work', () => {
    assert.equal(core.addDays('2026-11-16', 0), '2026-11-16');
    assert.equal(core.addDays('2026-11-16', 26 * 7), '2027-05-17');
  });

  test('a garbage date throws rather than returning a wrong date', () => {
    assert.throws(() => core.addDays('not-a-date', 1));
  });
});

describe('expandSeries', () => {
  const dates = (slots) => slots.map((s) => core.istParts(s.startsAtMs).date);

  test('a single weekday for 1 week gives one class on that day', () => {
    const slots = core.expandSeries({ startDate: '2026-11-16', weekdays: [3], startTime: '17:00', durationMin: 50, weeks: 1 });
    assert.deepEqual(dates(slots), ['2026-11-18']);
  });

  test('all seven weekdays for 1 week gives seven consecutive days from the start date', () => {
    const slots = core.expandSeries({ startDate: '2026-11-18', weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '17:00', durationMin: 50, weeks: 1 });
    assert.deepEqual(dates(slots), ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24']);
  });

  test('26 weeks of one weekday gives 26 classes exactly 7 days apart', () => {
    const slots = core.expandSeries({ startDate: '2026-11-16', weekdays: [1], startTime: '17:00', durationMin: 60, weeks: 26 });
    assert.equal(slots.length, 26);
    for (let i = 1; i < slots.length; i++) assert.equal(slots[i].startsAtMs - slots[i - 1].startsAtMs, 7 * 24 * HOUR);
  });

  test('starting mid-week, the window is weeks*7 days from the start date, not calendar weeks', () => {
    // Wed 18 Nov, Mon+Thu, 2 weeks: Thu 19, Mon 23, Thu 26, Mon 30
    const slots = core.expandSeries({ startDate: '2026-11-18', weekdays: [1, 4], startTime: '17:00', durationMin: 50, weeks: 2 });
    assert.deepEqual(dates(slots), ['2026-11-19', '2026-11-23', '2026-11-26', '2026-11-30']);
  });

  test('crosses the year boundary without losing or doubling a day', () => {
    const slots = core.expandSeries({ startDate: '2026-12-28', weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: '10:00', durationMin: 30, weeks: 1 });
    assert.deepEqual(dates(slots), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
  });

  test('a class just after India midnight lands on the India weekday even though the UTC date is the day before', () => {
    // Mon 16 Nov 00:30 IST = Sun 15 Nov 19:00 UTC
    const [slot] = core.expandSeries({ startDate: '2026-11-16', weekdays: [1], startTime: '00:30', durationMin: 45, weeks: 1 });
    assert.equal(iso(slot.startsAtMs), '2026-11-15T19:00:00.000Z');
    assert.deepEqual(core.istParts(slot.startsAtMs), { date: '2026-11-16', time: '00:30', weekday: 1 });
  });

  test('weekdays given as strings work like numbers', () => {
    const asStrings = core.expandSeries({ startDate: '2026-11-16', weekdays: ['1', '4'], startTime: '17:00', durationMin: 50, weeks: 2 });
    const asNumbers = core.expandSeries({ startDate: '2026-11-16', weekdays: [1, 4], startTime: '17:00', durationMin: 50, weeks: 2 });
    assert.deepEqual(asStrings, asNumbers);
    assert.equal(asStrings.length, 4);
  });

  test('every class is exactly durationMin long and they come in time order', () => {
    const slots = core.expandSeries({ startDate: '2026-11-16', weekdays: [6, 2], startTime: '18:15', durationMin: 75, weeks: 3 });
    assert.ok(slots.every((s) => s.endsAtMs - s.startsAtMs === 75 * MIN));
    assert.ok(slots.every((s, i) => i === 0 || s.startsAtMs > slots[i - 1].startsAtMs));
  });

  test('a weekday that does not exist or zero weeks gives no classes', () => {
    assert.deepEqual(core.expandSeries({ startDate: '2026-11-16', weekdays: [7], startTime: '17:00', durationMin: 50, weeks: 4 }), []);
    assert.deepEqual(core.expandSeries({ startDate: '2026-11-16', weekdays: [1], startTime: '17:00', durationMin: 50, weeks: 0 }), []);
  });

  test('includes the leap day when it falls on a chosen weekday', () => {
    // 29 Feb 2028 is a Tuesday
    const slots = core.expandSeries({ startDate: '2028-02-27', weekdays: [2], startTime: '17:00', durationMin: 50, weeks: 1 });
    assert.deepEqual(dates(slots), ['2028-02-29']);
  });
});

describe('validateSeries', () => {
  test('a complete batch passes', () => {
    assert.equal(core.validateSeries(makeSeries()), null);
  });

  test('a missing or blank name is reported first', () => {
    for (const name of [undefined, '', '   ']) assert.match(core.validateSeries(makeSeries({ name, studentIds: [] })), /name/);
  });

  test('no students is refused', () => {
    assert.match(core.validateSeries(makeSeries({ studentIds: [] })), /student/);
    assert.match(core.validateSeries(makeSeries({ studentIds: undefined })), /student/);
  });

  test('no weekdays is refused', () => {
    assert.match(core.validateSeries(makeSeries({ weekdays: [] })), /day of the week/);
    assert.match(core.validateSeries(makeSeries({ weekdays: undefined })), /day of the week/);
  });

  test('a missing or malformed start date or time is refused', () => {
    assert.match(core.validateSeries(makeSeries({ startDate: '' })), /start date/);
    assert.match(core.validateSeries(makeSeries({ startTime: '5pm' })), /start date/);
  });

  test('class length must be 10 to 240 minutes inclusive', () => {
    for (const ok of [10, 240, '50']) assert.equal(core.validateSeries(makeSeries({ durationMin: ok })), null, String(ok));
    for (const bad of [9, 241, 0, -50, NaN, undefined, 'fifty']) assert.match(core.validateSeries(makeSeries({ durationMin: bad })), /Class length/, String(bad));
  });

  test('weeks must be 1 to 26 inclusive', () => {
    for (const ok of [1, 26, '12']) assert.equal(core.validateSeries(makeSeries({ weeks: ok })), null, String(ok));
    for (const bad of [0, 27, -1, NaN, undefined]) assert.match(core.validateSeries(makeSeries({ weeks: bad })), /Weeks/, String(bad));
  });

  test('the meeting link must be https', () => {
    for (const bad of ['http://meet.example/a', 'meet.example/a', 'ftp://x.y', '', undefined]) {
      assert.match(core.validateSeries(makeSeries({ link: bad })), /https/, String(bad));
    }
  });

  test('an impossible start date is refused', { todo: 'validateSeries relies on istToUtcMs, which accepts 2026-02-30 (rolls over to 2 March)' }, () => {
    assert.match(core.validateSeries(makeSeries({ startDate: '2026-02-30' })) || '', /start date/);
  });
});

describe('isHttpsUrl', () => {
  test('accepts https in any letter case', () => {
    assert.equal(core.isHttpsUrl('HTTPS://Zoom.us/j/123'), true);
    assert.equal(core.isHttpsUrl('https://meet.google.com/abc-defg-hij?pwd=1#x'), true);
  });

  test('refuses other schemes and things that are not URLs', () => {
    for (const bad of ['https://', 'data:text/html,hi', 'mailto:a@b.c', '//meet.example', 'https ://x.y', undefined, 123, {}]) {
      assert.equal(core.isHttpsUrl(bad), false, String(bad));
    }
  });
});

// ---------- join window and the 2-hour cut-off ----------

describe('joinState', () => {
  const s = makeSession({ startsAtMs: 10 * HOUR, endsAtMs: 11 * HOUR });

  test('a class in progress is open; at the exact start too', () => {
    assert.equal(core.joinState(s, 10 * HOUR), 'open');
    assert.equal(core.joinState(s, 10.5 * HOUR), 'open');
  });

  test('one millisecond before the join window is still upcoming', () => {
    assert.equal(core.joinState(s, 10 * HOUR - 10 * MIN - 1), 'upcoming');
  });

  test('a long-finished class is over', () => {
    assert.equal(core.joinState(s, 100 * HOUR), 'over');
  });

  test('a cancelled class stays cancelled before, during and after its time', () => {
    for (const now of [0, 10 * HOUR, 100 * HOUR]) assert.equal(core.joinState({ ...s, status: 'cancelled' }, now), 'cancelled');
  });

  test('a class marked done is treated by time, like a scheduled one', () => {
    assert.equal(core.joinState({ ...s, status: 'done' }, 10 * HOUR), 'open');
  });
});

describe('canCancel', () => {
  // class at 17:00 → "can't attend" allowed up to 14:59:59.999, closed from 15:00
  const s = makeSession({ startsAtMs: 17 * HOUR, endsAtMs: 18 * HOUR });

  test('allowed one millisecond before the 2-hour mark, refused exactly at it', () => {
    assert.equal(core.canCancel(s, 15 * HOUR - 1), true);
    assert.equal(core.canCancel(s, 15 * HOUR), false);
  });

  test('allowed well ahead; refused inside the 2 hours, during and after the class', () => {
    assert.equal(core.canCancel(s, 0), true);
    for (const now of [16 * HOUR, 17 * HOUR, 17.5 * HOUR, 20 * HOUR]) assert.equal(core.canCancel(s, now), false, String(now));
  });

  test('never allowed for a cancelled class, even days ahead', () => {
    assert.equal(core.canCancel({ ...s, status: 'cancelled' }, 0), false);
  });

  test('the cut-off is 120 minutes', () => {
    assert.equal(core.CANCEL_CUTOFF_MIN, 120);
  });
});

// ---------- attendance ----------

describe('studentStatus', () => {
  const before = 50 * HOUR, after = 200 * HOUR;

  test('a cancelled class is cancelled whatever else is recorded', () => {
    const s = makeSession({ status: 'cancelled', attendance: { u1: 'present' }, joins: { u1: 1 }, absences: { u1: {} } });
    assert.equal(core.studentStatus(s, 'u1', before), 'cancelled');
    assert.equal(core.studentStatus(s, 'u1', after), 'cancelled');
  });

  test("the coach's mark beats a Join press and a can't-attend note", () => {
    assert.equal(core.studentStatus(makeSession({ attendance: { u1: 'absent' }, joins: { u1: 1 }, absences: { u1: {} } }), 'u1', after), 'absent');
    assert.equal(core.studentStatus(makeSession({ attendance: { u1: 'present' }, absences: { u1: {} } }), 'u1', after), 'present');
  });

  test("the coach's mark counts even before the class has ended", () => {
    assert.equal(core.studentStatus(makeSession({ attendance: { u1: 'absent' } }), 'u1', before), 'absent');
  });

  test('a mark that is not present/absent is ignored', () => {
    assert.equal(core.studentStatus(makeSession({ attendance: { u1: 'late' } }), 'u1', after), 'absent');
    assert.equal(core.studentStatus(makeSession({ attendance: { u1: 'late' }, joins: { u1: 1 } }), 'u1', after), 'present');
  });

  test("a Join press beats a can't-attend note", () => {
    assert.equal(core.studentStatus(makeSession({ joins: { u1: 1 }, absences: { u1: { reason: 'x' } } }), 'u1', before), 'present');
  });

  test("a can't-attend note gives informed both before and after the class", () => {
    const s = makeSession({ absences: { u1: { reason: '' } } });
    assert.equal(core.studentStatus(s, 'u1', before), 'informed');
    assert.equal(core.studentStatus(s, 'u1', after), 'informed');
  });

  test('nothing recorded: upcoming until the end, absent from the exact end', () => {
    const s = makeSession();
    assert.equal(core.studentStatus(s, 'u1', s.endsAtMs - 1), 'upcoming');
    assert.equal(core.studentStatus(s, 'u1', s.endsAtMs), 'absent');
  });

  test('missing joins/absences/attendance maps are treated as empty', () => {
    const bare = { startsAtMs: 100 * HOUR, endsAtMs: 101 * HOUR, status: 'scheduled', studentIds: ['u1'] };
    assert.equal(core.studentStatus(bare, 'u1', before), 'upcoming');
    assert.equal(core.studentStatus(bare, 'u1', after), 'absent');
  });

  test("another student's records do not leak onto this one", () => {
    const s = makeSession({ studentIds: ['u1', 'u2'], joins: { u2: 1 }, absences: { u2: {} }, attendance: { u2: 'present' } });
    assert.equal(core.studentStatus(s, 'u1', after), 'absent');
  });

  test('a null entry in a map counts as nothing recorded', () => {
    assert.equal(core.studentStatus(makeSession({ joins: { u1: null }, absences: { u1: null } }), 'u1', after), 'absent');
  });
});

describe('attendanceSummary', () => {
  const now = 1000 * HOUR;
  const at = (h, extra = {}) => makeSession({ startsAtMs: h * HOUR, endsAtMs: (h + 1) * HOUR, ...extra });

  test('no classes gives an empty summary', () => {
    assert.deepEqual(core.attendanceSummary([], now), {});
  });

  test('cancelled classes are not counted at all', () => {
    assert.deepEqual(core.attendanceSummary([at(1, { status: 'cancelled' })], now), {});
  });

  test('a class still running or in the future is not counted; one that ended exactly now is', () => {
    const running = makeSession({ startsAtMs: now - HOUR / 2, endsAtMs: now + 1 });
    const justEnded = makeSession({ startsAtMs: now - HOUR, endsAtMs: now });
    const sum = core.attendanceSummary([running, at(2000), justEnded], now);
    assert.equal(sum.u1.held, 1);
    assert.equal(sum.u1.rows[0].session, justEnded);
  });

  test('a student in several batches gets one row adding up every class', () => {
    const sum = core.attendanceSummary([
      at(1, { seriesId: 'A', studentIds: ['u1', 'u2'], joins: { u1: 1 } }),
      at(2, { seriesId: 'B', studentIds: ['u1'], absences: { u1: {} } }),
      at(3, { seriesId: 'B', studentIds: ['u1'] }),
      at(4, { seriesId: 'A', studentIds: ['u1', 'u2'], attendance: { u1: 'present', u2: 'absent' } }),
    ], now);
    assert.deepEqual({ ...sum.u1, rows: sum.u1.rows.map((r) => r.status) },
      { held: 4, present: 2, informed: 1, absent: 1, rows: ['present', 'informed', 'absent', 'present'] });
    assert.deepEqual({ ...sum.u2, rows: sum.u2.rows.length }, { held: 2, present: 0, informed: 0, absent: 2, rows: 2 });
  });

  test('held always equals present + informed + absent', () => {
    const sessions = [at(1, { joins: { u1: 1 } }), at(2, { absences: { u1: {} } }), at(3), at(4, { status: 'cancelled' })];
    const row = core.attendanceSummary(sessions, now).u1;
    assert.equal(row.held, row.present + row.informed + row.absent);
    assert.equal(row.held, 3);
  });

  test('marks for students no longer listed on a class are not counted', () => {
    const sum = core.attendanceSummary([at(1, { studentIds: ['u1'], attendance: { gone: 'present' } })], now);
    assert.equal(sum.gone, undefined);
  });

  test('a past class with nobody in it adds no rows', () => {
    assert.deepEqual(core.attendanceSummary([at(1, { studentIds: [] })], now), {});
  });
});

describe('percent', () => {
  test('rounds to the nearest whole percent', () => {
    assert.equal(core.percent({ held: 3, present: 2 }), 67);
    assert.equal(core.percent({ held: 3, present: 1 }), 33);
    assert.equal(core.percent({ held: 8, present: 1 }), 13);
  });

  test('0 and 100 at the extremes; 0 when nothing was held', () => {
    assert.equal(core.percent({ held: 5, present: 0 }), 0);
    assert.equal(core.percent({ held: 5, present: 5 }), 100);
    assert.equal(core.percent({ held: 0, present: 0 }), 0);
  });
});

describe('monthRangeIST', () => {
  const range = (m) => Object.values(core.monthRangeIST(m)).map(iso);

  test('January starts at India midnight on 1 Jan, which is 31 Dec in UTC', () => {
    assert.deepEqual(range('2027-01'), ['2026-12-31T18:30:00.000Z', '2027-01-31T18:30:00.000Z']);
  });

  test('December ends at India midnight on 1 January of the next year', () => {
    assert.deepEqual(range('2026-12'), ['2026-11-30T18:30:00.000Z', '2026-12-31T18:30:00.000Z']);
  });

  test('February is 28 or 29 days long', () => {
    const days = (m) => { const r = core.monthRangeIST(m); return (r.toMs - r.fromMs) / (24 * HOUR); };
    assert.equal(days('2027-02'), 28);
    assert.equal(days('2028-02'), 29);
    assert.equal(days('2026-09'), 30);
    assert.equal(days('2026-10'), 31);
  });

  test('a class at 00:00 India time on the 1st is in that month, not the one before', () => {
    const { fromMs, toMs } = core.monthRangeIST('2026-11');
    const first = core.istToUtcMs('2026-11-01', '00:00');
    const lastMinute = core.istToUtcMs('2026-10-31', '23:59');
    assert.ok(first >= fromMs && first < toMs);
    assert.ok(!(lastMinute >= fromMs));
    assert.ok(!(core.istToUtcMs('2026-12-01', '00:00') < toMs), 'the end is exclusive');
  });

  test('consecutive months meet with no gap and no overlap', () => {
    assert.equal(core.monthRangeIST('2026-09').toMs, core.monthRangeIST('2026-10').fromMs);
    assert.equal(core.monthRangeIST('2026-12').toMs, core.monthRangeIST('2027-01').fromMs);
  });
});
