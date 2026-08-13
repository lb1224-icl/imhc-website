// Imperial Medics HC — reference site interactions (no framework, no deps)

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

  initCalendar();
});

// ---- Calendar module ----
// Generates the month grid from a small recurring-events ruleset plus a
// handful of one-off fixtures/socials, so Prev/Next actually works instead
// of being a hardcoded static month.
function initCalendar() {
  var grid = document.getElementById('calGrid');
  if (!grid) return;

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Recurring weekly training slots (JS getDay(): 0=Sun ... 6=Sat)
  var RECURRING = [
    { dow: 1, type: 'training', label: 'Fitness Training 19:00' },
    { dow: 3, type: 'training', label: 'Squad Training 07:00' },
    { dow: 5, type: 'training', label: 'GK Session 18:00' },
    { dow: 0, type: 'training', label: 'Skills Session 10:00' }
  ];

  // One-off fixtures and socials, keyed by YYYY-MM-DD
  var ONE_OFF = {
    '2026-09-17': [{ type: 'match', label: 'vs UCL &mdash; BUCS 14:00' }],
    '2026-09-19': [{ type: 'social', label: "Freshers' Welcome Social 20:00" }],
    '2026-09-24': [{ type: 'match', label: "vs King's College (A) &mdash; BUCS 13:00" }],
    '2026-09-26': [{ type: 'social', label: 'Kit Collection &amp; Pub Quiz 19:30' }],
    '2026-10-07': [{ type: 'match', label: 'vs Bath &mdash; BUCS 14:00' }],
    '2026-10-10': [{ type: 'social', label: 'Alumni Match Social 19:00' }],
    '2026-10-21': [{ type: 'match', label: 'vs Southampton (A) &mdash; BUCS 13:00' }],
    '2026-10-31': [{ type: 'social', label: 'Halloween Social 20:00' }],
    '2026-11-04': [{ type: 'match', label: 'vs LSE &mdash; BUCS 14:00' }],
    '2026-11-14': [{ type: 'social', label: 'Winter Formal 19:30' }],
    '2026-11-18': [{ type: 'match', label: 'vs Royal Holloway (A) &mdash; BUCS 13:00' }],
    '2026-11-28': [{ type: 'social', label: 'End of Term Social 20:00' }]
  };

  var TODAY_DEMO = { y: 2026, m: 9, d: 14 }; // illustrative "today" — only shown while viewing October 2026
  var MIN_INDEX = 2026 * 12 + 8;  // Sep 2026 — the earliest month with sample data
  var MAX_INDEX = 2026 * 12 + 10; // Nov 2026 — the latest month with sample data

  var monthLabel = document.getElementById('calMonthLabel');
  var prevBtn = document.getElementById('calPrev');
  var nextBtn = document.getElementById('calNext');
  var current = { y: 2026, m: 9 }; // starts on October 2026

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

  function eventsFor(y, m, d) {
    var dow = new Date(y, m, d).getDay();
    var list = RECURRING.filter(function (r) { return r.dow === dow; }).slice();
    var extra = ONE_OFF[dateKey(y, m, d)];
    if (extra) list = list.concat(extra);
    return list;
  }

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

    for (var i = 0; i < totalCells; i++) {
      var dayNum = i - startOffset + 1;
      var y = current.y, m = current.m, d = dayNum, out = false;
      if (dayNum < 1) { out = true; d = daysInPrevMonth + dayNum; m = current.m - 1; if (m < 0) { m = 11; y--; } }
      else if (dayNum > daysInMonth) { out = true; d = dayNum - daysInMonth; m = current.m + 1; if (m > 11) { m = 0; y++; } }

      var cell = document.createElement('div');
      cell.className = 'cal-cell' + (out ? ' out' : '');
      if (!out && TODAY_DEMO.y === y && TODAY_DEMO.m === m && TODAY_DEMO.d === d) cell.classList.add('today');

      var dnum = document.createElement('span');
      dnum.className = 'dnum';
      dnum.textContent = d;
      cell.appendChild(dnum);

      if (!out) {
        var dayEvents = eventsFor(y, m, d);
        if (dayEvents.length) {
          var evtWrap = document.createElement('div');
          evtWrap.className = 'cal-evts';
          dayEvents.forEach(function (ev) {
            var chip = document.createElement('div');
            chip.className = 'cal-evt';
            chip.setAttribute('data-cat', ev.type);
            chip.style.display = (f === 'all' || f === ev.type) ? '' : 'none';
            chip.innerHTML = '<i class="dot ' + ev.type + '"></i>' + ev.label;
            evtWrap.appendChild(chip);
          });
          cell.appendChild(evtWrap);
        }
      }
      grid.appendChild(cell);
    }

    monthLabel.textContent = MONTH_NAMES[current.m] + ' ' + current.y;
    var index = current.y * 12 + current.m;
    prevBtn.disabled = index <= MIN_INDEX;
    nextBtn.disabled = index >= MAX_INDEX;
  }

  prevBtn.addEventListener('click', function () {
    var index = current.y * 12 + current.m - 1;
    if (index < MIN_INDEX) return;
    current.m--; if (current.m < 0) { current.m = 11; current.y--; }
    render();
  });
  nextBtn.addEventListener('click', function () {
    var index = current.y * 12 + current.m + 1;
    if (index > MAX_INDEX) return;
    current.m++; if (current.m > 11) { current.m = 0; current.y++; }
    render();
  });

  render();
}
