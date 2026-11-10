# Persona review — 8 simulated visitors from an Instagram promo (2026-11-11)

Personas: Indian parent (Bengaluru, 7-yr-old beginner) · German parent (Munich, 10-yr-old
~1100 Lichess) · US parent (NJ, 8-yr-old ~600 chess.com) · Dubai NRI parent (9 + 6) · Indian
teen (13, FIDE 1250) · Dutch teen (14, Lichess 1450) · cold 20-second tapper · Singapore
parent of a 4.5-yr-old. Each walked site/index.html (+ hi/ where relevant) on a phone.
One claim was wrong and is discarded: "marquee CSS missing" — it exists (styles.css 281-291).

## Where visitors leave (counted across 8)
1. **Plans with no price — 7/8.** Every parent persona names this as THE exit. ~8 screens of
   scrolling ends in "ask on WhatsApp". Foreign parents read it as the spam-academy pattern;
   the Indian parent has ₹2,500 from a competitor in her head.
2. **Coach strip auto-slides on phones — 6/8.** Hover-pause does nothing on touch; text moves
   while reading; FIDE link is a moving target.
3. **"I" vs "we" and the intermediate ceiling — 6/8.** FAQ says "I teach… beginners to
   intermediate", page says "our coaches" + a Tournament level. Both teens close the tab on
   that FAQ line; parents can't tell who teaches their child.
4. **Timings are a non-answer — 6/8.** "Mutual availability across time zones"; form's
   "Weekday evenings" in whose zone?
5. **Lesson chips all open the profile, not the reel — 5/8.** Feels like padding/misleading.
6. **First screen is a text wall with no face — 5/8.** Reel sent them; no face until ~5,000 px.
   Puzzle pushes proof down and is below the fold anyway.
7. **Reviews: two, first-name only, no source — 5/8.** "100+ students" vs 2 reviews.
8. **Who actually teaches my child — 5/8.** Only Shubham has a FIDE link; other bios generic.
9. **"Assessment slots are limited" distrusted — 4/8.**
10. **AIM reads like a FIDE title until googled — 4/8.**
11. **Payment from abroad / currency unstated — 4/8** (all international parents).
12. **Teen ceiling — 2/8 but total loss of that segment:** picker tops at "1000 or above",
    mate-in-1 hero puzzle, "your child" everywhere, no student in their band, no coach handles.
13. **Siblings at different levels — 1/8** (Dubai): Pair card implies "same level" only; form
    takes one child.
14. **4–6-year-olds — 1/8:** every plan says 50 min × 2/week + homework; guide says 15 min.
15. **Cold-tapper mechanics — 1/8 but structural:** header/hero CTA jump 9,000 px to a form;
    `window.open` is often swallowed in Instagram's in-app browser; iOS won't focus the field
    from a setTimeout; jump-bar CTA has `margin-left:auto` inside a scroller → off-screen.
16. **Hindi page:** float text is masculine-only; form composes "चाहता/चाहती" with the slash.
17. **Form copy:** "Knows the moves before." is ungrammatical; placeholder "Aarav"; age max 15;
    label "Child's first name" excludes teens.
18. **Trust/legal (EU):** no email, no city, no privacy line while GA4 fires.

## What convinced people (keep)
Clickable FIDE ID · Commonwealth U-7 bronze photo · four-step class · "nothing is stored on
this site" · free PDF with no sign-up · public Lichess team · a real phone number · calm
design with no countdowns.

## Ranked actions (by leads gained)
A. Fix without new facts (Claude can do now): 2, 3 (voice + FAQ ceiling), 5 (link reels or
   cut to three), 6 (face + proof above the fold; puzzle moved down), 9, 10 (say "online
   arena title"), 12 (picker buckets, teen-neutral copy, "Student's name", age to 16),
   15 (direct wa.me on header/hero, form secondary, location.href), 16, 17, jump-bar CTA.
B. Needs Shubham's facts: 4 (real IST windows + CET/ET/GST conversions), 8 (FIDE IDs for
   Soundariya & Sanjay; "Shubham takes every assessment and assigns the coach"), 11 (payment
   methods abroad), 13 (sibling policy), 14 (what a 4–6 class actually is), 7 (Google Business
   Profile → review count), teen proof (one before/after student).
C. Akash's decision: 1 — show prices, show "from ₹X" ranges, or at minimum state billing unit
   + "fee quoted in the first reply, before any class" + pause/stop terms.
