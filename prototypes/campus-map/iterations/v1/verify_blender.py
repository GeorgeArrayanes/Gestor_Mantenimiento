"""Small real render before constructing the campus; run with Blender's Python."""
import bpy
import json
from pathlib import Path

root = Path(__file__).resolve().parent
out = root / 'output'
out.mkdir(exist_ok=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 4
scene.render.resolution_x = 128
scene.render.resolution_y = 128
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(out / 'render-probe.png')
report = {'blender': bpy.app.version_string, 'devices': [], 'attempts': []}
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'CUDA'
    prefs.get_devices()
    for device in prefs.devices:
        report['devices'].append({'name': device.name, 'type': device.type})
        device.use = device.type == 'CUDA'
    has_gpu = any(d['type'] == 'CUDA' for d in report['devices'])
except Exception as exc:
    has_gpu = False
    report['device_error'] = str(exc)
for mode in (['GPU', 'CPU'] if has_gpu else ['CPU']):
    try:
        scene.cycles.device = mode
        bpy.ops.render.render(write_still=True)
        report['attempts'].append({'device': mode, 'success': True})
        report['render_device'] = mode
        break
    except Exception as exc:
        report['attempts'].append({'device': mode, 'success': False, 'error': str(exc)})
else:
    (out / 'blender-diagnostics.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    raise RuntimeError('Both GPU and CPU render probes failed.')
(out / 'blender-diagnostics.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print('BLENDER_PROBE ' + json.dumps(report))
