import zipfile, xml.etree.ElementTree as ET, json
from collections import Counter

z = zipfile.ZipFile('d:/Darse Burhani/public/Makhtabat Books.xlsx')

shared_strings = []
if 'xl/sharedStrings.xml' in z.namelist():
    tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        texts = [t.text or '' for t in si.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')]
        shared_strings.append(''.join(texts))

tree = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
rows = []
for row in tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
    r_data = []
    for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
        t = c.get('t')
        v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
        val = v.text if v is not None else ''
        if t == 's' and val.isdigit():
            val = shared_strings[int(val)]
        r_data.append(val)
    if any(r_data):
        rows.append(r_data)

books = []
for i, r in enumerate(rows[1:], 2):
    title = r[0].strip() if len(r) > 0 else ''
    genre = r[1].strip() if len(r) > 1 else ''
    if title:
        books.append({'excel_row': i, 'title': title, 'genre': genre})

genres = Counter([b['genre'] for b in books])
print('Total books in Excel:', len(books))
print('Genre counts:')
for g, c in sorted(genres.items()):
    print('  ' + g + ': ' + str(c))

seen = set()
print()
print('Sample books per genre:')
for b in books:
    g = b['genre']
    if g not in seen:
        seen.add(g)
        print('  [' + g + '] Row ' + str(b['excel_row']) + ': ' + b['title'])

with open('d:/Darse Burhani/public/excel_books_all.json', 'w', encoding='utf-8') as f:
    json.dump(books, f, indent=2, ensure_ascii=False)
print()
print('Saved ' + str(len(books)) + ' books to excel_books_all.json')
