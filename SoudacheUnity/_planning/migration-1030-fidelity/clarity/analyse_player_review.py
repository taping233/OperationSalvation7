from pathlib import Path
import hashlib
import json
import sys
from PIL import Image

directory = Path(sys.argv[1]).resolve()
result = json.loads((directory / 'result.json').read_text(encoding='utf-8-sig'))
process = json.loads((directory / 'process.json').read_text(encoding='utf-8-sig'))
assert result['passed'] and process['exitCode'] == 0
assert (not process['host']['visible'] and not process['child']['visible']) or (process.get('transparentCompositor') and process.get('zeroAlphaAndNonactivating')), 'Review host must remain visually invisible and nonactivating'
assert result['display']['screenWidth'] == process['host']['clientWidth'] and result['display']['screenHeight'] == process['host']['clientHeight'], 'Backbuffer differs from real current client'
assert result['display']['canvas']['mode'] == 'ScreenSpaceOverlay' and result['display']['canvas']['scaler'] == 'ScaleWithScreenSize', 'Review changed production canvas mode'
assert result['display']['bufferWidthScale'] == 1 and result['display']['bufferHeightScale'] == 1, 'Dynamic backbuffer downsampling is active'
records = {record['name']:record for record in result['records'] if record['kind'] == 'actual-player-capture'}
legacy = records['player-card-legacy-density']
native = records['player-card-native-density']
samples = []
for path in sorted({text['path'] for text in legacy['text']}):
    before = next(text for text in legacy['text'] if text['path'] == path)
    after = next(text for text in native['text'] if text['path'] == path)
    same_content = before.get('sourceValue',before['value']) == after.get('sourceValue',after['value'])
    same_box = before['screenBounds'] == after['screenBounds'] and before['width'] == after['width'] and before['height'] == after['height']
    same_viewport = before.get('viewportBounds') == after.get('viewportBounds') and before['width'] == after['width']
    same_host = before.get('layoutHostBounds',before.get('viewportBounds')) == after.get('layoutHostBounds',after.get('viewportBounds'))
    same_settings = before['fontSize'] == after['fontSize'] and before['lineSpacing'] == after['lineSpacing'] and before['font'] == after['font']
    old_starts = [line['startCharIdx'] for line in before['lines']]
    new_starts = [line['startCharIdx'] for line in after['lines']]
    old_tops = [line['logicalTop'] for line in before['lines']]
    new_tops = [line['logicalTop'] for line in after['lines']]
    samples.append({'path':path,'text':before.get('sourceValue',before['value']),'renderedBefore':before['value'],'renderedAfter':after['value'],'sameContent':same_content,'sameRect':same_box,'sameViewport':same_viewport,'sameLayoutHost':same_host,'sameFontSettings':same_settings,
                    'lineStartsBefore':old_starts,'lineStartsAfter':new_starts,
                    'logicalLineTopsBefore':old_tops,'logicalLineTopsAfter':new_tops,
                    'glyphDensityBefore':before['glyphPixelsPerUnit'],'glyphDensityAfter':after['glyphPixelsPerUnit'],
                    'requestedFontPixelsBefore':before['fontSize']*before['glyphPixelsPerUnit'],
                    'requestedFontPixelsAfter':after['fontSize']*after['glyphPixelsPerUnit']})
    if '/rules/' in path:
        rect = after.get('viewportBounds',after['screenBounds'])
        with Image.open(directory / 'player-card-native-density.png') as source:
            height = source.height
            crop = (max(0,int(rect['minX'])-4),max(0,int(height-rect['maxY'])-4),
                    min(source.width,int(rect['maxX'])+5),min(source.height,int(height-rect['minY'])+5))
        for suffix in ('legacy','native'):
            with Image.open(directory / ('player-card-'+suffix+'-density.png')) as source:
                source.crop(crop).save(directory / ('card-rules-'+suffix+'-actual-pixels.png'))
image_records = []
for name in records:
    path = directory / (name+'.png')
    with Image.open(path) as image:
        png_size = image.size
    metadata = records[name]['display']
    image_records.append({'name':name,'width':png_size[0],'height':png_size[1],
                          'matchesActualBackbuffer':list(png_size)==[metadata['screenWidth'],metadata['screenHeight']],
                          'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
report = {'passed':all(sample['sameContent'] and sample['sameLayoutHost'] and sample['sameFontSettings'] for sample in samples)
                    and any(sample['glyphDensityAfter'] > sample['glyphDensityBefore'] * 1.4 for sample in samples)
                    and all(image['matchesActualBackbuffer'] for image in image_records),
          'scope':'Actual standalone native backbuffer. Source content/font/outer layout host invariance; adaptive scrollbar viewport, rendered line breaks, text height and baseline differences are exposed, not silently accepted. Crops preserve native pixels; visual sharpness needs independent viewing.',
          'process':process,'samples':samples,'images':image_records}
(directory/'density-comparison.json').write_text(json.dumps(report,ensure_ascii=True,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'samples':len(samples),'changedLineStarts':sum(sample['lineStartsBefore']!=sample['lineStartsAfter'] for sample in samples)},ensure_ascii=True))
