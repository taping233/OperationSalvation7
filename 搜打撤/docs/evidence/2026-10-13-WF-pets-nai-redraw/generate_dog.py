import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).absolute().parents[3]
sys.path.insert(0, str(ROOT / 'tools'))

from nai_gen import ENDPOINT, generate_image
from nai_style import RECIPE_VERSION, build_asset_prompt, build_uc

out_dir = Path(__file__).absolute().parent
subject = (
    'One original fantasy expedition companion dog, an unmistakable young dog rather than a fox, wolf, or human. '
    'Compact athletic body, warm ivory fur with charcoal gray patches, one charcoal floppy ear and one perked ear, '
    'soft amber-brown eyes, small black nose, friendly alert expression. '
    'A simple worn ochre leather collar with a tiny triangular metal tag. '
    'The dog turns toward the viewer while lifting one front paw as if ready to accompany an expedition. '
    'No human hair, clothes, goggles, blue eyes, or fangs.'
)
prompt = build_asset_prompt(
    subject,
    purpose_layer='Standalone game companion character illustration for a large personnel selection panel. A memorable creature identity, not a UI icon.',
    composition_layer='One complete dog, including all four paws, both ears and the full tail, centered with ample margins on a plain warm gray background. Three-quarter view, strong clean silhouette, face legible at thumbnail size. No scene, ground props, typography, border, or circular badge.',
    light_material_layer='Restrained cool light from upper left, warm ivory fur and charcoal gray shadow masses; three or four broad opaque value groups, selective detail around the face and collar, painterly fur as directional brush strokes rather than many pointed triangles.'
)
uc = build_uc('human, humanoid, fox, wolf, cat, blue eyes, fangs, sharp teeth, giant eyes, chibi proportions, glossy plastic fur, 3d render, photorealism, scenery, pedestal, circle frame, cropped tail, cropped feet')
(out_dir / 'nai-request.json').write_text(json.dumps({'model':'nai-diffusion-4-5-full','recipe':RECIPE_VERSION,'width':1024,'height':1024,'prompt':prompt,'uc':uc,'naiImageReferences':[]}, ensure_ascii=False, indent=2), encoding='utf-8')
def traced_transport(payload_file, zip_file, token, channel):
    arguments = ['curl'] + channel + ['-sS', '--ssl-no-revoke', '--max-time', '240',
        '-H', 'Authorization: Bearer ' + token, '-H', 'Content-Type: application/json',
        '-w', '%{http_code}', '-o', str(zip_file), '--data-binary', '@' + str(payload_file), ENDPOINT]
    result = subprocess.run(arguments, shell=False, capture_output=True, text=True)
    diagnostic = result.stderr.replace(token, '[REDACTED]').strip()
    print(json.dumps({'channel':channel[0], 'curlExitCode':result.returncode,
        'curlError':diagnostic[-500:]}, ensure_ascii=False), flush=True)
    return result.stdout.strip()

path, seed = generate_image(prompt, uc, width=1024, height=1024, out=out_dir / 'nai-dog-v1.png', transport=traced_transport)
print(json.dumps({'path':str(path),'seed':seed}, ensure_ascii=False))
