// Serves the static site (via the ASSETS binding) and one API route,
// /api/events, which reads the club's Notion calendar database.
// NOTION_TOKEN is a Worker secret; NOTION_DATABASE_ID is set in wrangler.jsonc.

const NOTION_VERSION = '2022-06-28';
const CACHE_SECONDS = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/events') return handleEvents(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};

async function handleEvents(request, env, ctx) {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, false);

  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/events', request.url).toString());
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
    return json({ error: 'Notion is not configured' }, 500, false);
  }

  try {
    const pages = await queryAll(env);
    const events = pages.map(toEvent).filter(Boolean);
    events.sort((a, b) => a.start.localeCompare(b.start));
    const response = json({ events, updated: new Date().toISOString() }, 200, true);
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch (err) {
    return json({ error: 'Could not read the Notion calendar' }, 502, false);
  }
}

async function queryAll(env) {
  const pages = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}`);
    const data = await res.json();
    pages.push(...data.results);
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// Property lookup is case-insensitive so small renames in Notion don't break the site.
function prop(page, name) {
  const wanted = name.toLowerCase();
  for (const key of Object.keys(page.properties || {})) {
    if (key.toLowerCase() === wanted) return page.properties[key];
  }
  return null;
}

function text(arr) {
  return (arr || []).map((t) => t.plain_text).join('').trim();
}

function names(p) {
  if (!p) return [];
  if (p.type === 'multi_select') return p.multi_select.map((o) => o.name);
  if (p.type === 'select') return p.select ? [p.select.name] : [];
  if (p.type === 'status') return p.status ? [p.status.name] : [];
  return [];
}

function first(p) {
  return names(p)[0] || '';
}

function plain(p) {
  if (!p) return '';
  if (p.type === 'rich_text') return text(p.rich_text);
  if (p.type === 'title') return text(p.title);
  return first(p);
}

// Tags in Notion are free text; map them onto the site's four categories.
function typeFor(tags, competition) {
  const t = tags.join(' ').toLowerCase();
  if (/train|session|fitness|gym/.test(t)) return 'training';
  if (/match|fixture|game|bucs|lusl|varsity|league|cup/.test(t)) return 'match';
  if (/social|pub|formal|dinner|night/.test(t)) return 'social';
  if (competition) return 'match';
  return 'special';
}

function toEvent(page) {
  const hide = prop(page, 'Hide from website');
  if (hide && hide.type === 'checkbox' && hide.checkbox) return null;

  const date = prop(page, 'Date');
  if (!date || date.type !== 'date' || !date.date || !date.date.start) return null;

  const title = plain(prop(page, 'Name')) || 'Untitled event';
  const tags = names(prop(page, 'Tags'));
  const competition = first(prop(page, 'Competition Type'));

  const homeAway = first(prop(page, 'Home/Away')) || (title.match(/\((home|away)\)\s*$/i) || [])[1] || '';
  const tagText = tags.join(' ');
  const numbered = tagText.match(/\b([123])(?:st|nd|rd|s)\b/i);
  const team = numbered ? numbered[1] + 's' : /\blusl\b/i.test(tagText) ? 'LUSL' : '';

  return {
    id: page.id,
    title,
    start: date.date.start,
    end: date.date.end || null,
    allDay: date.date.start.length <= 10,
    tags,
    type: typeFor(tags, competition),
    location: plain(prop(page, 'Location')),
    competition,
    homeAway: homeAway ? homeAway[0].toUpperCase() + homeAway.slice(1).toLowerCase() : '',
    team,
    opponent: title.replace(/\s*\((home|away)\)\s*$/i, '').trim(),
  };
}

function json(body, status, cacheable) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheable ? `public, max-age=60, s-maxage=${CACHE_SECONDS}` : 'no-store',
    },
  });
}
