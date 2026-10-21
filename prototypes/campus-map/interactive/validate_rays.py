"""Independently compare pixel-centre camera rays with the exported ID raster.

Blender 4.5 command: blender -b --python-exit-code 1 --python validate_rays.py
This reads the approved scene without saving it, generates no render, and does
not change masks. Curves/fonts are evaluated to triangles so roof seams, field
markings and text participate in visibility alongside the original meshes.
"""
import hashlib
import json
import math
from pathlib import Path
import time

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


ROOT = Path(__file__).resolve().parents[1]
WORK = ROOT / 'interactive' / 'output'
SOURCE = ROOT / 'output' / 'arrayanes-campus.blend'
REPORT = WORK / 'raycast-validation.json'
SEED = 20261016
PER_REGION = 160
BACKGROUND_SAMPLES = 200


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def erode(mask, radius=2):
    result = mask.copy()
    padded = np.pad(mask, radius, constant_values=False)
    height, width = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            result &= padded[radius + dy:radius + dy + height,
                             radius + dx:radius + dx + width]
    return result


def dilate(mask, radius=8):
    result = np.zeros_like(mask)
    padded = np.pad(mask, radius, constant_values=False)
    height, width = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            result |= padded[radius + dy:radius + dy + height,
                             radius + dx:radius + dx + width]
    return result


