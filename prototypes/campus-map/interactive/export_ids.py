"""Derivative selection pass. Opens the approved scene; never saves the .blend.

Run with Blender 4.5: blender -b --python export_ids.py
All original surfaces occlude, including nonselectable objects. Glazing owns
its front surface in this pass, so it is intentionally opaque for selection.
"""
import bpy
import colorsys
import hashlib
import json
import math
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'interactive'/'output'
OUT.mkdir(exist_ok=True)
SOURCE=ROOT/'output'/'arrayanes-campus.blend'
CATALOG=[
    ('administrativo','Edificio Administrativo','building',['4:37']),
    ('bloques-salones','Conjunto de salones','building',['4:15','4:17','4:19','4:21','4:23']),
    ('preescolar','Preescolar','building',['4:33']),
    ('bachillerato','Bachillerato','building',['4:25']),
    ('transicion','Transición','building',['4:27']),
    ('grado-11','Salones de grado 11','building',['4:45']),
    ('comedor','Comedor','building',['4:13']),
    ('economato','Economato','building',['4:41']),
    ('primeros-auxilios','Primeros auxilios','building',['4:29']),
    ('danzas-1','Danzas 1','building',['4:55']),
    ('danzas-2','Danzas 2','building',['4:69']),
    ('tienda-1','Tienda 1','building',['4:35']),
    ('gym','GYM al aire libre','outdoor',['4:47']),
    ('futbol-principal','Cancha de fútbol principal','outdoor',['4:9']),
    ('futbol-norte','Cancha de fútbol norte','outdoor',['4:43']),
    ('patio-central','Patio central y canchas','outdoor',['4:6']),
]


def classify(obj):
    n=obj.name
    if n.startswith('administrativo.') and not n.startswith(('administrativo.entry paving','administrativo.linear drainage')):
        return 'administrativo'
    if n.startswith(('Administrativo · escudo GLA','GLA lettering')): return 'administrativo'
    if n.startswith(('salones.','bloque-2.','bloque-3.','bloque-4.','bloque-atravesado.')) and '.paved apron' not in n:
        return 'bloques-salones'
    if n.startswith('Decorative diagonal') and any(c.name.startswith(('02 ·','05 ·')) for c in obj.users_collection):
        return 'bloques-salones'
    if n.startswith('Preescolar') and not n.startswith(('Preescolar irregular base','Preescolar continuous V play floor','Preescolar blue learning track','Preescolar track center marking','Preescolar crossing','Preescolar colored seat','Preescolar planted edge')):
        return 'preescolar'
    if n.startswith(('bachillerato.','Bachillerato blue roof section','Bachillerato glazed roof monitor')):
        return 'bachillerato'
    for key in ('transicion','grado-11','comedor','economato','primeros-auxilios','danzas-1','danzas-2'):
        if n.startswith(key+'.') and not n.startswith(key+'.base'): return key
    if n.startswith('tienda.') and not n.startswith('tienda.compact paving base'): return 'tienda-1'
    if n.startswith('Tienda entrance link awning'): return 'tienda-1'
    if n.startswith('GYM '): return 'gym'
    if n.startswith(('Football lawn.','Subtle mown turf stripe')): return 'futbol-principal'
    if n.startswith('North football field.'): return 'futbol-norte'
    if n.startswith(('Zona 1 · Canchas · reference footprint','Central court','Red multi-sport court')): return 'patio-central'
    return None


def linear(v):
    return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4


source_hash=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
approved=json.loads((ROOT/'output'/'camera-validation.json').read_text())['overview']
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene=bpy.context.scene
camera=scene.camera
assert camera.data.type=='ORTHO'
assert abs(camera.data.ortho_scale-approved['ortho_scale'])<1e-5
assert max(abs(a-b) for a,b in zip(camera.location,approved['location']))<1e-5
assert max(abs(a-b) for a,b in zip(camera.rotation_euler,approved['rotation_radians']))<1e-5
palette={}
for i,(key,label,kind,regions) in enumerate(CATALOG):
    rgb=tuple(round(c*255) for c in colorsys.hsv_to_rgb((i*.61803398875)%1,.78,1))
    palette[key]={'id':key,'label':label,'kind':kind,'sourceRegions':regions,'rgb':rgb,'objects':0}
assignments={}
for obj in scene.objects:
    key=classify(obj)
    assignments[obj.name]=key
    if key:
        palette[key]['objects']+=1
        obj.color=(*[linear(v/255) for v in palette[key]['rgb']],1)
    else: obj.color=(0,0,0,1)
assert all(item['objects'] for item in palette.values())
mat=bpy.data.materials.new('Derivative semantic ID emission')
mat.use_nodes=True
nodes=mat.node_tree.nodes
nodes.clear()
info=nodes.new('ShaderNodeObjectInfo')
emission=nodes.new('ShaderNodeEmission')
output=nodes.new('ShaderNodeOutputMaterial')
mat.node_tree.links.new(info.outputs['Color'],emission.inputs['Color'])
mat.node_tree.links.new(emission.outputs[0],output.inputs['Surface'])
scene.view_layers[0].material_override=mat
scene.render.engine='CYCLES'
scene.cycles.samples=1
scene.cycles.use_denoising=False
scene.cycles.use_adaptive_sampling=False
scene.cycles.max_bounces=0
scene.render.resolution_x,scene.render.resolution_y=3200,2200
scene.render.resolution_percentage=100
scene.render.film_transparent=False
scene.render.dither_intensity=0
scene.world.use_nodes=True
scene.world.node_tree.nodes.get('Background').inputs['Color'].default_value=(0,0,0,1)
scene.world.node_tree.nodes.get('Background').inputs['Strength'].default_value=0
scene.view_settings.view_transform='Standard'
scene.view_settings.look='None'
scene.view_settings.exposure=0
scene.view_settings.gamma=1
scene.render.image_settings.file_format='PNG'
scene.render.image_settings.color_mode='RGB'
scene.render.image_settings.color_depth='8'
scene.render.filepath=str(OUT/'semantic-ids.png')
bpy.ops.render.render(write_still=True)
assert source_hash==hashlib.sha256(SOURCE.read_bytes()).hexdigest()
metadata={'width':3200,'height':2200,'source_iteration':5,'source_blend_sha256':source_hash,
    'source_render_sha256':hashlib.sha256((ROOT/'output'/'overview.png').read_bytes()).hexdigest(),
    'camera':approved,'regions':list(palette.values()),'object_assignments':assignments,
    'method':'Opaque Object Info Color emission; full scene depth occlusion; identical orthographic camera; source not saved.',
    'glass_selection':'Front glazing is selectable as an opaque semantic surface; original artwork remains transparent.'}
(OUT/'mask-source.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
print('SEMANTIC_MASK_PASS_OK '+json.dumps({'regions':len(palette),'source_unchanged':True,'resolution':[3200,2200]}))
