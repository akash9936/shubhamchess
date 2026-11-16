// Free-assessment request form on the two home pages. Saves the request to the academy's
// database through Firestore's REST endpoint (no SDK on the public pages), so the coach
// sees it under "Demo requests" in /app/. If saving fails, the parent is handed the same
// details as a ready WhatsApp message instead. Strings come from window.DEMO_STRINGS.
(function () {
  var form = document.getElementById("demo-form");
  if (!form) return;
  var S = window.DEMO_STRINGS, msg = document.getElementById("demo-msg"), btn = form.querySelector('button[type="submit"]');
  var emu = /[?&]emu\b/.test(location.search) && /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var PROJECT = emu ? "demo-shubhamchess" : "shubham-chess-academy";
  var URL_ = (emu ? "http://127.0.0.1:8080" : "https://firestore.googleapis.com") + "/v1/projects/" + PROJECT + "/databases/(default)/documents:commit"
    + (emu ? "" : "?key=AIzaSyBYVGZi831lsXg5qODtqFvnSg7XknwFurM");     // public web key, same as app/firebase-config.js

  function el(tag, text, attrs) { var n = document.createElement(tag); n.textContent = text; for (var k in attrs || {}) n.setAttribute(k, attrs[k]); return n; }
  function fill(t, v) { return t.replace(/\{(\w+)\}/g, function (_, k) { return v[k]; }); }
  function waUrl(v) { return "https://wa.me/918223820430?text=" + encodeURIComponent(fill(S.waText, v)); }
  function say(text, link) { msg.textContent = text; if (link) { msg.append(" ", el("a", S.waLinkLabel, { href: link, target: "_blank", rel: "noopener" })); } msg.hidden = false; }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var fd = new FormData(form), get = function (k) { return (fd.get(k) || "").toString().trim(); };
    var mobile = get("mobile").replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
    var v = { child: get("name"), age: get("age"), played: get("exp"), time: get("time"), parent: get("parent"), mobile: mobile };
    var age = parseInt(v.age, 10), digits = mobile.replace(/\D/g, "");
    if (!v.child || !v.parent) return say(S.needNames);
    if (!(age >= 4 && age <= 15)) return say(S.needAge);
    if (digits.length < 10 || digits.length > 15) return say(S.needMobile);
    if (get("website")) return done(v);                       // filled only by bots: pretend, store nothing

    var id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).replace(/-/g, "");
    var str = function (s) { return { stringValue: s }; };
    var body = { writes: [{
      update: { name: "projects/" + PROJECT + "/databases/(default)/documents/demoRequests/" + id,
        fields: { childName: str(v.child.slice(0, 40)), age: { integerValue: String(age) }, played: str(v.played.slice(0, 40)), preferredTime: str(v.time.slice(0, 40)),
          parentName: str(v.parent.slice(0, 60)), mobile: str(mobile), lang: str(S.lang), status: str("new") } },
      currentDocument: { exists: false },
      updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }],
    }] };
    btn.disabled = true; msg.hidden = true;
    fetch(URL_, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error("save " + r.status); done(v); if (window.gtag) gtag("event", "demo_request", { lang: S.lang }); })
      .catch(function (err) { console.error(err); btn.disabled = false; say(S.failed, waUrl(v)); });
  });

  function done(v) {
    var box = document.createElement("div");
    box.id = "demo-done"; box.className = "demo-form"; box.setAttribute("role", "status");
    var a = el("a", S.waLinkLabel, { class: "btn ghost", href: waUrl(v), target: "_blank", rel: "noopener" });
    var wrap = document.createElement("div"); wrap.style.gridColumn = "1 / -1";
    wrap.append(el("h3", S.doneTitle), el("p", fill(S.doneBody, v), { class: "note", style: "margin:8px 0 14px" }), a);
    box.append(wrap);
    form.replaceWith(box);
  }
})();
