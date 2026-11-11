# shubham-chess-site — NOTES

One-page website for Akash's brother Shubham Singh, who coaches chess online (ages 4–15).
Picked 2026-10-02. Tracking lives in Life OS:
`~/Desktop/assistant-workspace/_shared/plans/personal/projects/shubham-chess-site.md`,
radar `p:proj-shubham-chess-site`.

## Built 2026-11-09 from the 20-site survey (items numbered as in the list given to Akash)
- 12 floating WhatsApp button on every page · 13 `tel:` call link · 14 stats strip (built
  11-09, removed 11-10 at Akash's request) · 15 three-question level picker → WhatsApp message with the answers ·
  16 demo "form" that composes a WhatsApp message (nothing stored) · 18 four-step "How to
  join" · 19+20 Timings section + time-zone helper — built 11-09, **removed 11-10 at Akash's request** · 21 Lichess monthly
  arena card — team https://lichess.org/team/shubham7879 (linked 11-11) · 22 `downloads/starter-puzzles.pdf` (10 mate-in-one,
  each verified with python-chess; source HTML in the session scratchpad, regenerate with
  Chrome `--print-to-pdf`) · 24 folded into join step 4 ("note to parents on what to
  practise" — from the Oct draft, **confirm with Shubham**) · 25 gallery (built 11-09, removed 11-10) · 26 three guide pages in `guides/` (Claude's copy, parent-facing, bylined
  Shubham — **he should read them once**) · 27 OG image, canonical, hreflang, JSON-LD
  (Person + EducationalOrganization + Service + Article), sitemap.xml, robots.txt ·
  28 GA4 LIVE (`G-JBH3RL4PTN`, 2026-11-09, Shubham's Google account; the GTM container
  `GTM-5T7NTCNJ` Akash pasted wraps the same property — we load gtag.js directly) +
  `contact_click` events wired on all 5 pages · 30 `hi/index.html`
  Hindi page (Claude's translation of his bio/FAQ — **he should proof it**).
- NOT done: 17 Google Business Profile (needs Shubham's Google account; then add a "Read our
  Google reviews" link) · 23 coach intro video (commented `<iframe>` slot in the coach
  section; needs a YouTube URL) · 29 guarantee / sibling discount (his commercial call).
- Assumption baked in: domain `shubham.akashs.com`. Call link reuses the WhatsApp number.

## Verifying (how the 11-09 build was checked)
- Tag balance: `html.parser` stack check over every `*.html`.
- JS ran: `chrome --headless=new --dump-dom` and count `class="sq ` = 64.
- Overflow: inject a probe listing elements with `right > clientWidth`; **Chrome headless
  clamps windows to ~500 px**, so phone checks render the page in a 390-px `<iframe>`
  wrapper (`phone.sh` pattern) — vw 375, scrollWidth 375 = clean.
- Links: every local href/src resolves; every `#anchor` has an id. Dark mode: copy of
  index with `data-theme="dark"`.
- Trainer: probe copy of index with `window.fetch` rejected → clicks `f1`,`f8` then
  `a1`,`a8` and reads `.tr-msg` / `.tr-solved` / `.tr-streak`; a second probe with real
  fetch checks 64 `.sq` in `.tr-board` and a rating in `.tr-tag`. Scripts loaded via
  `--allow-file-access-from-files` with absolute file:// src.

## Where things are
- `site/index.html` — **the real site** (2026-11-09), a standalone single-file page cut from
  the draft: full `<head>` (meta description, viewport, favicon, GA4 comment slot), no draft
  bar, no review section, no "Shubham:" notes. Still carries 15 `.ph` placeholders; `site/`
  is the deploy root. `CLAUDE.md` here holds the Style Contract and the self-updating
  feedback rule.
- `draft/review-draft.html` — source of the review draft sent to Shubham (frozen). It is an **artifact
  body**, not a standalone page: no `<!doctype>`/`<html>`/`<head>`, and it still carries the
  draft bar, the amber `.ph` placeholders and the "Not part of the site" review section.
- Published review draft (private artifact, Akash's account):
  https://claude.ai/artifact/21CLknbpb6TKQqnyZhkVMD
  To change it from a new session: pass that URL as `url` on the Artifact publish, or the
  publish creates a second artifact. Keep `draft/review-draft.html` in step with it.

## What the page is
Sections, in order: hero with a playable mate-in-one board (1. Re8#, back-rank mate) ·
three levels · how a class runs · coach · free lessons (Instagram reel topics) · results ·
fees · parent questions · WhatsApp contact · review notes for Shubham.
Fonts: Bricolage Grotesque (display), Figtree (body), DM Mono (notation) from Google Fonts.
Light and dark themes via CSS tokens on `:root`.

## Facts about Shubham (source: his Instagram profile + 3 Aug 2026 poster, read 2026-10-02)
Poster saved 2026-11-09 at `assets/poster-2026-08-03.png` (Akash pasted it). Lines on it
not already listed below: "Personalized Learning", "Helping young minds think strategically
through chess", "Limited assessment slots available", footer strip "Live online classes ·
Interactive learning · Puzzle practice & game analysis · Improve rating & game sense".
All now used on the page. Photo: `site/shubham.jpg` is cropped from the poster (456×570,
34 KB) — a screenshot-quality crop; swap for the original file when he sends it.
- Instagram: https://www.instagram.com/shubhamsinghchess/ ("Shubham Singh | Chess Coach")
- Arena International Master (AIM) · FIDE rated player — **rating 1738, FIDE ID 25799363**
  (from Shubham via Akash, 2026-11-09; page links ratings.fide.com/profile/25799363)
- State: **Chhattisgarh** · students taught: **100+** (same source)
- State champion U-17, U-19 and U-25 · 3rd place, Senior State Championship
- **3+ years** of online coaching (Akash, 2026-11-11; the Aug-2026 poster said 2+) · ages 4–15 · classes in English **and Hindi** (FAQ, 11-09) · students worldwide
- Live 1-on-1 and small group · structured curriculum · weekly homework and assessments
- Teaches: opening principles, tactical training, endgame techniques, tournament preparation
- Bio in his own words (Akash supplied 2026-11-09; **removed from the page 2026-11-10 at his
  request** — kept here only as source): "My chess journey
  began when my elder brother introduced me to the game. Through self-learning and practice,
  I developed my skills and eventually became a coach. I love helping children improve their
  chess skills, think independently, and enjoy learning."
- Call to action is a **free assessment class** (his wording, not "demo")
- Enquiries: **WhatsApp Business +91 82238 20430** (Akash, 2026-11-10) — every wa.me link,
  the tel: link, JSON-LD and the PDF footer use it. The poster's +91 62328 81878 is
  superseded (still printed on the Instagram poster image in `assets/`).
- Reel topics used in the "Free lessons" section: Chess for beginners part 1, Philidor
  Position, Lucena Position, isolated pawn, passed pawn, King's Indian Defence, Greek Gift
  sacrifice, X-ray attack, discovered attack, attackers vs defenders, how to stop castling

## Second coach — Soundariya Laxmi (from Akash, 2026-11-10; text verbatim on the page)
"Soundariya Laxmi is a FIDE-rated chess player with a rating of 1580 and has represented her
country at the Commonwealth Chess Championship. She brings competitive experience and a
passion for chess, helping students develop their skills and confidence." Photo
`site/soundariya.jpg` cropped from `assets/soundariya-original.png`. **The supplied image
looks AI-generated, not a photograph of her** — flagged to Akash; swap for a real photo
when available. No FIDE ID given yet (ask, so it can be linked like Shubham's). Hindi bio
is Claude's translation. Section is now "Meet our coaches"; all three badged plain "Coach" (Head coach dropped 11-10).

## Third coach — Sanjay Bhardwaj (Akash, 2026-11-10; bio verbatim on the page)
"A FIDE-rated chess player [FIDE rating 1637] with 3+ years of coaching experience. He has
represented his university five times at the All India University Chess Championship and
secured Runner-Up in 2022–23. With 120+ tournaments played, he brings strong competitive
experience to his coaching." Photo `site/sanjay-card.jpg` cropped 4:3 from the portrait
Akash sent (`assets/sanjay-original.png`; looks AI-styled, used as given). The earlier
screenshot crop was discarded. No FIDE ID yet.

## Student results (from Shubham via Akash, 2026-11-09)
- Slot 1: 3rd place, Commonwealth Schools Chess Championship 2026, Under-7 Girls (Rapid),
  Kuala Lumpur. **Name withheld on the page** (Akash's call). Photo: Akash asked twice to
  publish it (2026-11-09), so it is on the page as `site/result-commonwealth-2026.jpg`,
  cropped above the name tag. Permission is Akash's/Shubham's responsibility, not confirmed
  in writing here. Original at `assets/student-result-1-NOT-FOR-SITE.png` (name tag visible).
- Slot 2: reel https://www.instagram.com/p/DbjTZAKuyDX/ (Akash, 2026-11-09) — his teaching approach: "I understand the
  student first, then teach them." Was an Instagram embed; since 2026-11-10 self-hosted at
  `site/media/understand-the-student-first.mp4` (+ .jpg poster) because the embed's
  like/comment chrome could not be hidden. Re-fetch: `yt-dlp -f "b[height<=720]" <url>`. Caption copy is Claude's paraphrase
  of that one line; confirm with him.
- Slots 3–4: two 5/5 parent reviews from his coaching-platform profile (Akash's screenshot,
  2026-11-09; source platform not named — the 4.79/689 rating in the corner is the
  platform's, not his, and is NOT used). Quoted with the children's names replaced by
  "my son"/"my daughter"; parents credited by first name + month. Originals: Sushma Aditya
  (23 Mar 2026) and Priyanka J (26 Aug 2026). Results grid is now 2×2.

## Class plans (from Shubham via Akash, 2026-11-09)
- Small group: 2 classes/week · 50 min · max 5 students. **Pair (1 coach : 2 students)** — added
  by Akash 2026-11-10, same cadence assumed. One-to-one: 2 classes/week · 50 min.
  Free assessment: one session. **Public prices = starting-from per month only** (Akash's
  final word 2026-11-11, third change that day): group ₹1,500 · pair ₹3,000 · one-to-one
  ₹4,500 (his figure; the 6-month plan works out to ₹4,667). Exact fee is given in the demo
  class. Full 3/6-month table stays private in `assets/pricing-private.md` (gitignored).
  One teacher per batch.

## FAQ (Shubham's own text via Akash, 2026-11-09 — on the page verbatim)
Seven Q&As: equipment + Zoom/Google Meet + Lichess/Chess.com; beginners welcome; missed
class = inform 3–4 h before, make-up by availability, no-shows may not qualify; ages 4–15,
**English and Hindi**; worldwide, timings by mutual availability across time zones; grouping
by age/strength/level, max 5; materials = puzzles, worksheets, lesson materials, homework.
These also filled the contact-block timings row and added a "Classes on" row.

## Not from him — check before going live
- "AIM is a title awarded by FIDE Online Arena" is Claude's wording, not his.
- The three levels, their rating bands and the four-step class structure are guesses.
- Still placeholders: FIDE rating + ID, which state, fees, classes/week, class length,
  group size, student results / parent reviews (need permission), timings, missed-class
  policy, class app, his bio in his own words, the original photo file, site/academy name.

## An older site already exists (found 2026-10-02)
`~/Downloads/propelld/Codes/LIVE/shubhamProfile` (repo `akash9936/shubhamProfile`, last commit
2025-04-18, uncommitted local edits + an untracked `index1.html`) is **live at
https://shubham.akashs.com** on GitHub Pages. It is a chess.com-style profile card, not a
coaching page, and its content reads as template filler: "Candidate Master", Mumbai,
ratings of 1750–1850, "W vs. Magnus A.", a 2025 tournament schedule. None of that matches his
Instagram (Arena International Master, state champion). `LIVE/shubhamProfileV1` is an earlier
Flask version. Open decision for Akash/Shubham: replace that page with the new site, and
whether the new site lives on shubham.akashs.com (free, already wired) or a new domain.

## TalentGum review (2026-11-10)
Akash asked what to add/remove vs talentgum.com's chess page. Added: quick-jump bar under
the hero, "What your child gets" six benefit cards (all from his FAQ), learning map per
level (replaces rating-band placeholders). Not copied: prices/EMI/discounts, unverifiable
counts, press logos, FIDE-title promises, OTP booking/dashboard (server). Asked Shubham via
Akash for 4 more FAQ answers: mid-way join, fees & holidays, what the assessment includes,
which tournaments students play.

## Competitor survey (2026-11-09)
`research/competitor-survey-2026-11-09.md` — 20 academy sites, what they share, what is rare,
what needs a server. Source of the "top 30" list given to Akash the same day.

## Vendor check (2026-10-02)
Reference sites he shared: neeleshchessacademy.com, sathurangamthechessschool.com,
kkrchessacademy.com, wonderkidschess.com. All on Vercel; mostly one page + WhatsApp CTA.
Two carry a "Built by / Crafted by Chessido" footer credit; Chessido's homepage lists
Wonder Kids and Sathurangam as customers. Chessido (chessido.com, Coimbatore) sells
classroom software — live synced board, auto-graded puzzle homework, leaderboards, fee
management — and advertises a "free academy website for every coach". The ~₹1000/month
figure is what Shubham was quoted; Chessido has no public pricing page, so what it covers
is unverified.

## Repo + deploy (2026-11-09)
- GitHub repo: https://github.com/akash9936/shubhamchess — this folder is its own git repo
  (nested inside personal-projects, which ignores it). `assets/` and `draft/` are gitignored.
- **LIVE at https://shubham.akashs.com since 2026-11-09 17:43 IST.** Deploy: `.github/workflows/pages.yml`
  publishes `site/` on every push to `master` (or `main`); Pages source = GitHub Actions;
  custom domain set in repo Settings → Pages, DNS check green, HTTPS enforced. DNS: GoDaddy
  CNAME `shubham` → `shubhamprofile.github.io` (odd target, but resolves to GitHub Pages and
  passes the check — left alone). Branch is `master`. Old `shubhamProfile` repo is now
  superseded; its CNAME file can be deleted.
- Claude cannot run `git add/commit/push` (workspace deny list); Akash pushes.

## Hosting plan
- **Decided 2026-11-09 (Akash): GitHub Pages, free, no server of any kind.** Features that
  need a server are declined (see `CLAUDE.md` → Hosting). `site/` is the deploy root; add a
  `CNAME` file there when the domain is chosen. shubham.akashs.com already runs this way
  (repo `akash9936/shubhamProfile`), so the wiring is known.
- Caveats noted 10-02, still from memory: Pages on a free account needs a public repo, and
  GitHub's terms discourage Pages as hosting for a business. Akash accepted this; a public
  repo is fine since the page is public anyway. Cloudflare Pages was the earlier
  recommendation and is dropped.
- Domain: Akash will buy it. Register it in Shubham's name/email, auto-renew on.

## Visitor analytics (asked 2026-10-02, not set up)
Akash wants visitor counts and where visitors are from. Plan: Google Analytics 4 (free, city
level, can count clicks on the WhatsApp button as an event) on a Google account Shubham owns,
plus Google Search Console for the search terms that bring people in. Location is estimated
from IP, so city is approximate, especially on Indian mobile networks. Add the snippet at
go-live step 1; not possible inside the artifact draft.

## To turn the draft into the real site
1. ~~Wrap in a full HTML document~~ done 2026-11-09 → `site/index.html` (no OG image yet;
   add `og:image` once a photo exists).
2. ~~Remove the draft bar, the "Shubham:" notes and the `.review` section~~ done 2026-11-09.
   The `.ph` placeholders stay until Shubham sends the facts (`grep -c 'class="ph"'` → 0).
3. ~~Add his photo, compressed~~ done 2026-11-09 from the poster crop; replace with the original when he sends it.
4. Deploy, connect the domain, check on a phone.

## Decisions (implementation-level)
- 2026-10-02 one static page with a WhatsApp CTA, no login/payments/student portal — he
  already teaches through online portals; a classroom platform is months of work and is
  what Chessido sells for ~₹12k/year.
