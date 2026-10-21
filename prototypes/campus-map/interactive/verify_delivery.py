"""Read-only integrity gate for the approved artwork and Stage A derivatives."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'interactive' / 'output'
PUBLIC = ROOT.parents[1] / 'frontend' / 'public' / 'campus-map'
manifest = json.loads((ROOT / 'output' / 'render-manifest.json').read_text())['overview']
checks = []


def check_file(path, expected):
    actual = hashlib.sha256(path.read_bytes()).hexdigest()
    assert actual == expected, f'Integrity mismatch: {path}'
    checks.append({'file': str(path.relative_to(ROOT.parents[1])), 'sha256': actual})


for name, field in [
    ('build_scene.py', 'script_sha256'), ('refine_scene.py', 'refinement_sha256'),
    ('campus_geometry.py', 'geometry_sha256'), ('corrected_zones.py', 'zones_sha256'),
    ('layout.json', 'layout_sha256'),
]:
    check_file(ROOT / name, manifest[field])
check_file(ROOT / 'output' / 'overview.png', 'f881ad7af6acc20a7a5da6d75fb9d1e470ed7b3b5cbc3e8f664ecaa1dcde799d')
check_file(ROOT / 'output' / 'arrayanes-campus.blend', '8b4a1b7e16fa6e8d18df9733b5b9ab2d66ef9839c5427f6c787dc5c18d1c1f08')

assets = json.loads((OUT / 'asset-validation.json').read_text())
for item in assets['assets']:
    check_file(PUBLIC / item['name'], item['sha256'])
regions = json.loads((PUBLIC / 'regions.json').read_text(encoding='utf-8'))
assert (regions['width'], regions['height'], regions['sourceIteration']) == (3200, 2200, 5)
assert len(regions['regions']) == len({item['id'] for item in regions['regions']}) == 16
assert min(item['vector_pixel_iou'] for item in assets['regions']) > .999
rays = json.loads((OUT / 'raycast-validation.json').read_text())
assert rays['passed'] and rays['mismatch_count'] == 0 and rays['samples'] == 2760
for screenshot in ['qa-desktop-map.jpg', 'qa-mobile-map.jpg']:
    assert (OUT / screenshot).stat().st_size > 10000

report = {'passed': True, 'approved_iteration': 5, 'files': checks,
          'regions': 16, 'ray_samples': rays['samples'], 'ray_mismatches': 0,
          'vector_min_iou': min(item['vector_pixel_iou'] for item in assets['regions'])}
(OUT / 'delivery-verification.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('DELIVERY_INTEGRITY_OK ' + json.dumps({'files': len(checks), 'regions': 16}))
