"""Compare the new independent building masks with the grouped selection pass.

The baseline comes from the last saved grouped-map commit, without checking it
out or writing its binary masks into the workspace. This comparison supplements
validate_rays.py and does not edit the approved scene or public assets.
"""
import json
import io
import subprocess
from collections import Counter
from pathlib import Path

import numpy as np

WORK = Path(__file__).resolve().parent / 'output'
REPOSITORY = WORK.parents[3]
BASELINE = '861dc79'


def baseline_file(name):
    return subprocess.check_output(['git', 'show', f'{BASELINE}:prototypes/campus-map/interactive/output/{name}'], cwd=REPOSITORY)


before = json.loads(baseline_file('mask-source.json'))
after = json.loads((WORK / 'mask-source.json').read_text(encoding='utf-8'))
old_labels = np.load(io.BytesIO(baseline_file('semantic-labels.npy')))
new_labels = np.load(WORK / 'semantic-labels.npy')
assert before['source_blend_sha256'] == after['source_blend_sha256']
assert before['source_render_sha256'] == after['source_render_sha256']
assert before['camera'] == after['camera']
old_ids = {r['id']: i for i, r in enumerate(before['regions'], 1)}
new_ids = {r['id']: i for i, r in enumerate(after['regions'], 1)}
blocks = {'bloque-1', 'bloque-2', 'bloque-3', 'bloque-4', 'bloque-atravesado'}
assert blocks <= new_ids.keys() and 'bloques-salones' not in new_ids
old_group = old_labels == old_ids['bloques-salones']
new_group = np.isin(new_labels, [new_ids[k] for k in blocks])


def overlap(a, b):
    return float(np.logical_and(a, b).sum() / np.logical_or(a, b).sum())


group_iou = overlap(old_group, new_group)
assert group_iou > .999, 'Classroom selection surface changed beyond the split'
unchanged = {key: round(overlap(old_labels == index, new_labels == new_ids[key]), 6)
             for key, index in old_ids.items() if key != 'bloques-salones'}
assert min(unchanged.values()) > .999
counts = Counter(after['classroom_lattice_owners'].values())
assert set(counts) == blocks - {'bloque-atravesado'}
assert set(counts.values()) == {102}, 'A classroom facade screen lost its owner'
report = {'passed': True, 'baseline_commit': BASELINE, 'source_unchanged': True, 'camera_unchanged': True,
          'old_classroom_pixels': int(old_group.sum()), 'new_classroom_pixels': int(new_group.sum()),
          'classroom_union_iou': round(group_iou, 6), 'other_region_iou': unchanged,
          'lattice_objects_by_block': dict(counts),
          'independent_blocks': {key: int((new_labels == new_ids[key]).sum()) for key in sorted(blocks)}}
(WORK / 'independent-blocks-validation.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('INDEPENDENT_BLOCKS_OK ' + json.dumps(report))
