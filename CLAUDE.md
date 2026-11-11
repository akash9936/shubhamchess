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
├── docs/                ← plans for future work (student portal)
├── assets/              ← source material (poster, original photos); NOT deployed
├── site/                ← THE DEPLOYABLE ROOT. Static, no build step.
│   ├── index.html       ← English home page (JS inline: level picker, demo form, GA events)
│   ├── trainer.js       ← puzzle trainer (Lichess API stream + built-in fallback); strings via window.TRAINER_STRINGS
│   ├── vendor/chess.min.js  ← chess.js 0.13.4 (BSD-2), export line swapped for a window global
│   ├── styles.css       ← ONE stylesheet shared by every page
│   ├── hi/index.html    ← Hindi home page (leaner: no picker/gallery/timings/guides)
│   ├── guides/*.html    ← three parent guides (static articles)
│   ├── instagram/index.html  ← static redirect → his Instagram
│   ├── downloads/starter-puzzles.pdf  ← lead magnet; rebuilt from scratchpad HTML via Chrome --print-to-pdf
│   ├── media/           ← self-hosted reels (mp4 + poster jpg)
│   ├── og.png · favicon.svg · shubham.jpg · result-commonwealth-2026.jpg · poster.jpg
│   └── sitemap.xml · robots.txt   (CNAME to be added at deploy)
└── draft/review-draft.html  ← the 2026-10-02 artifact body the site was cut from (frozen)
```

- **No build step.** Edit the HTML/CSS directly; open with `open site/index.html`. Shared
  styles live in `site/styles.css` — never re-inline them. **Every page links it as
  `styles.css?v=<yyyymmdd><letter>`; bump the version in all five pages whenever the CSS
  changes** (GitHub Pages caches it for 10 min and phones keep it longer: a stale sheet
  with new HTML looks like a broken deploy — 2026-11-11).
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

- The site runs **free on GitHub Pages**. We **operate no server**: nothing to install,
  patch, restart or pay for. Clarified 2026-11-10: a **managed, free-tier backend that
  Google runs (Firebase Auth + Firestore, Spark plan, no Cloud Functions)** is allowed —
  Akash's words were "I do not want to *run* any server", and Firebase is a server Google
  runs. Anything we would have to host ourselves (a VPS, a container, a cron box) is still out.
- **If Akash asks for a feature that needs a server we would run, decline it** and say:
  *"we need to run a server for this"*, then offer the nearest alternative: static first
  (a WhatsApp link instead of a form, an embed instead of a stored record, GA4), then
  Firebase if it genuinely needs login or stored data. The student portal
  (`docs/student-portal-plan.md`) is the first Firebase feature, planned, not started.
- Allowed: anything that runs in the visitor's browser from static files — HTML, CSS, JS,
  `localStorage`, links out to WhatsApp / Instagram / Google Forms / Calendly, and
  third-party scripts loaded client-side (GA4).
- Deploy = push `site/` contents to the Pages branch/folder of the GitHub repo and point the
  custom domain at it (`CNAME` file in `site/`). HTTPS is GitHub's. Akash pushes himself.

## Style Contract

The rules the page is written to. Feedback from Akash changes this list, never just the HTML.

- **Three coaches, so the academy is "we" / "our coaches"**, never "he" (11-10). Shubham
  by name only where the fact is his alone (WhatsApp replies, the free assessment).
- **Three coaches, so the academy is "we" / "our coaches"**, never "he" (11-10). Shubham
  by name only where the fact is his alone (WhatsApp replies, the free assessment, his reels).
- **Levels are a learning map**: each level card = who it is for (italic line) + six topics in
  teaching order + a meta row "Placed by the free assessment". No rating bands, no durations,
  no "3 months" promises. New topics go in order, not appended.
- **The brand is "Shubham Chess Academy"** (Hindi: शुभम चेस अकादमी) everywhere: header,
  titles, OG, footer, PDF, JSON-LD. Never "Shubham Singh Chess" (the pre-academy name,
  retired 11-11).
- **Audience is a parent, not a chess player.** Plain words; chess terms only where the
  page explains them (the puzzle, the lesson topics).
- **The contact number is the WhatsApp Business line +91 82238 20430** (since 11-10). It is
  the only number on the site: wa.me links, tel: link, JSON-LD, PDF footer. Change it with
  one grep across `site/` and the puzzle sheet source, then regenerate the PDF.
- **One call to action**: the free assessment class. Every "book" button (header, hero, plan
  card, coach cards, guides, picker result aside) goes to `#demo`, the contact form, which
  composes the WhatsApp message from the child's details; the first field is focused on
  arrival. Direct wa.me links remain only on the floating button, the contact-block number
  and the lessons/plans sub-line. No stored forms, logins or payments.
- **Public prices = one starting-from figure per format** (group ₹1,500 · pair ₹3,000 ·
  one-to-one ₹4,500 per month), on the card and in the FAQ, with "exact fee shared in the
  free assessment class". The 3/6-month totals stay in the gitignored
  `assets/pricing-private.md` — never into a tracked file (public repo). The class-plans section is four **pricing-style cards without per-format prices** (Small group 1:5 · Pair 1:2 · One-to-one 1:1 · Free assessment) (`.plans` → `article.plan`: badge, name, sub-line, "What's included" checklist,
  no buttons on the paid cards; the only button in the section is on the fourth card, the
  free assessment itself — Akash removed the per-card buttons 11-10). One-to-one is `.featured`. Every bullet comes from his FAQ / class
  plans; no EMI, discounts, "save X%" or session counts we have not been given.
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
  A reel he wants shown is **self-hosted** as an mp4 in `site/media/` (≤720p, a few MB,
  his own content) with a poster frame and a `<video controls playsinline>` tag, plus a
  "Watch on Instagram" link. Instagram's `embed.js` is NOT used: Akash wants only the video,
  and the embed's like/comment/"View more" chrome cannot be removed (2026-11-10).
- **Coaches section** (`#coach`, heading "Meet our coaches", no sub-line) is a **one-at-a-time
  slider** (`#cslider` → `.cslides` → `article.cslide`, dots + arrows, swipe on touch,
  auto-advance 7 s paused on hover/focus, off under reduced-motion; JS inline near the demo
  form). Each slide: circular photo (`.cphoto`, object-position per coach) left, `.cbody`
  right with eyebrow "Coach", name + rating tag, bio paragraphs, uniform `.chips`, CTA.
  Replaced the sliding strip on 11-11 (Akash's reference: circular portrait + text + dots).
  Each card: 4:3 photo on top with a `.badge` that reads "Coach" for everyone (no Head coach rank, 11-10), name + short `.tag`, one short
  paragraph (bio verbatim; no personal quotes — Akash removed Shubham's 11-10), uniform green `.chips` (value-only text, same size on every card; Shubham's four:
  3× Chhattisgarh State Champion · Senior State Championship – 3rd Place · 3+ Years Online
  Coaching Experience · FIDE Rating 1738), equal card heights with the CTA pinned to the
  bottom, and a "Free assessment class"
  WhatsApp link at the foot. Akash chose this over the stacked bio layout (2026-11-10, after
  seeing a tutor-card reference). Card photos are `site/<name>-card.jpg` (900×675). Mirror on
  `hi/`. Intro video (item 23), when it exists, goes in Shubham's card in place of the photo.
  Flag once if a supplied portrait looks generated, then use it.
- **Shubham's voice, Shubham's facts.** Credentials only as he states them; "AIM is awarded by
  FIDE Online Arena" is the one line of Claude's wording still to be confirmed by him.
- **No dependencies** except Google Fonts and Instagram's embed script. Must render fine if
  either fails. Pages share `styles.css`; no framework, no bundler.
- **Static only** (see Hosting above). Any feature must work from `index.html` served as a
  plain file. **Puzzle trainer** (`#trainer`, in "Between classes"): streams puzzles from
  `https://lichess.org/api/puzzle/next` (CORS `*`, no key; angle/difficulty per level) and
  falls back to ten verified mate-in-ones if the fetch fails; legality via self-hosted
  chess.js (the cdnjs build is an ES module and cannot be a plain `<script>`); solved count
  and streak in localStorage only; `puzzle_solved` GA event. Test it headless with a probe
  that clicks squares (see NOTES → Verifying).
- **Phone first.** 16 px side gutters, no horizontal scroll, board usable with a thumb.
- **Visual layer (11-11)**: the bottom of `styles.css` is an override layer that makes the
  site "attractive" per Akash — gradient amber buttons, soft shadows + hover lift on every
  card, alternating section backgrounds, eyebrow knight glyph + gradient underline on h2,
  hero = a single centred column of copy (the photo-with-badges block was removed the same
  night at Akash's request), puzzle lives in "Between classes", contact is a dark green panel with
  the form in a white card, dark footer, pulsing WhatsApp float. Keep new components in
  this language: `var(--radius)`, `var(--shadow)`, gradient badge. Reduced-motion is
  respected (badges, pulse).
- **Bold colour layer (11-11, below the visual layer in styles.css)**: light theme is warm
  cream (`--bg #f7f3e8`) with a very faint chessboard texture; header + hero are deep green
  with white text and amber accents; every section has its own tinted band (`#levels`
  teal, `#class` amber, `#results` gold…); cards carry a coloured top/left accent bar and
  coloured icon tiles cycling green / amber / teal / rose / violet / navy; section labels
  are green pills. Keep new sections in this system: pick a band tint and an accent colour
  from the six tokens, never a new hue.
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
- 2026-11-10 — Akash: "we can use Firebase without running a server, right?" then the
  portal design (coach schedules classes + link, students log in by ID, join). → Hosting
  rule rewritten: no server *we run*; managed free-tier Firebase allowed. Design agreed
  with three changes (coach = Google sign-in, student ID = generated access code, series →
  per-session rows) and parked in `docs/student-portal-plan.md`. Not started, on his word.
- 2026-11-10 — Akash, on the reel card: remove the like / comment / "View more on
  Instagram" rows, keep just the video. → Instagram embed replaced by a self-hosted mp4
  (`media/understand-the-student-first.mp4`, 360×640, 1.6 MB, fetched with yt-dlp) with a
  poster frame, on EN and HI; `embed.js` dropped. Instagram rule rewritten accordingly.
- 2026-11-10 — Akash: turn "Your coach" into "Meet our coaches" and add Soundariya Laxmi
  (photo + bio supplied). → Section reheaded on EN + HI, Shubham tagged Head coach, second
  coach block added with creds (FIDE 1580, Commonwealth Chess Championship); nav label
  "Coaches". Portrait looks AI-generated — said so once, used it. Style Contract gained
  the coaches-section pattern.
- 2026-11-10 — Akash: "no, I want it like this" (tutor-card grid reference: photo top with
  a badge, name, short bio, demo link). → Coaches section rebuilt as `.ccard` grid on EN +
  HI with 4:3 photos, role badges, credential chips and a WhatsApp CTA per card; the
  stacked bio layout from an hour earlier dropped. Rule updated.
- 2026-11-10 — Akash sent a third coach's bio (FIDE 1637, 3+ yrs, AIU runner-up 2022–23,
  120+ tournaments) with the same tutor-card screenshot. → Third `.ccard` added on EN + HI,
  photo cropped from the screenshot's second card, name left as `.ph` (none given);
  section now "Three coaches". Flagged once that the photo is labelled as another
  academy's maths coach on its source page.
- 2026-11-10 — Akash: name is Sanjay Bhardwaj, use this portrait. → Name filled on EN + HI,
  photo replaced with `sanjay-card.jpg` (the screenshot crop deleted).
- 2026-11-10 — Akash: remove Shubham's "my chess journey" quote and the Head coach badge.
  → Both removed on EN + HI; all three cards now badge "Coach". Coaches rule updated.
- 2026-11-10 — Akash: drop the "Three coaches, one way of teaching" heading + sub-line, and
  make the cards move continuously side by side. → Heading is now just "Meet our coaches";
  cards sit in a CSS marquee (duplicated set, 36 s loop, pause on hover, reduced-motion
  fallback) on EN + HI. Rule updated.
- 2026-11-10 — Akash: remove "See how he teaches before you book" and do something better.
  → Lessons section reheaded "One idea per lesson, free on Instagram" with a coach-neutral
  lede, every topic chip now a link (play glyph) to the Instagram profile, button reads
  "Follow @shubhamsinghchess". Same on HI. Rule: copy must not say "he" for the academy
  now that there are three coaches.
- 2026-11-10 — Akash: remove "See how he teaches before you book" and do something better.
  → Lessons section (EN only; HI never had it) reheaded "One idea per lesson, free on
  Instagram" with a coach-neutral lede, every topic chip now a link with a play glyph to the
  Instagram profile, button "Follow @shubhamsinghchess". Hero lede on EN + HI now says
  "FIDE-rated coaches led by Shubham Singh". Rule added: academy copy is "we", not "he".
- 2026-11-10 — Akash: "fix this" on the timings section showing two amber placeholders. →
  Placeholders replaced with rows derived from his FAQ and class plans (slots by mutual
  availability, 50 min twice a week, IST matched abroad); lede rewritten in "we" voice.
  Rule: a `.ph` that has waited more than a day gets replaced with honest general copy from
  facts already on the page, not left visible on the live site.
- 2026-11-10 — Akash sent a pricing-card reference ("do like this … I just don't want price
  to be shown"). → Plans table replaced by three cards on EN + HI (Small group / One-to-one
  featured / Free assessment), checklists from his FAQ and plans, two WhatsApp buttons each,
  no prices. No-prices rule rewritten to describe the card pattern.
- 2026-11-10 — Akash: there is also a one-coach-two-students format. → "Pair" card added
  between Small group and One-to-one on EN + HI; grid now 4 / 2 / 1 columns.
- 2026-11-10 — Akash: remove the Timings section, not necessary. → Section, nav link, the
  time-zone helper JS and its CSS removed from EN (HI never had it). Items 19/20 from the
  survey list are therefore dropped, not pending.
- 2026-11-10 — Akash: "do as you suggest" after the TalentGum comparison. → Quick-jump pill
  bar under the hero, six "What your child gets" cards, and level cards rebuilt as a
  topic-ordered learning map (rating-band `.ph`s gone) on EN + HI. Rule added for levels.
- 2026-11-10 — Akash, on the jump bar: "do you think it's needed?" → Kept for phones only
  (≤760 px, where the header nav is hidden); hidden on desktop where it duplicated the
  header. Rule: never show two navigations on one screen.
- 2026-11-10 — Akash: remove the stats strip (1738 / 100+ / 3 / 2+ / 5). → Removed on EN +
  HI with its CSS. Survey item 14 is dropped; the numbers still live in the coach cards.
- 2026-11-10 — Akash: remove the gallery. → Section + CSS removed on EN (HI never had it).
  `poster.jpg` is now unreferenced by pages (kept: OG image source); `shubham.jpg` (4:5) is
  still used by `og.png` generation only. Survey item 25 dropped.
- 2026-11-10 — Akash: +91 82238 20430 is the WhatsApp Business number. → Replaced the old
  number in all 5 pages (45 occurrences: wa.me, displayed number, tel:, JSON-LD), the
  puzzle PDF regenerated with the new footer. Call link also points at the business number.
- 2026-11-10 — Akash: remove the "Ask for fees on WhatsApp" buttons. → Dropped from the
  three paid plan cards on EN + HI; "Book a free assessment" promoted to the primary button.
  The fee question still lives in the section's sub-line text.
- 2026-11-10 — Akash: a "Book a free assessment" button under every plan is not needed. →
  Buttons removed from the three paid cards on EN + HI; the Free assessment card keeps its
  single "Book on WhatsApp" button. Rule: one CTA per section, on the thing it belongs to.
- 2026-11-10 — Akash: "Book on WhatsApp" should open the page where they fill the child's
  details. → All book buttons (free plan card, coach cards, guide CTA boxes) now go to the
  `#demo` form; label "Book a free assessment"; scroll offset under the sticky header; first
  field auto-focused. Floating button and contact links still open WhatsApp directly.
- 2026-11-11 — Akash: Lichess team link is https://lichess.org/team/shubham7879. → "Join the
  Lichess team" button on the practice card, EN + HI. Last `.ph` on the site is gone.
- 2026-11-11 — Akash: the hero lede no longer makes sense with three coaches. → Rewritten
  on EN + HI as an academy statement (ages, three formats, three FIDE-rated coaches, one
  curriculum, weekly homework/assessments, free first class); meta + OG descriptions
  updated to match. Headline "Learn to think first, then move." kept — it is the brand line
  and is baked into og.png.
- 2026-11-11 — Akash: remove "three" from the hero. → "FIDE-rated coaches" without a count, EN + HI + meta/OG descriptions. Rule: no coach count in copy, so adding or losing a coach needs no rewrite.
- 2026-11-11 — Akash asked for a multi-persona review (8 personas, parallel) of where visitors drop before messaging. → Collated in `research/persona-review-2026-11-11.md`; ranked list given. No code changed yet — he decides.
- 2026-11-11 — Akash: production UI differs from local after a push. → Live files were
  identical to local; the difference was a cached `styles.css`. Added a `?v=` cache-buster to
  the stylesheet link on all five pages and a rule to bump it with every CSS change.
- 2026-11-11 — Akash sent the full price table (group/pair/individual × 3/6 months) and
  said: show only "Starting from ₹1,500/month" publicly, full pricing on enquiry, keep the
  table private. → Starting price + "full pricing on enquiry" in the plans lede and a new
  FAQ entry on EN + HI; "one coach for the whole batch" added; table saved to the
  gitignored `assets/pricing-private.md`. No-prices rule rewritten.
- 2026-11-11 — Akash, an hour after "show only starting-from": "I want price to show for
  every group." → Price block on the Group, Pair and One-to-one cards (EN + HI), FAQ fees
  answer lists all six figures, lede explains per-student / 3-or-6-month / pay once.
  Prices rule rewritten; `assets/pricing-private.md` no longer secret but left in place.
- 2026-11-11 — Akash: "just starting from 1500, 3000 and 4500 for each, that's it; actual
  price in the demo class." → Cards show only "Starting from ₹X/month"; totals removed from
  cards and FAQ on EN + HI; lede says the exact fee comes in the assessment class. Third
  pricing instruction today; rule rewritten to match.
- 2026-11-11 — Akash: "this website looks so simple, I want it very attractive" (and
  remove the price totals, already gone locally). → Visual layer appended to styles.css;
  hero puzzle replaced by Shubham's photo + floating badges; puzzle moved to "Between
  classes" as a full-width card; dark contact panel; dark footer; card hover lift; EN + HI.
  Style Contract gained the visual-layer rule.
- 2026-11-11 — Akash: remove the hero photo-with-badges block. → Removed on EN + HI; hero is
  now one centred column with a larger headline. Visual-layer rule updated.
- 2026-11-11 — Akash: add lichess.org/training to the site. → Third practice card on EN + HI
  with Lichess's own daily-puzzle iframe embed (client-side, static-safe) and a link to the
  trainer; practice grid now 3 columns. Rule: third-party embeds that run in the browser
  (Lichess frame, GA4) are fine; anything that stores data on our side is not.
- 2026-11-11 — Akash: "I want children to solve here only and puzzles keep going next if
  they solve" (not the Lichess embed). → `trainer.js` + `vendor/chess.min.js`: level tabs
  (Beginner mate-in-1 easiest · Intermediate mate-in-2 easier · Tournament mix normal),
  tap-to-move board, hint/skip/next, auto-advance 1.8 s after a solve, solved-today +
  streak, Lichess API with built-in fallback; replaces both the single lesson puzzle and
  the Lichess iframe card on EN + HI. Verified headless: live load (64 squares, rating tag)
  and offline solve/wrong/auto-next flow.
- 2026-11-11 — Akash: remove the FIDE ID and "100+ students" from Shubham's profile. →
  Both chips dropped from his coach card and the bio sentence reworded on EN + HI. The FIDE
  ID was also taken out of the JSON-LD `sameAs` and the coach-choosing guide, so the number
  appears nowhere on the site.
- 2026-11-11 — Akash: improve his own profile from existing facts only, four named
  achievement tags, keep the three cards equal in height and structure, tags consistent
  across cards, don't make his look more important. → Bio rewritten (two short paragraphs,
  nothing new), the four tags added, all three cards' chips converted to the same
  value-only green style, cards stretch to equal height with the CTA pinned. EN + HI.
- 2026-11-11 — Akash: show one coach at a time (reference: circular photo, text right,
  three dots) instead of all cards. → Coach slider with dots, arrows, swipe, auto-advance;
  marquee removed on EN + HI. Coaches rule rewritten.
- 2026-11-11 — Akash: "next one it should go by itself" (slider seemed stuck). → Auto-advance now every 5 s, no longer pauses on mouse hover and no longer disabled by reduced-motion; pauses only while a control inside has keyboard focus or during a touch swipe.
- 2026-11-11 — Akash: his coaching experience is 3+ years. → Tag and bio updated on EN + HI (poster said 2+; NOTES records the change).
- 2026-11-11 — Akash: "everything good but the website looks simple, colour and
  background". → Bold colour layer: deep-green header + hero, cream page with faint
  chessboard texture, tinted section bands, coloured accent bars and icon tiles, pill
  labels, theme-color meta darkened. Texture dialled down after the first render looked
  loud; pills fixed to fit their text. Rule added.
- 2026-11-11 — Akash: use "Shubham Chess Academy" everywhere. → Header brand, page titles, OG titles and guide headers on EN + HI switched; the old "Shubham Singh Chess" name is gone. Brand rule added.
