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
  initLinks();
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

// "1s v Kent (Away)" for matches, plain title for everything else.
function eventLabel(ev) {
  if (ev.type !== 'match') return ev.title;
  var opponent = ev.opponent || ev.title;
  return (ev.team ? ev.team + ' v ' : '') + opponent + (ev.homeAway ? ' (' + ev.homeAway + ')' : '');
}

function realLocation(ev) {
  return ev.location && !/^tbc$/i.test(ev.location.trim()) ? ev.location : '';
}

// "Location @ time", with TBC for whichever is unknown.
function matchWhere(ev) {
  return (realLocation(ev) || 'TBC') + ' @ ' + (ev.time || 'TBC');
}

// Detail line under a title: kick-off and venue for matches, venue and time otherwise.
function eventMeta(ev) {
  var until = ev.endNum > ev.startNum ? 'Until ' + ev.endParts.d + ' ' + MONTH_ABBR[ev.endParts.m - 1] : '';
  if (ev.type === 'match') {
    return matchWhere(ev);
  }
  return [ev.location, ev.time, until].filter(Boolean).join(' · ');
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
  title.textContent = eventLabel(ev);
  var meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = eventMeta(ev);
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
  var team = 'all';
  var teamBar = document.getElementById('teamBar');
  var fixtureList = document.getElementById('fixtureList');
  var fixturesHead = document.getElementById('fixturesHead');

  function teamOk(ev) { return ev.type !== 'match' || team === 'all' || ev.team === team; }

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
            chip.setAttribute('data-squad', ev.team || '');
            chip.style.display = ((f === 'all' || f === ev.type) && teamOk(ev)) ? '' : 'none';
            if (ev.location) chip.title = ev.location;
            var dot = document.createElement('i');
            dot.className = 'dot ' + ev.type;
            chip.appendChild(dot);
            if (ev.type === 'match') {
              var body = document.createElement('span');
              body.className = 'cal-evt-body';
              var name = document.createElement('span');
              name.textContent = eventLabel(ev);
              var where = document.createElement('small');
              where.textContent = matchWhere(ev);
              body.appendChild(name);
              body.appendChild(where);
              chip.appendChild(body);
              chip.classList.add('cal-evt-match');
            } else {
              chip.appendChild(document.createTextNode(ev.title + (ev.time ? ' ' + ev.time : '')));
            }
            wrap.appendChild(chip);
          });
          cell.appendChild(wrap);
        }
      }
      grid.appendChild(cell);
    }

    monthLabel.textContent = MONTH_NAMES[current.m] + ' ' + current.y;
    renderFixtures();
    if (status) {
      status.textContent = state === 'loading' ? 'Loading events…'
        : state === 'error' ? "Couldn't load the calendar right now – please try again later."
        : monthEvents === 0 ? 'No events listed for this month yet.' : '';
    }
  }

  function renderFixtures() {
    if (!fixtureList) return;
    fixtureList.innerHTML = '';
    fixturesHead.textContent = 'Fixtures in ' + MONTH_NAMES[current.m];
    if (state === 'loading') return agendaNote(fixtureList, 'Loading fixtures…');
    if (state === 'error') return agendaNote(fixtureList, "Couldn't load fixtures right now.");
    var lo = dayNum(current.y, current.m + 1, 1), hi = dayNum(current.y, current.m + 1, 31);
    var list = events.filter(function (ev) {
      return ev.type === 'match' && ev.startNum <= hi && ev.endNum >= lo && (team === 'all' || ev.team === team);
    });
    if (!list.length) return agendaNote(fixtureList, 'No ' + (team === 'all' ? '' : team + ' ') + 'fixtures listed for this month.');
    list.forEach(function (ev) {
      var row = agendaRow(ev, false);
      if (ev.team) {
        var tag = document.createElement('span');
        tag.className = 'pill pill-red';
        tag.textContent = ev.team;
        row.replaceChild(tag, row.lastChild);
      }
      fixtureList.appendChild(row);
    });
  }

  if (teamBar) {
    teamBar.querySelectorAll('[data-team]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        teamBar.querySelectorAll('[data-team]').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        team = btn.getAttribute('data-team');
        render();
      });
    });
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

