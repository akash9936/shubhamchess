// Phone menu. Turns the header links into a drop-down panel behind a Menu button on
// narrow screens. Without this script the links stay as they were (hidden in the header,
// offered as the jump bar under the hero), so nothing depends on it to be reachable.
(function () {
  var header = document.querySelector('header.site');
  var nav = header && header.querySelector('nav.links');
  if (!nav) return;
  var root = document.documentElement;
  var wrap = header.querySelector('.wrap');
  var hindi = root.lang === 'hi';

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'menu-btn';
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-controls', 'site-nav');
  btn.innerHTML = '<span class="menu-ico" aria-hidden="true"><i></i><i></i><i></i></span><span class="menu-txt"></span>';
  btn.querySelector('.menu-txt').textContent = hindi ? 'मेन्यू' : 'Menu';
  nav.id = 'site-nav';

  // The header's call to action is hidden on small phones; a copy sits at the foot of the panel.
  var cta = wrap.querySelector('a.btn.primary');
  if (cta) {
    var copy = cta.cloneNode(true);
    copy.classList.remove('small');
    copy.classList.add('nav-cta');
    nav.appendChild(copy);
  }
  wrap.appendChild(btn);

  // Nine links stop fitting at 1100px, five at 760px (the guide pages).
  var mq = window.matchMedia('(max-width: ' + (nav.querySelectorAll('a:not(.nav-cta)').length > 6 ? 1100 : 760) + 'px)');
  function setOpen(open) {
    header.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
  }
  function setMode() {
    root.classList.toggle('menu-mode', mq.matches);
    if (!mq.matches) setOpen(false);
  }
  setMode();
  if (mq.addEventListener) mq.addEventListener('change', setMode); else mq.addListener(setMode);

  btn.addEventListener('click', function () { setOpen(!header.classList.contains('menu-open')); });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) setOpen(false); });
  document.addEventListener('click', function (e) { if (!header.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) { setOpen(false); btn.focus(); }
  });
})();
