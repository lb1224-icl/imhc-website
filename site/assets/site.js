// Imperial Medics HC – reference site interactions (no framework, no deps)

document.addEventListener('DOMContentLoaded', function () {
  // Mobile nav toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Generic filter groups: a .tabbar with [data-filter] buttons filters
  // sibling [data-cat] items within the same [data-filter-group] wrapper.
  // Items are re-queried on every click (not cached) so this still works
  // after the calendar module below regenerates its cells.
  document.querySelectorAll('[data-filter-group]').forEach(function (group) {
    var buttons = group.querySelectorAll('[data-filter]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var f = btn.getAttribute('data-filter');
        group.querySelectorAll('[data-cat]').forEach(function (it) {
          it.style.display = (f === 'all' || it.getAttribute('data-cat') === f) ? '' : 'none';
        });
      });
    });
  });

  // Tab panels: a [data-tab-group] wraps buttons ([data-tab]) and content
  // panels ([data-tabpanel]) – clicking a button shows the matching panel
  // and hides the others. Used on the Hockey page (Fantastar/Matches/Training).
  document.querySelectorAll('[data-tab-group]').forEach(function (group) {
    var buttons = group.querySelectorAll('[data-tab]');
    var panels = group.querySelectorAll('[data-tabpanel]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = btn.getAttribute('data-tab');
        buttons.forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        panels.forEach(function (p) {
          p.hidden = p.getAttribute('data-tabpanel') !== target;
        });
      });
    });
  });

  initCalendar();
  initAgendas();
  initScrollCue();
  initInstagram();
});

// ---- Instagram feed (Behold JSON) ----
// Replaces the placeholder sticker tiles with the latest real posts.
// If the fetch fails for any reason, the placeholder tiles stay as they are.
function initInstagram() {
  var grid = document.getElementById('instaGrid');
  if (!grid || !window.fetch) return;
  fetch(grid.getAttribute('data-feed'))
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      var posts = (data.posts || []).slice(0, 6);
      if (!posts.length) return;
      var igIcon = '<svg class="ig" viewBox="0 0 24 24" fill="none" stroke="#F3EAD9" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>';
      grid.innerHTML = '';
      posts.forEach(function (p) {
        var src = (p.sizes && p.sizes.medium && p.sizes.medium.mediaUrl) || p.thumbnailUrl || p.mediaUrl;
        var text = (p.prunedCaption || p.caption || 'View on Instagram').replace(/\s+/g, ' ').trim();
        var short = text.length > 46 ? text.slice(0, 46).trim() + '…' : text;
        var a = document.createElement('a');
        a.className = 'insta-tile';
        a.href = p.permalink;
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', 'Instagram post: ' + short);
        var img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        a.appendChild(img);
        a.insertAdjacentHTML('beforeend', igIcon + '<span class="cap"></span>');
        a.querySelector('.cap').textContent = short;
        grid.appendChild(a);
      });
    })
    .catch(function () { /* keep placeholder tiles */ });
}

// ---- Scroll cue ----
// Fades the fixed side scroll hint once the visitor has actually scrolled,
// and brings it back if they return to the top.
function initScrollCue() {
  var cue = document.querySelector('.scroll-cue');
  if (!cue) return;
  function update() { cue.classList.toggle('hide', window.scrollY > 220); }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// ---- Events (Notion, via the /api/events Worker route) ----
// Dates are shown in London time whatever the visitor's device timezone is.
var TZ = 'Europe/London';
var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var TYPE_LABELS = { match: 'Match', training: 'Training', social: 'Social', special: 'Special event' };
var londonFormatter = window.Intl ? new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null;
var eventsPromise = null;

function londonParts(iso) {
  if (iso.length <= 10) {
    var p = iso.split('-');
    return { y: +p[0], m: +p[1], d: +p[2], time: '' };
  }
  var o = {};
  londonFormatter.formatToParts(new Date(iso)).forEach(function (x) { o[x.type] = x.value; });
  return { y: +o.year, m: +o.month, d: +o.day, time: o.hour + ':' + o.minute };
}

function dayNum(y, m, d) { return y * 10000 + m * 100 + d; }
function todayLondon() { return londonParts(new Date().toISOString()); }

function prepEvent(ev) {
  var s = londonParts(ev.start);
  var e = ev.end ? londonParts(ev.end) : s;
  var startNum = dayNum(s.y, s.m, s.d);
  var endNum = Math.max(startNum, dayNum(e.y, e.m, e.d));
  var time = '';
  if (!ev.allDay && s.time) {
    time = (endNum === startNum && e.time && e.time !== s.time) ? s.time + '–' + e.time : s.time;
  }
  ev.startParts = s;
  ev.endParts = e;
  ev.startNum = startNum;
  ev.endNum = endNum;
  ev.time = time;
  return ev;
}

// Resolves to an array of events, or null if the calendar couldn't be loaded.
function loadEvents() {
  if (!eventsPromise) {
    eventsPromise = (window.fetch && londonFormatter ? fetch('/api/events') : Promise.reject())
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (data) { return (data.events || []).map(prepEvent); })
      .catch(function () { return null; });
  }
  return eventsPromise;
}

