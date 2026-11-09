# CLAUDE.md — shubham-chess-site

One-page coaching website for Akash's brother **Shubham Singh** (online chess coach, ages
4–15). Personal project, `p:proj-shubham-chess-site`. The repo-level `../../CLAUDE.md` rules
(personal domain, no company data, never commit, Life OS tracks / this folder implements)
all apply; this file adds what is specific to this site.

## Layout

```
shubham-chess-site/
├── CLAUDE.md            ← this file: how to work here + Style Contract + Feedback Log
├── NOTES.md             ← facts about Shubham and their source, vendor check, hosting plan
├── research/            ← competitor survey (20 sites, 2026-11-09)
├── assets/              ← source material (poster, original photos); NOT deployed
├── site/                ← THE DEPLOYABLE ROOT. Static, no build step.
│   ├── index.html       ← English home page (JS inline: puzzle, level picker, demo form, tz helper)
│   ├── styles.css       ← ONE stylesheet shared by every page
│   ├── hi/index.html    ← Hindi home page (leaner: no picker/gallery/timings/guides)
│   ├── guides/*.html    ← three parent guides (static articles)
│   ├── instagram/index.html  ← static redirect → his Instagram
│   ├── downloads/starter-puzzles.pdf  ← lead magnet; rebuilt from scratchpad HTML via Chrome --print-to-pdf
│   ├── og.png · favicon.svg · shubham.jpg · result-commonwealth-2026.jpg · poster.jpg
│   └── sitemap.xml · robots.txt   (CNAME to be added at deploy)
└── draft/review-draft.html  ← the 2026-10-02 artifact body the site was cut from (frozen)
```

- **No build step.** Edit the HTML/CSS directly; open with `open site/index.html`. Shared
  styles live in `site/styles.css` — never re-inline them.
- **Verify renders headless** (Chrome's minimum window is ~500 px, so phone checks go
  through a 390-px iframe wrapper — see NOTES.md "Verifying"). Check: tag balance, 64 `.sq`
  buttons in the dumped DOM (= JS ran), no element wider than the viewport, local links and
  `#anchors` resolve, `grep -c 'class="ph"'`.
- **Live at `https://shubham.akashs.com`** (GitHub Pages via Actions, repo
  github.com/akash9936/shubhamchess, branch `master`). Every push to `site/` deploys in
  ~30 s. Akash pushes; Claude cannot (`git add/commit/push` denied).
