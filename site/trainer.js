/* Puzzle trainer — solve one, get the next. Puzzles stream from the free Lichess API
   (https://lichess.org/api/puzzle/next, CORS-enabled, no key); if that fails, a built-in
   set of ten verified mate-in-one positions is used. Move legality via chess.js (CDN).
   Nothing is sent anywhere except the GET to Lichess. Progress lives in localStorage. */
(function () {
  var root = document.getElementById("trainer"); if (!root || typeof Chess !== "function") return;
  var S = window.TRAINER_STRINGS || {};
  var LEVELS = {
    beginner:     { angle: "mateIn1", difficulty: "easiest" },
    intermediate: { angle: "mateIn2", difficulty: "easier" },
    tournament:   { angle: "mix",     difficulty: "normal" }
  };
  var FALLBACK = [{"fen": "7k/8/6K1/8/8/8/8/5Q2 w - - 0 1", "solution": ["f1f8"]}, {"fen": "7k/8/6K1/8/8/8/8/R7 w - - 0 1", "solution": ["a1a8"]}, {"fen": "7k/R7/8/8/8/8/8/1R4K1 w - - 0 1", "solution": ["b1b8"]}, {"fen": "6k1/5ppp/8/8/8/8/5PPP/4R1K1 w - - 0 1", "solution": ["e1e8"]}, {"fen": "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1", "solution": ["h5f7"]}, {"fen": "k7/2P5/1K6/8/8/8/8/8 w - - 0 1", "solution": ["c7c8q"]}, {"fen": "6rk/6pp/8/4N3/8/8/8/K7 w - - 0 1", "solution": ["e5f7"]}, {"fen": "7k/R7/5N2/8/8/8/8/K7 w - - 0 1", "solution": ["a7h7"]}, {"fen": "5r2/4N1pk/8/8/8/8/6K1/R7 w - - 0 1", "solution": ["a1h1"]}, {"fen": "k7/8/1K6/4B3/8/8/8/5B2 w - - 0 1", "solution": ["f1g2"]}];
  var GLYPH = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
  var FILES = "abcdefgh";
  var board = root.querySelector(".tr-board"), ranks = root.querySelector(".ranks"), files = root.querySelector(".files");
  var msg = root.querySelector(".tr-msg"), solvedEl = root.querySelector(".tr-solved"), streakEl = root.querySelector(".tr-streak"), tagEl = root.querySelector(".tr-tag");
  var btnHint = root.querySelector(".tr-hint"), btnSkip = root.querySelector(".tr-skip"), btnNext = root.querySelector(".tr-next");
  var level = "beginner", game, solution, idx, orient, picked, last, solved, busy, hintSq, fbIdx = 0;

  function store(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  var today = new Date().toISOString().slice(0, 10);
  var stats = store("sca-trainer", {}); if (stats.day !== today) stats = { day: today, solved: 0, streak: stats.streak || 0 };
  function paintStats() { solvedEl.textContent = stats.solved; streakEl.textContent = stats.streak; save("sca-trainer", stats); }

  function squares() { var out = []; var rs = orient === "w" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8]; var fs = orient === "w" ? FILES.split("") : FILES.split("").reverse(); rs.forEach(function (r) { fs.forEach(function (f) { out.push(f + r); }); }); return out; }
  function draw() {
    board.textContent = ""; ranks.textContent = ""; files.textContent = "";
    (orient === "w" ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8]).forEach(function (r) { var s = document.createElement("span"); s.textContent = r; ranks.appendChild(s); });
    (orient === "w" ? FILES.split("") : FILES.split("").reverse()).forEach(function (f) { var s = document.createElement("span"); s.textContent = f; files.appendChild(s); });
    squares().forEach(function (id) {
      var pc = game.get(id), b = document.createElement("button");
      b.type = "button"; b.dataset.sq = id;
      var f = FILES.indexOf(id[0]), r = +id[1];
      b.className = "sq " + ((f + r) % 2 === 0 ? "l" : "d");
      if (pc) { b.textContent = GLYPH[pc.type] + "︎"; b.classList.add(pc.color); }
      b.setAttribute("aria-label", id + (pc ? ", " + (pc.color === "w" ? S.white : S.black) + " " + (S.pieces || {})[pc.type] : ", " + S.empty));
      if (id === picked) b.classList.add("pick");
      if (last && (id === last.from || id === last.to)) b.classList.add("last");
      if (id === hintSq) b.classList.add("hint");
      if (solved && game.in_checkmate && game.in_checkmate()) { var k = kingSquare(game.turn()); if (id === k) b.classList.add("mated"); }
      board.appendChild(b);
    });
  }
  function kingSquare(color) { var bd = game.board(); for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var p = bd[r][c]; if (p && p.type === "k" && p.color === color) return FILES[c] + (8 - r); } return null; }
  function say(t) { msg.textContent = t; }
  function uciOf(m) { return m.from + m.to + (m.promotion || ""); }

  function setPuzzle(g, sol, tag) {
    game = g; solution = sol; idx = 0; orient = game.turn(); picked = null; last = null; solved = false; busy = false; hintSq = null;
    btnNext.hidden = true; btnHint.disabled = false; btnSkip.disabled = false;
    tagEl.textContent = tag || "";
    draw(); say(orient === "w" ? S.yourMoveWhite : S.yourMoveBlack);
  }
  function fromFallback() {
    var p = FALLBACK[fbIdx++ % FALLBACK.length]; var g = new Chess(p.fen);
    setPuzzle(g, p.solution.slice(), S.builtIn);
  }
  function load() {
    say(S.loading); btnHint.disabled = true; btnSkip.disabled = true; btnNext.hidden = true;
    var L = LEVELS[level], ctrl = window.AbortController ? new AbortController() : null;
    var t = setTimeout(function () { if (ctrl) ctrl.abort(); }, 6000);
    fetch("https://lichess.org/api/puzzle/next?angle=" + L.angle + "&difficulty=" + L.difficulty, { signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        clearTimeout(t);
        var g = new Chess(); var ok = true;
        d.game.pgn.split(/\s+/).forEach(function (san) { if (san && !g.move(san)) ok = false; });
        if (!ok || !d.puzzle || !d.puzzle.solution || !d.puzzle.solution.length) throw new Error("bad pgn");
        var tag = (S.levelNames || {})[level] || "";
        setPuzzle(g, d.puzzle.solution.slice(), tag + (d.puzzle.rating ? " · " + d.puzzle.rating : ""));
        say((orient === "w" ? S.yourMoveWhite : S.yourMoveBlack) + " " + (solution.length > 1 ? S.movesToFind.replace("{n}", Math.ceil(solution.length / 2)) : ""));
      })
      .catch(function () { clearTimeout(t); fromFallback(); });
  }

  function opponentReply() {
    if (idx >= solution.length) return finish();
    busy = true;
    setTimeout(function () {
      var u = solution[idx]; var mv = game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u.slice(4) || undefined });
      if (mv) { last = mv; idx++; }
      busy = false; picked = null; draw(); say(S.keepGoing);
    }, 450);
  }
  function finish() {
    solved = true; stats.solved++; stats.streak++; paintStats(); draw();
    say(S.solved); btnNext.hidden = false; btnHint.disabled = true;
    if (typeof window.gtag === "function") window.gtag("event", "puzzle_solved", { level: level });
    setTimeout(function () { if (solved) load(); }, 1800);
  }
  board.addEventListener("click", function (e) {
    var t = e.target.closest(".sq"); if (!t || solved || busy || !game) return;
    var id = t.dataset.sq, pc = game.get(id);
    if (pc && pc.color === game.turn()) { picked = id; hintSq = null; draw(); say(S.nowTap); return; }
    if (!picked) { say(S.tapYourPiece); return; }
    var mv = game.move({ from: picked, to: id, promotion: "q" });
    if (!mv) { say(S.cantGo); return; }
    var want = solution[idx];
    if (uciOf(mv) === want || (mv.from + mv.to) === want.slice(0, 4) && !want[4]) {
      last = mv; idx++; picked = null; hintSq = null; draw();
      if (idx >= solution.length) finish(); else opponentReply();
    } else {
      game.undo(); picked = null; draw(); say(S.wrong);
      board.classList.add("shake"); setTimeout(function () { board.classList.remove("shake"); }, 400);
    }
  });
  btnHint.addEventListener("click", function () { if (solved || !solution) return; hintSq = solution[idx].slice(0, 2); draw(); say(S.hint); });
  btnSkip.addEventListener("click", function () { stats.streak = 0; paintStats(); solved = false; load(); });
  btnNext.addEventListener("click", function () { solved = false; load(); });
  root.querySelectorAll(".tr-level").forEach(function (b) {
    b.addEventListener("click", function () {
      root.querySelectorAll(".tr-level").forEach(function (x) { x.classList.remove("is-on"); });
      b.classList.add("is-on"); level = b.dataset.level; save("sca-trainer-level", level); solved = false; load();
    });
  });
  var savedLevel = store("sca-trainer-level", "beginner");
  if (LEVELS[savedLevel]) { level = savedLevel; root.querySelectorAll(".tr-level").forEach(function (x) { x.classList.toggle("is-on", x.dataset.level === level); }); }
  paintStats(); load();
})();