function eventsOnDay(events, y, m, d) {
  var n = dayNum(y, m + 1, d);
  return events.filter(function (ev) { return ev.startNum <= n && n <= ev.endNum; });
}

// ---- Agenda lists (home "This fortnight", calendar "Up next", hockey "Matches") ----
// Any element with data-agenda="fortnight|next|matches" is filled from Notion.
function initAgendas() {
  var lists = document.querySelectorAll('[data-agenda]');
  if (!lists.length) return;
  loadEvents().then(function (events) {
    lists.forEach(function (list) { fillAgenda(list, events); });
  });
}

function fillAgenda(list, events) {
  var kind = list.getAttribute('data-agenda');
  list.innerHTML = '';
  if (events === null) return agendaNote(list, "Couldn't load events right now – please try again later.");

  var t = todayLondon();
  var today = dayNum(t.y, t.m, t.d);
  var upcoming = events.filter(function (ev) { return ev.endNum >= today; });
  var limit = 5;
  if (kind === 'fortnight') {
    var horizon = new Date(Date.UTC(t.y, t.m - 1, t.d + 14));
    var horizonNum = dayNum(horizon.getUTCFullYear(), horizon.getUTCMonth() + 1, horizon.getUTCDate());
    upcoming = upcoming.filter(function (ev) { return ev.startNum <= horizonNum; });
    limit = 6;
  } else if (kind === 'matches') {
    upcoming = upcoming.filter(function (ev) { return ev.type === 'match'; });
    limit = 6;
  }
  upcoming = upcoming.slice(0, limit);
  if (!upcoming.length) {
    return agendaNote(list, kind === 'matches' ? 'No fixtures listed yet.' : kind === 'fortnight' ? 'Nothing scheduled in the next two weeks.' : 'Nothing coming up yet.');
  }
  upcoming.forEach(function (ev) { list.appendChild(agendaRow(ev, kind === 'matches')); });
}

function agendaNote(list, message) {
  var p = document.createElement('p');
  p.className = 'agenda-note';
  p.textContent = message;
  list.appendChild(p);
}

function agendaRow(ev, withPill) {
  var row = document.createElement('div');
  row.className = 'agenda-row';
  row.setAttribute('data-cat', ev.type);

  var date = document.createElement('div');
  date.className = 'agenda-date';
  var day = document.createElement('b');
  day.textContent = ev.startParts.d;
  var mon = document.createElement('span');
  mon.textContent = MONTH_ABBR[ev.startParts.m - 1];
  date.appendChild(day);
  date.appendChild(mon);

  var info = document.createElement('div');
  info.className = 'agenda-info';
  var title = document.createElement('b');
  title.textContent = ev.title;
  var meta = document.createElement('div');
  meta.className = 'meta';
  var until = ev.endNum > ev.startNum ? 'Until ' + ev.endParts.d + ' ' + MONTH_ABBR[ev.endParts.m - 1] : '';
  meta.textContent = [ev.homeAway, ev.location, ev.time, until].filter(Boolean).join(' · ');
  info.appendChild(title);
  info.appendChild(meta);

  row.appendChild(date);
  row.appendChild(info);

  if (withPill && ev.competition) {
    var pill = document.createElement('span');
    pill.className = 'pill pill-red';
    pill.textContent = ev.competition;
    row.appendChild(pill);
  } else {
    var dot = document.createElement('span');
    dot.className = 'dot ' + ev.type;
    dot.title = TYPE_LABELS[ev.type] || '';
    row.appendChild(dot);
  }
  return row;
}