- `draft/` is history. Do not edit it; the review artifact
  (https://claude.ai/artifact/21CLknbpb6TKQqnyZhkVMD) was published from it.
- Tracking (status, blockers, decisions) lives in Life OS at
  `~/Desktop/assistant-workspace/_shared/plans/personal/projects/shubham-chess-site.md`.
  Keep that plan and the radar row current without being asked.

## Placeholders — the `.ph` convention

Anything only Shubham can supply is wrapped in `<span class="ph">…</span>` (amber dashed
box). **Never invent a value for one.** When he supplies the fact, replace the whole span
with plain text. `grep -c 'class="ph"' site/index.html` is the go-live counter: it must be
**0** before deploy. Facts that are already real (titles, age range, WhatsApp number, reel
topics) are listed with their source in `NOTES.md`; everything else on the page that is not
a `.ph` but is a guess (levels, rating bands, class structure) is also listed there.

## Go-live checklist (in order)

1. `.ph` count is 0; the three results/review slots have real content or the section is removed.
2. Photo: `site/shubham.jpg` is a crop of the poster; replace with his original file (< 200 KB) if he sends one.
3. GA4 snippet pasted at the marked comment in `<head>` (his Google account, not Akash's).
4. Domain bought in Shubham's name, auto-renew on. Decide the fate of the old
   `shubham.akashs.com` page first (see NOTES.md).
5. Deploy `site/` to GitHub Pages, add the `CNAME` file, connect the domain, check on a real
   phone in both light and dark mode. Tap the WhatsApp button once end to end.

## Hosting: GitHub Pages, static only — a hard rule (Akash, 2026-11-09)

- The site runs **free on GitHub Pages**. There is **no server**, ever: no backend, no
  serverless functions, no database, no cron, no build step that needs a host.
- **If Akash asks for a feature that needs a server, decline it** and say exactly:
  *"we need to run a server for this"*, then offer the nearest static alternative if one
  exists (a `mailto:`/WhatsApp link instead of a contact form, a third-party embed instead
  of a stored record, GA4 instead of self-hosted analytics). Needs-a-server features
  include: form submissions stored anywhere, logins, payments, bookings with a calendar
  backend, uploads, anything that reads or writes data on request.
- Allowed: anything that runs in the visitor's browser from static files — HTML, CSS, JS,
  `localStorage`, links out to WhatsApp / Instagram / Google Forms / Calendly, and
  third-party scripts loaded client-side (GA4).
- Deploy = push `site/` contents to the Pages branch/folder of the GitHub repo and point the
  custom domain at it (`CNAME` file in `site/`). HTTPS is GitHub's. Akash pushes himself.

## Style Contract

The rules the page is written to. Feedback from Akash changes this list, never just the HTML.

- **Audience is a parent, not a chess player.** Plain words; chess terms only where the
  page explains them (the puzzle, the lesson topics).
- **One call to action**: the free assessment class, via WhatsApp. Every primary button goes
  to `#demo`; nothing else competes with it. No forms, logins or payments.
- **No prices on the page.** The class-plans table shows format, frequency, length and group
  size; fees are asked for on WhatsApp (Shubham's wording: "Contact me for class schedules
  and fee details"). Don't add a fee column back unless he sends prices.
- **Every page has the floating WhatsApp button** (`.wa-float`) and a `tel:` link next to
  the WhatsApp number. Clicks on wa.me / tel: / download links fire a GA4 `contact_click`
  event (property `G-JBH3RL4PTN`, loaded via gtag.js in every page's `<head>`). A new
  page must carry the same snippet; guide pages are the template.
- **Hindi page mirrors the English one** for anything a parent decides on (hero, levels,
  class, coach, results, plans, FAQ, contact). Reviews stay in the parents' original English.
  Change both pages together.
- **Instagram is the second door.** His profile (https://www.instagram.com/shubhamsinghchess/)
  is linked wherever it is named: header nav, hero facts, lessons section, contact, footer.
  Always `target="_blank" rel="noopener"`. `<domain>/instagram` is a static redirect to it;
  more such short links go in `site/<name>/index.html` the same way (meta refresh + JS).
  A reel or post he wants shown is embedded with Instagram's official `embed.js`
  (`blockquote.instagram-media`, one script tag before the page script) plus a plain link
  fallback, never downloaded and re-hosted.
- **Shubham's voice, Shubham's facts.** Credentials only as he states them; "AIM is awarded by
  FIDE Online Arena" is the one line of Claude's wording still to be confirmed by him.
- **No dependencies** except Google Fonts and Instagram's embed script. Must render fine if
  either fails. Pages share `styles.css`; no framework, no bundler.
- **Static only** (see Hosting above). Any feature must work from `index.html` served as a
  plain file.
- **Phone first.** 16 px side gutters, no horizontal scroll, board usable with a thumb.
- **Both themes**: colors are tokens on `:root`; dark mode via `prefers-color-scheme` and
  `[data-theme]`. Never hard-code a color in a component.
- **Honest content.** No fabricated results, reviews, student counts or ratings. Empty slot
  beats invented praise.
- **Students stay anonymous.** A result is published as the achievement only (place, event,
  category, year, city) with no child's name. A photo of a child goes on the page only when
  Akash explicitly says to publish it; Claude says once that permission is the family's
  call, then does it. Crop or blur anything that shows the name (name tags, certificates).
  Originals stay in `assets/` with `-NOT-FOR-SITE` in the filename. Parent reviews are
  quoted verbatim (light punctuation tidy only), with the child's name replaced by "my son"
  / "my daughter" and the parent credited by first name and month. Platform-wide ratings
  (e.g. a marketplace's 4.79 average) are never shown as his. Filled result cards use
  `.quote` (+ `.review` / `.video`); empty ones add `.slot`.
- **Tone of copy** (Claude's own copy only): short sentences, active verbs, no exclamation
  marks, no "unleash / journey / world-class". Text Shubham supplies (bio, FAQ, class plans)
  is kept verbatim, exclamation marks included; his voice beats the tone rule.

## Feedback → this file (self-updating, standing permission 2026-11-09)

When Akash gives feedback on the site, the copy, the design, or how this project is run:

1. **Apply it** to `site/index.html` (or wherever it lands) in the same turn.
2. **Update this file in the same turn**: amend or add the matching rule in the Style
   Contract so the preference holds next time, and append a dated line to the Feedback Log
   below (what he said, what changed). Keep the log append-only.
3. **Say so in one line** in the reply ("updated CLAUDE.md: …"). Do not ask permission;
   he granted it when this file was created. If the feedback contradicts an existing rule,
   the new feedback wins and the old rule is rewritten, with the log recording the change.
4. A fact about Shubham (rating, fees, timings) is **not** feedback: it goes into
   `NOTES.md` and replaces a `.ph` on the page. A decision (hosting, domain) goes to the
   Life OS plan's Decisions list.

### Feedback Log

- 2026-11-09 — Akash: build the real site as HTML in the repo, in its own folder, with a
  CLAUDE.md that learns from his feedback. → `site/index.html` cut from the review draft
  (draft bar, review section and "Shubham:" notes removed, full document head added);
  this file created with the Style Contract and this self-update rule.
- 2026-11-09 — Akash: "this website should run free with help of github page i do not want
  to run any server … if i tell you to develop any feature where you need to run a server
  decline the request by saying we need to run server for this." → Hosting section added
  (GitHub Pages, static only, scripted refusal); Cloudflare Pages recommendation from
  10-02 dropped; Style Contract gained the "Static only" rule.
- 2026-11-09 — Akash: his Instagram profile should have a redirect link. → Instagram linked
  in header, hero facts, lessons lede, footer (contact + lessons button already had it),
  all opening in a new tab; `site/instagram/index.html` added as a static redirect so
  `<domain>/instagram` can be shared. Style Contract gained "Instagram is the second door".
- 2026-11-09 — Akash pasted the Aug-2026 Instagram poster: use the photo as the profile
  image and extract the details. → `site/shubham.jpg` cropped from it; poster lines not yet
  on the page (personalised learning, puzzle practice & game analysis, improve rating &
  game sense, limited assessment slots, "think strategically" tagline) folded into the
  hero, class steps and contact copy. Credentials and WhatsApp number were already on the
  page from the same poster. Rule: the poster is a valid source for his facts; Claude's own
  wording still is not.
- 2026-11-09 — Akash sent a student's result + photo and said not to mention the name. →
  Slot 1 filled with the achievement only; photo first held back (child's face + name tag);
  Style Contract gained "Students stay anonymous"; filled vs empty result cards styled apart.
- 2026-11-09 — Akash: "attach this photo" (second ask, after the hold-back). → Published as
  `site/result-commonwealth-2026.jpg`, cropped above the name tag. Anonymity rule
  rewritten: a child's photo is published on Akash's explicit say-so, with any name cropped
  out; say the permission caveat once, then do it.
- 2026-11-09 — process note (Claude's own): four log appends silently failed because they
  anchored on text that was not in the file. Rule for future edits: after editing this file,
  `grep -c "^- 2026" CLAUDE.md` and compare with the expected count before replying.
- 2026-11-09 — Akash: add the reel https://www.instagram.com/p/DbjTZAKuyDX/ in the next feedback slot; in it Shubham says he
  understands the student first, then teaches. → Slot 2 is now an Instagram embed card
  with that line as its heading and a link fallback; Instagram rule extended with the
  embed method.
- 2026-11-09 — Akash pasted two parent reviews from his coaching-platform profile. → Slot 3
  filled and a fourth card added (grid now 2×2); children's names anonymised, parents by
  first name + month; platform average rating left out. Anonymity rule extended to reviews.
- 2026-11-09 — Akash pasted Shubham's class-plans table (2/week, 50 min, max 5, free
  assessment) with "contact me for fee details" instead of prices. → Fees section rebuilt as
  "Class plans and learning options", nav label changed, batch-size placeholders in the
  levels filled; Style Contract gained "No prices on the page".
- 2026-11-09 — Akash pasted Shubham's seven-question FAQ: "replace with this". → FAQ
  replaced verbatim; languages now "English and Hindi" in the hero; contact block timings
  filled and a "Classes on" row added from the FAQ. Tone rule scoped to Claude's copy only.
- 2026-11-09 — Akash: remove email, add "Shubham Chess Academy" at the end. → Email row
  dropped from the contact block; footer reads "© 2026 Shubham Chess Academy". Header brand
  and <title> left as "Shubham Singh Chess" pending his word on the public name.
- 2026-11-09 — Akash: "implement all of this one by one and verify yourself" (the top-30
  list from the 20-site survey). → Items 12–16, 18–22, 24–28, 30 built; 17 (Google
  Business Profile) and 29 (guarantee) need his/Shubham's action; 23 (intro video) has a
  commented slot awaiting a video. CSS moved to `styles.css`; Hindi page and three guide
  pages added; puzzle PDF generated with every position machine-verified (python-chess).
  Verification method recorded in NOTES.md → "Verifying".
- 2026-11-09 — Akash: link the project to github.com/akash9936/shubhamchess and push; then
  wire shubham.akashs.com. → .gitignore (assets/, draft/), Pages workflow, README added;
  Akash pushed (to `master`, so the workflow now listens on both branches); Pages source
  switched to GitHub Actions, custom domain attached, HTTPS on. Live and verified 17:43.
- 2026-11-09 — Akash pasted a GTM container snippet for analytics. → The container
  (`GTM-5T7NTCNJ`) embeds GA4 property `G-JBH3RL4PTN`; wired gtag.js with that ID into all
  five pages instead of GTM (fewer moving parts, and our `gtag('event')` calls work as is).
  Rule: analytics = GA4 via gtag.js, one property, no Tag Manager layer.
