import json
import hashlib
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

here = Path(__file__).resolve().parent
verification = json.loads((here / 'verification.json').read_text(encoding='utf-8'))
target = Path(verification['finalPath'])
ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(target) as book:
    shared = []
    if 'xl/sharedStrings.xml' in book.namelist():
        shared = [''.join(n.itertext()) for n in ET.fromstring(book.read('xl/sharedStrings.xml')).findall('s:si', ns)]
    def value(cell):
        inline = cell.find('s:is', ns)
        if inline is not None:
            return ''.join(inline.itertext())
        raw = cell.find('s:v', ns)
        text = raw.text if raw is not None else ''
        return shared[int(text)] if cell.attrib.get('t') == 's' else text
    sheets = ET.fromstring(book.read('xl/workbook.xml')).findall('s:sheets/s:sheet', ns)
    assert len(sheets) == 10, f'Expected 10 sheets, got {len(sheets)}'
    result = {'output': str(target), 'sheets': [], 'formulaCells': 0, 'nativeFeatureChecks': []}
    rows_by_name = {}
    sheet_meta={s['name']:s for s in verification['sheets']}
    for index, sheet in enumerate(sheets, 1):
        root = ET.fromstring(book.read(f'xl/worksheets/sheet{index}.xml'))
        view = root.find('s:sheetViews/s:sheetView', ns)
        pane = view.find('s:pane', ns)
        assert pane is not None and pane.attrib.get('state') == 'frozen', f'{sheet.attrib["name"]}: missing frozen pane'
        header_row=sheet_meta[sheet.attrib['name']]['headerRow']
        assert float(pane.attrib.get('ySplit', 0)) == header_row, f'{sheet.attrib["name"]}: header row freeze missing'
        assert float(pane.attrib.get('xSplit', 0)) >= 2, f'{sheet.attrib["name"]}: identity column freeze missing'
        assert view.attrib.get('showGridLines') in ('0', 'false'), 'Gridlines unexpectedly visible'
        table_parts = root.findall('s:tableParts/s:tablePart', ns)
        assert len(table_parts) == 1, 'Expected one native filter table per sheet'
        validations = root.findall('s:dataValidations/s:dataValidation', ns)
        assert any(v.attrib.get('type') == 'list' for v in validations), 'Missing editable status validation'
        rows = []
        for row in root.findall('s:sheetData/s:row', ns):
            assert float(row.attrib.get('ht', 0)) <= 409.5, 'Excel row height limit exceeded'
            values = {''.join(filter(str.isalpha, c.attrib['r'])): value(c) for c in row.findall('s:c', ns)}
            rows.append({'row': int(row.attrib['r']), 'values': values})
            result['formulaCells'] += len(row.findall('s:c/s:f', ns))
        rows_by_name[sheet.attrib['name']] = rows
        result['sheets'].append({'name': sheet.attrib['name'], 'frozenRows': header_row, 'frozenColumns': float(pane.attrib['xSplit']), 'tableCount': 1, 'statusValidationCount': len(validations)})
    tables = [p for p in book.namelist() if p.startswith('xl/tables/table') and p.endswith('.xml')]
    assert len(tables) == 10
    for name in tables:
        assert ET.fromstring(book.read(name)).find('s:autoFilter', ns) is not None, f'{name}: no native filter'
    pages = json.loads((here.parent / 'pages/pages.json').read_text(encoding='utf-8-sig'))
    art_tabs = ['美术_入口基地', '美术_探索事件', '美术_战斗结算', '美术_工具研究所']
    written_page_ids = {r['values'].get('A') for tab in art_tabs for r in rows_by_name[tab] if r['row'] >= 6}
    assert written_page_ids == {p['id'] for p in pages['pages']}, 'Saved page identifiers differ from source'
    written_variant_ids = {r['values'].get('A') for r in rows_by_name['变体差异'] if r['row'] >= 6}
    assert written_variant_ids == {v['id'] for v in pages['variants']}, 'Saved variant identifiers differ from source'
    main_rows = rows_by_name['总体计划']
    assert all(any(term in r['values'].get('B','') for r in main_rows if 5<=r['row']<=10) for term in ['可先独立做的小修','首脑日志','AMMO图解','供给页','NOTES-CLEAR','不用等待完整存档']), 'Missing independent quick-fix block'
    for system_id, expected in [('SYS-15', '已修复·保持'), ('SYS-19', '冻结·不排期'), ('SYS-04', '先验证'), ('SYS-05', '先验证')]:
        matches = [r for r in main_rows if r['values'].get('B') == system_id and r['values'].get('N')]
        assert matches and matches[0]['values']['N'] == expected, f'{system_id}: incorrect current status'
        if system_id in ['SYS-15', 'SYS-19']:
            assert not matches[0]['values'].get('A'), f'{system_id}: incorrectly scheduled as new implementation'
    systems=json.loads((here.parent/'systems/systems.json').read_text(encoding='utf-8-sig'))['systems']
    rank={r['values']['B']:float(r['values']['A']) for r in main_rows if r['row']>12 and r['values'].get('A')}
    for system in systems:
        for dep in system['dependencies']:
            if dep in rank and system['id'] in rank:
                assert rank[dep]<rank[system['id']], f'{system["id"]}: hard dependency not respected'
    assert result['formulaCells'] == 0, 'Static plan unexpectedly contains formulas'
    result['coverage'] = {'pages': len(written_page_ids), 'variants': len(written_variant_ids)}
    result['nativeFeatureChecks'] = ['10 named sheets', 'native table filters', 'frozen rows and identity columns', 'editable status list validation', 'gridlines hidden', 'row heights within Excel limit', 'all source page and variant IDs retained', 'maintenance/frozen/verify-first statuses preserved']
result['sha256'] = hashlib.sha256(target.read_bytes()).hexdigest()
assert result['sha256'] == verification['sha256']
(here / 'saved-xlsx-verification.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'sheets': len(result['sheets']), 'pages': result['coverage']['pages'], 'variants': result['coverage']['variants'], 'formulaCells': result['formulaCells'], 'sha256': result['sha256']}, ensure_ascii=False))
