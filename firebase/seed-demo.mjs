// Local demo only: makes the throwaway coach login in the EMULATORS (never the real project).
// Run after `npm run emulators`:  node seed-demo.mjs
const P = 'demo-shubhamchess', AUTH = 'http://127.0.0.1:9099', FS = 'http://127.0.0.1:8080';
const body = JSON.stringify({ email: 'testcoach@coach.local', password: 'test-only-pw', returnSecureToken: true });
const call = (path) => fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${path}?key=demo-key`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }).then((r) => r.json());
let user = await call('signUp');
if (user.error) user = await call('signInWithPassword');          // already there
if (!user.localId) throw new Error('Could not create the demo coach: ' + JSON.stringify(user.error));
await fetch(`${FS}/v1/projects/${P}/databases/(default)/documents/config/coach`, {
  method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
  body: JSON.stringify({ fields: { uid: { stringValue: user.localId } } }),
});
console.log('Demo coach ready. Open http://127.0.0.1:8791/app/?emu  →  Coach  →  testcoach / test-only-pw');