def stratified(mask, count, rng):
    """Select across a 4x4 grid of each mask's bounds, then fill the quota."""
    points = np.argwhere(mask)
    if len(points) <= count:
        return points
    low = points.min(axis=0)
    span = points.max(axis=0) - low + 1
    cell = np.minimum(3, (points - low) * 4 // span)
    cells = cell[:, 0] * 4 + cell[:, 1]
    occupied = np.unique(cells)
    quota = max(1, count // len(occupied))
    chosen = []
    for index in occupied:
        candidates = np.flatnonzero(cells == index)
        chosen.extend(rng.choice(candidates, min(quota, len(candidates)), replace=False).tolist())
    chosen_set = set(chosen)
    remaining = np.array([i for i in range(len(points)) if i not in chosen_set])
    if len(chosen) < count:
        chosen.extend(rng.choice(remaining, count - len(chosen), replace=False).tolist())
    return points[np.array(chosen[:count], dtype=int)]


started = time.monotonic()
metadata = json.loads((WORK / 'mask-source.json').read_text(encoding='utf-8'))
labels = np.load(WORK / 'semantic-labels.npy')
height, width = labels.shape
assert (width, height) == (metadata['width'], metadata['height'])
before_hash = digest(SOURCE)
assert before_hash == metadata['source_blend_sha256'], 'Approved blend differs from the mask source'
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
camera = scene.camera
assert camera.data.type == 'ORTHO'
expected = metadata['camera']
assert abs(camera.data.ortho_scale - expected['ortho_scale']) < 1e-5
assert max(abs(a-b) for a, b in zip(camera.location, expected['location'])) < 1e-5
assert max(abs(a-b) for a, b in zip(camera.rotation_euler, expected['rotation_radians'])) < 1e-5
scene.render.resolution_x = width
scene.render.resolution_y = height
scene.render.resolution_percentage = 100
assert scene.render.pixel_aspect_x == scene.render.pixel_aspect_y
assert not scene.render.use_border
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()

index_for_id = {region['id']: index for index, region in enumerate(metadata['regions'], 1)}
assignments = metadata['object_assignments']
vertices = []
triangles = []
triangle_objects = []
object_names = []
object_labels = []
geometry_types = {}
skipped = []

for obj in scene.objects:
    if obj.type not in {'MESH', 'CURVE', 'FONT', 'SURFACE', 'META'} or obj.hide_render:
        continue
    if hasattr(obj, 'visible_camera') and not obj.visible_camera:
        continue
    evaluated = obj.evaluated_get(depsgraph)
    evaluated_mesh = evaluated.to_mesh(preserve_all_data_layers=False, depsgraph=depsgraph)
    if evaluated_mesh is None:
        skipped.append(obj.name)
        continue
    try:
        evaluated_mesh.calc_loop_triangles()
        if not evaluated_mesh.loop_triangles:
            skipped.append(obj.name)
            continue
        object_index = len(object_names)
        object_names.append(obj.name)
        object_labels.append(index_for_id.get(assignments.get(obj.name), 0))
        geometry_types[obj.type] = geometry_types.get(obj.type, 0) + 1
        offset = len(vertices)
        matrix = evaluated.matrix_world
        vertices.extend(matrix @ v.co for v in evaluated_mesh.vertices)
        for triangle in evaluated_mesh.loop_triangles:
            triangles.append(tuple(offset + i for i in triangle.vertices))
            triangle_objects.append(object_index)
    finally:
        evaluated.to_mesh_clear()

bvh = BVHTree.FromPolygons(vertices, triangles, all_triangles=True, epsilon=0.0)
frame = camera.data.view_frame(scene=scene)
min_x, max_x = min(v.x for v in frame), max(v.x for v in frame)
min_y, max_y = min(v.y for v in frame), max(v.y for v in frame)
matrix = camera.matrix_world
direction = (matrix.to_3x3() @ Vector((0, 0, -1))).normalized()


def camera_ray(x, y):
    # Raster origin is top-left. Samples are centred on integer pixel cells.
    local = Vector((min_x + (x + .5) / width * (max_x-min_x),
                    max_y - (y + .5) / height * (max_y-min_y),
                    -camera.data.clip_start))
    return matrix @ local, direction


def first_hit(origin, ray_direction):
    location, normal, face, distance = bvh.ray_cast(origin, ray_direction, camera.data.clip_end)
    if face is None:
        return 0, None, None, None
    object_index = triangle_objects[face]
    return object_labels[object_index], object_names[object_index], location, float(distance)


rng = np.random.default_rng(SEED)
sets = []
for index, region in enumerate(metadata['regions'], 1):
    mask = labels == index
    interior = erode(mask, 2)
    assert int(interior.sum()) >= PER_REGION, 'Insufficient interior pixels: ' + region['id']
    sets.append((index, region['id'], stratified(interior, PER_REGION, rng), int(interior.sum())))
near_objects = dilate(labels != 0, 8) & erode(labels == 0, 2)
sets.append((0, 'nonselectable-near-regions', stratified(near_objects, BACKGROUND_SAMPLES, rng), int(near_objects.sum())))

summary = []
mismatches = []
occlusion_examples = []
occlusion_counts = {}
for expected_label, region_id, points, candidates in sets:
    hits = {}
    mismatch_count = 0
    for y, x in points:
        x, y = int(x), int(y)
        origin, ray_direction = camera_ray(x, y)
        actual, name, location, distance = first_hit(origin, ray_direction)
        hits[name or '<no geometry>'] = hits.get(name or '<no geometry>', 0) + 1
        if actual != expected_label:
            mismatch_count += 1
            mismatches.append({'pixel': [x, y], 'raster_region': region_id,
                               'raster_label': expected_label, 'ray_label': actual,
                               'front_object': name, 'distance': distance})
        # Demonstrate genuine occlusion by continuing through front triangles.
        # This is diagnostic only and does not modify any expected labels.
        occlusion_limit = 20 if actual == 0 else 8
        if location is not None and occlusion_counts.get(actual, 0) < occlusion_limit:
            current = location
            for _ in range(32):
                behind, behind_name, behind_point, _ = first_hit(current + ray_direction * .001, ray_direction)
                if behind_point is None:
                    break
                if behind != actual and behind != 0:
                    occlusion_examples.append({'pixel': [x, y], 'visible_label': actual,
                                               'visible_object': name, 'occluded_label': behind,
                                               'occluded_object': behind_name})
                    occlusion_counts[actual] = occlusion_counts.get(actual, 0) + 1
                    break
                current = behind_point
    summary.append({'id': region_id, 'label': expected_label, 'interior_candidates': candidates,
                    'samples': len(points), 'mismatches': mismatch_count,
                    'front_objects': dict(sorted(hits.items(), key=lambda item: -item[1]))})

after_hash = digest(SOURCE)
assert before_hash == after_hash, 'Approved blend was unexpectedly changed'
report = {
    'passed': not mismatches,
    'method': 'Independent world-space BVH raycast of evaluated scene geometry, including tessellated bevelled curves and fonts; no render and no scene save.',
    'coordinate_contract': {'width': width, 'height': height, 'origin': 'top-left',
                            'sample': 'pixel centre (x+0.5,y+0.5)', 'projection': 'ORTHO',
                            'interior_margin_pixels': 2, 'camera_frame_local': [min_x, min_y, max_x, max_y]},
    'source_blend_sha256': before_hash,
    'source_unchanged': before_hash == after_hash,
    'labels_sha256': digest(WORK / 'semantic-labels.npy'),
    'id_png_sha256': digest(WORK / 'semantic-ids.png'),
    'camera': expected,
    'seed': SEED,
    'geometry': {'objects': len(object_names), 'by_original_type': geometry_types,
                 'vertices': len(vertices), 'triangles': len(triangles), 'skipped_empty': skipped},
    'samples': sum(item['samples'] for item in summary),
    'mismatch_count': len(mismatches),
    'regions': summary,
    'mismatches': mismatches,
    'occlusion_examples': occlusion_examples,
    'selection_material_policy': 'Glazing is treated as the front opaque geometric surface, matching the semantic pass rather than refracting photographic artwork.',
    'limitations': 'Sampling verifies alignment and visibility; it is not an exhaustive per-pixel proof. Two-pixel label-interior samples avoid stochastic single-sample antialias boundaries.',
    'seconds': round(time.monotonic() - started, 3),
}
REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('RAYCAST_VALIDATION ' + json.dumps({'passed': report['passed'], 'samples': report['samples'],
                                       'mismatches': report['mismatch_count'], 'objects': len(object_names),
                                       'triangles': len(triangles), 'source_unchanged': True,
                                       'seconds': report['seconds']}), flush=True)