// ---- Links page (Notion, via the /api/links Worker route) ----
var LINK_SECTIONS = [
  { key: 'freshers', title: 'New here? Start below!' },
  { key: 'bucs', title: 'BUCS' },
  { key: 'payment', title: 'Payment Links' },
  { key: 'resources', title: 'Resources' }
];
var LINK_ICONS = {
  message: '<path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 20l1.1-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/>',
  money: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18M7 15h4"/>',
  calendar: '<path d="M8 4v3M16 4v3M4 9h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/>',
  kit: '<path d="M8 4 4 7l2 3 2-1v11h8V9l2 1 2-3-4-3-2 2h-2z"/>',
  cup: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4zM8 6H5a2 2 0 0 0 2 4M16 6h3a2 2 0 0 1-2 4M12 12v4m-3 4h6l-1-4H10z"/>',
  photo: '<rect x="3" y="4" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
};
var SVG_NS = 'http://www.w3.org/2000/svg';

function initLinks() {
  var host = document.getElementById('linkSections');
  if (!host) return;
  var note = function (msg) {
    host.innerHTML = '';
    var p = document.createElement('p');
    p.className = 'agenda-note';
    p.textContent = msg;
    host.appendChild(p);
  };
  if (!window.fetch) return note("Couldn't load links right now.");
  fetch('/api/links')
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { renderLinks(host, data.links || [], note); })
    .catch(function () { note("Couldn't load the links right now. Email medics.hockey@imperial.ac.uk and we'll help."); });
}

function renderLinks(host, links, note) {
  if (!links.length) return note('No links yet.');
  var groups = {}, order = [];
  links.forEach(function (l) {
    var key = (l.section || 'Other').toLowerCase();
    if (!groups[key]) { groups[key] = { name: l.section || 'Other', items: [] }; order.push(key); }
    groups[key].items.push(l);
  });
  var known = LINK_SECTIONS.map(function (x) { return x.key; });
  var keys = known.filter(function (k) { return groups[k]; })
    .concat(order.filter(function (k) { return known.indexOf(k) < 0; }));

  host.innerHTML = '';
  keys.forEach(function (key, i) {
    var def = LINK_SECTIONS.filter(function (x) { return x.key === key; })[0];
    var cat = document.createElement('div');
    cat.className = 'link-cat';
    var h = document.createElement('h4');
    h.className = 'eyebrow';
    h.style.marginBottom = '1.25rem';
    h.textContent = def ? def.title : groups[key].name;
    var grid = document.createElement('div');
    grid.className = 'link-grid';
    groups[key].items.forEach(function (l, j) { grid.appendChild(linkTile(l, i === 0 && j === 0)); });
    cat.appendChild(h);
    cat.appendChild(grid);
    host.appendChild(cat);
  });
}

function linkTile(l, featured) {
  var a = document.createElement('a');
  a.className = 'link-tile' + (featured ? ' card' : '');
  if (featured) a.style.borderTop = '5px solid var(--red)';
  a.href = l.url || '#';
  if (/^https?:/i.test(l.url) && l.url.indexOf(location.origin) !== 0) { a.target = '_blank'; a.rel = 'noopener'; }

  var ic = document.createElement('span');
  ic.className = 'ic';
  var svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.6');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = LINK_ICONS[l.icon] || LINK_ICONS.link;
  ic.appendChild(svg);

  var body = document.createElement('span');
  var b = document.createElement('b');
  b.textContent = l.title;
  body.appendChild(b);
  if (l.description) {
    var p = document.createElement('p');
    p.textContent = l.description;
    body.appendChild(p);
  }
  var go = document.createElement('span');
  go.className = 'go';
  go.innerHTML = '&rarr;';

  a.appendChild(ic);
  a.appendChild(body);
  a.appendChild(go);
  return a;
}
