import os, re

OUT = os.path.dirname(os.path.abspath(__file__))

URLS = {
    'index.html': 'https://claude.ai/code/artifact/a374a489-4830-4722-b49c-85593dd1527f',
    'hockey.html': 'https://claude.ai/code/artifact/1db5db2c-2afe-4d75-bf63-3eaf0a24b78e',
    'calendar.html': 'https://claude.ai/code/artifact/30848d87-fad7-4e3f-a323-e92285aa178a',
    'links.html': 'https://claude.ai/code/artifact/86317217-d68a-46f0-9a0c-78379e7045d1',
    'committee.html': 'https://claude.ai/code/artifact/55a65390-8651-4a7e-aee8-fc721e2669ce',
    'gallery.html': 'https://claude.ai/code/artifact/34c2557c-c6e3-4cc9-90d7-edc14e112616',
}

for page, own_url in URLS.items():
    path = os.path.join(OUT, page)
    with open(path, encoding='utf-8') as f:
        html = f.read()

    def repl(m):
        target_page = m.group(1)
        anchor = m.group(2) or ''
        url = URLS.get(target_page, target_page)
        return f'href="{url}{anchor}"'

    # href="somepage.html" or href="somepage.html#anchor" -> href="<artifact url>#anchor"
    html = re.sub(r'href="([a-z]+\.html)(#[a-zA-Z0-9_-]+)?"', repl, html)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(page, '-> relinked')
