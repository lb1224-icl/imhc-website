import base64, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, 'assets')
FONTS = os.path.join(ASSETS, 'fonts')
OUT = os.path.dirname(os.path.abspath(__file__))

# 1. Build CSS with fonts inlined as base64 data URIs
with open(os.path.join(ASSETS, 'styles.css'), encoding='utf-8') as f:
    css = f.read()

def embed_font(m):
    fname = m.group(1)
    path = os.path.join(FONTS, fname)
    with open(path, 'rb') as fh:
        b64 = base64.b64encode(fh.read()).decode('ascii')
    return f"url(data:font/woff2;base64,{b64})"

css_inlined = re.sub(r"url\('fonts/([^']+\.woff2)'\)", embed_font, css)

with open(os.path.join(OUT, 'inlined.css'), 'w', encoding='utf-8') as f:
    f.write(css_inlined)

# 2. Read site.js
with open(os.path.join(ASSETS, 'site.js'), encoding='utf-8') as f:
    site_js = f.read()

pages = ['index.html', 'hockey.html', 'calendar.html', 'links.html', 'committee.html', 'gallery.html']

for page in pages:
    with open(os.path.join(ROOT, page), encoding='utf-8') as f:
        html = f.read()

    html = html.replace(
        '<link rel="stylesheet" href="assets/styles.css">',
        f'<style>\n{css_inlined}\n</style>'
    )
    html = html.replace(
        '<script src="assets/site.js" defer></script>',
        f'<script>\n{site_js}\n</script>'
    )

    out_path = os.path.join(OUT, page)
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"{page}: {size_kb:.1f} KB")