// ---- Calendar module ----
// Month grid built from Notion events. Prev/Next move through any month.
function initCalendar() {
  var grid = document.getElementById('calGrid');
  if (!grid) return;

  var monthLabel = document.getElementById('calMonthLabel');
  var prevBtn = document.getElementById('calPrev');
  var nextBtn = document.getElementById('calNext');
  var status = document.getElementById('calStatus');
  var t = todayLondon();
  var current = { y: t.y, m: t.m - 1 };
  var events = [];
  var state = 'loading';

  function activeFilter() {
    var group = grid.closest('[data-filter-group]');
    var activeBtn = group && group.querySelector('[data-filter].active');
    return activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
  }

  function render() {
    grid.querySelectorAll('.cal-cell').forEach(function (c) { c.remove(); });

    var first = new Date(current.y, current.m, 1);
    var startOffset = (first.getDay() + 6) % 7; // Monday-start offset
    var daysInMonth = new Date(current.y, current.m + 1, 0).getDate();
    var daysInPrevMonth = new Date(current.y, current.m, 0).getDate();
    var totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    var f = activeFilter();
    var monthEvents = 0;

    for (var i = 0; i < totalCells; i++) {
      var dn = i - startOffset + 1;
      var y = current.y, m = current.m, d = dn, out = false;
      if (dn < 1) { out = true; d = daysInPrevMonth + dn; m = current.m - 1; if (m < 0) { m = 11; y--; } }
      else if (dn > daysInMonth) { out = true; d = dn - daysInMonth; m = current.m + 1; if (m > 11) { m = 0; y++; } }

      var cell = document.createElement('div');
      cell.className = 'cal-cell' + (out ? ' out' : '');
      if (!out && t.y === y && t.m - 1 === m && t.d === d) cell.classList.add('today');

      var num = document.createElement('span');
      num.className = 'dnum';
      num.textContent = d;
      cell.appendChild(num);

      if (!out) {
        var dayEvents = eventsOnDay(events, y, m, d);
        if (dayEvents.length) {
          monthEvents += dayEvents.length;
          var wrap = document.createElement('div');
          wrap.className = 'cal-evts';
          dayEvents.forEach(function (ev) {
            var chip = document.createElement('div');
            chip.className = 'cal-evt';
            chip.setAttribute('data-cat', ev.type);
            chip.style.display = (f === 'all' || f === ev.type) ? '' : 'none';
            if (ev.location) chip.title = ev.location;
            var dot = document.createElement('i');
            dot.className = 'dot ' + ev.type;
            chip.appendChild(dot);
            chip.appendChild(document.createTextNode(ev.title + (ev.time ? ' ' + ev.time : '')));
            wrap.appendChild(chip);
          });
          cell.appendChild(wrap);
        }
      }
      grid.appendChild(cell);
    }

    monthLabel.textContent = MONTH_NAMES[current.m] + ' ' + current.y;
    if (status) {
      status.textContent = state === 'loading' ? 'Loading events…'
        : state === 'error' ? "Couldn't load the calendar right now – please try again later."
        : monthEvents === 0 ? 'No events listed for this month yet.' : '';
    }
  }

  prevBtn.addEventListener('click', function () {
    current.m--; if (current.m < 0) { current.m = 11; current.y--; }
    render();
  });
  nextBtn.addEventListener('click', function () {
    current.m++; if (current.m > 11) { current.m = 0; current.y++; }
    render();
  });

  render();
  loadEvents().then(function (list) {
    if (list === null) { state = 'error'; } else { state = 'ready'; events = list; }
    render();
  });
}
