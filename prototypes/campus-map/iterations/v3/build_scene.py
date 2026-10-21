"""Arrayanes visual prototype. Run with Blender 4.5 LTS, no pip packages.

All architecture, camera, lighting and renders are generated here. Figma paths
are reference envelopes, not surveyed building footprints. No app/API access.
"""
import argparse
import hashlib
import json
import math
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

import bpy
from mathutils import Vector
from mathutils.geometry import tessellate_polygon
from bpy_extras.object_utils import world_to_camera_view

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)
CFG = json.loads((ROOT / "layout.json").read_text(encoding="utf-8"))
RAW = json.loads((ROOT / "reference/figma-frame.json").read_text(encoding="utf-8"))
random.seed(42)
R = Vector((2**-.5, 2**-.5, 0))
B = Vector((-2**-.5, 2**-.5, 0))
CAM_DIRECTION = Vector((1, -1, 1)).normalized()
SIN_ELEV = math.sin(math.radians(CFG["projection"]["elevation_degrees"]))
COLLECTION = None
MATERIALS = {}
TARGETS = {}
COUNTS = {}
BOUNDARY = []
GEOMETRY_REVIEW = {}


def parse_paths(node):
    """Apply full Figma transforms, then express points relative to the frame.

    The current reference paths contain M/L/Z only. Reject unsupported commands
    instead of silently treating Bezier control points as polygon corners.
    """
    t = node["transform"]
    frame = RAW["frame"]["absoluteTransform"]
    paths, seen = [], set()
    for path in node["paths"]:
        data = path["data"]
        if re.search(r"[ACQHSTVachlmqstv]", data):
            raise ValueError(f"Unsupported path command in {node['id']}")
        numbers = list(map(float, re.findall(r"-?\d+(?:\.\d+)?(?:e[-+]?\d+)?", data, re.I)))
        pts = [(t[0][0]*x+t[0][1]*y+t[0][2]-frame[0][2],
                t[1][0]*x+t[1][1]*y+t[1][2]-frame[1][2])
               for x, y in zip(numbers[::2], numbers[1::2])]
        if len(pts) > 1 and math.dist(pts[0], pts[-1]) < .001:
            pts.pop()
        signature = tuple((round(x, 4), round(y, 4)) for x, y in pts)
        if signature not in seen:
            paths.append(pts)
            seen.add(signature)
    return paths


REGIONS = {n["id"]: parse_paths(n)[0] for n in RAW["vectors"]
           if n["id"] in CFG["regions"]}


def xy(point, z=0):
    x, y = point
    scale = CFG["projection"]["scale"]
    origin = CFG["projection"]["origin"]
    gx = (x-origin[0])*scale
    gy = (origin[1]-y)*scale/SIN_ELEV
    # Far half of the aerial tracing is compressed by perspective. A small,
    # documented extra depth restores breathing room without claiming a survey.
    gy += max(0, CFG["projection"]["far_depth_start"]-y)*CFG["projection"]["far_depth_extra"]
    return R*gx + B*gy + Vector((0, 0, z))


def collection(name):
    global COLLECTION
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    COLLECTION = c
    return c


def material(name, hex_color, roughness=.55, metal=0, transmission=0):
    rgb = tuple(int(hex_color[i:i+2], 16)/255 for i in (0, 2, 4))
    # Hex colors represent sRGB; shader inputs are scene-linear.
    linear = tuple(v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*linear, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*linear, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metal
    p.inputs["Transmission Weight"].default_value = transmission
    MATERIALS[name] = mat
    return mat


def mesh(name, verts, faces, mat, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata([tuple(p) for p in verts], [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Soft construction edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return obj


BOX_VERTS = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),
             (-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
BOX_FACES = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]


def box(name, center, size, mat, angle=0, bevel=0):
    c, s = math.cos(angle), math.sin(angle)
    verts = []
    for x, y, z in BOX_VERTS:
        x, y, z = x*size[0]/2, y*size[1]/2, z*size[2]/2
        verts.append((center[0]+x*c-y*s, center[1]+x*s+y*c, center[2]+z))
    return mesh(name, verts, BOX_FACES, mat, bevel)


def slab(name, pts, z, height, mat, bevel=0):
    points = [Vector((p[0], p[1], z)) for p in pts]
    if len(points) < 3:
        raise ValueError(f"Empty polygon: {name}")
    # Triangulate concave footprints; a single n-gon roof can create bad faces.
    signed = sum(p.x*q.y-q.x*p.y for p,q in zip(points, points[1:]+points[:1]))
    if signed < 0:
        points.reverse()
    count = len(points)
    lookup = {(round(p.x, 6), round(p.y, 6)): i for i,p in enumerate(points)}
    tris = tessellate_polygon([points])
    faces = []
    for tri in tris:
        ids = [p if isinstance(p, int) else lookup[(round(p.x,6),round(p.y,6))] for p in tri]
        faces.extend([tuple(reversed(ids)), tuple(i+count for i in ids)])
    faces.extend((i,(i+1)%count,(i+1)%count+count,i+count) for i in range(count))
    return mesh(name, points+[p+Vector((0,0,height)) for p in points], faces, mat, bevel)


def stroke(name, points, radius, mat, closed=False):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 1
    data.bevel_depth = radius
    data.bevel_resolution = 1
    spline = data.splines.new("POLY")
    spline.points.add(len(points)-1)
    for v, p in zip(spline.points, points):
        v.co = (*p, 1)
    spline.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def beam(name, a, b, width, mat):
    a,b = Vector(a),Vector(b)
    delta = b-a
    up = Vector((0,0,1))
    side = delta.cross(up)
    if side.length < .01:
        side = Vector((1,0,0))
    side.normalize()
    other = delta.normalized().cross(side).normalized()
    verts = [p+sx*side*width/2+sy*other*width/2
             for p in (a,b) for sx,sy in ((-1,-1),(1,-1),(1,1),(-1,1))]
    return mesh(name, verts, BOX_FACES, mat)


def text3d(name, body, location, size, mat, rotation=(0,0,0), align="CENTER"):
    data = bpy.data.curves.new(name, "FONT")
    data.body = body
    data.size = size
    data.align_x = align
    data.extrude = .008
    data.materials.append(mat)
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    obj.location = location
    obj.rotation_euler = rotation
    return obj


class Building:
    def __init__(self, key, region, length_factor=.95, width_ratio=.35):
        p = [xy(v) for v in REGIONS[region]]
        c = sum(p,Vector())/len(p)
        xx=sum((v.x-c.x)**2 for v in p)
        yy=sum((v.y-c.y)**2 for v in p)
        cross=sum((v.x-c.x)*(v.y-c.y) for v in p)
        angle=.5*math.atan2(2*cross,xx-yy)
        self.ex=Vector((math.cos(angle),math.sin(angle),0))
        self.ey=Vector((-self.ex.y,self.ex.x,0))
        if self.ey.dot(CAM_DIRECTION) > 0:
            self.ex=-self.ex
            self.ey=-self.ey
        dx=[(v-c).dot(self.ex) for v in p]
        dy=[(v-c).dot(self.ey) for v in p]
        self.center=c+self.ex*(min(dx)+max(dx))/2+self.ey*(min(dy)+max(dy))/2
        self.length=(max(dx)-min(dx))*length_factor
        self.width=min((max(dy)-min(dy))*.88,self.length*width_ratio)
        self.angle=math.atan2(self.ex.y,self.ex.x)
        self.key=key
        self.region=region
        TARGETS[key]={"center":list(self.center+Vector((0,0,4))),
                      "extent":self.length*1.32,"region":region}

    def p(self,x,y,z=0):
        return self.center+self.ex*x+self.ey*y+Vector((0,0,z))

    def box(self,name,center,size,mat,bevel=0):
        return box(self.key+"."+name,self.p(*center),size,mat,self.angle,bevel)

    def line(self,name,points,width,mat):
        return stroke(self.key+"."+name,[self.p(*p) for p in points],width,mat)

    def roof(self,z,pitch=.7):
        l,w=self.length+1.0,self.width+1.0
        verts=[self.p(x,y,h) for x,y,h in
               [(-l/2,-w/2,z),(l/2,-w/2,z),(-l/2,0,z+pitch),(l/2,0,z+pitch),
                (-l/2,w/2,z),(l/2,w/2,z)]]
        mesh(self.key+".standing-seam-roof",verts,[(0,1,3,2),(2,3,5,4)],MATERIALS["roof"])
        for x in [(-l/2)+i*.7 for i in range(int(l/.7)+1)]:
            self.line("roof seam",[(x,-w/2,z+.025),(x,0,z+pitch+.025),(x,w/2,z+.025)],.025,MATERIALS["roof-rib"])
        for y in (-w/2,w/2):
            self.box("white fascia",(0,y,z-.1),(l,.23,.3),MATERIALS["ivory"])
            self.box("gutter",(0,y,z+.03),(l,.12,.1),MATERIALS["aluminium"])


def facade(b, floors, floor_h, glazed=False):
    l,w=b.length,b.width
    bays=max(5,round(l/3.0))
    spacing=(l-1.0)/bays
    for side in (-1,1):
        y=side*w/2
        for floor in range(floors):
            bottom=.65+floor*floor_h
            b.box("floor edge",(0,y,bottom),(l+.25,.35,.23),MATERIALS["ivory"])
            for i in range(bays):
                x=-l/2+.5+(i+.5)*spacing
                b.box("recessed window",(x,y,bottom+floor_h*.53),
                      (spacing-.24,.13,floor_h*(.83 if glazed else .60)),MATERIALS["glass"])
                for dx in (-spacing/2+.13,0,spacing/2-.13):
                    b.box("window mullion",(x+dx,y+side*.09,bottom+floor_h*.53),
                          (.055,.12,floor_h*.83),MATERIALS["frame"])
                b.box("window transom",(x,y+side*.1,bottom+floor_h*.62),
                      (spacing-.20,.13,.045),MATERIALS["frame"])
            b.box("sill",(0,y+side*.12,bottom+.22),(l,.33,.12),MATERIALS["stone"])
    for end in (-1,1):
        for floor in range(floors):
            for fy in (-.27,0,.27):
                b.box("end window",(end*(l/2+.02),fy*w,.65+floor*floor_h+floor_h*.51),
                      (.14,w*.20,floor_h*.60),MATERIALS["glass"])


def admin():
    collection("01 · Administrativo · detailed")
    b=Building("administrativo","4:37",.91,.27)
    l,w=b.length,b.width
    floor_h=2.95
    height=floor_h*4+.7
    b.box("foundation",(0,0,.22),(l+1.6,w+1.8,.44),MATERIALS["stone"],.12)
    b.box("main body",(0,0,height/2+.5),(l,w,height),MATERIALS["ivory"],.10)
    facade(b,4,floor_h,True)
    # Continuous white frame and the offset stair tower seen in the reference.
    for x in (-l/2,l/2):
        b.box("white end frame",(x,-w/2-.18,height/2+.5),(.48,.65,height+.6),MATERIALS["ivory"])
    b.box("roof parapet",(0,0,height+.6),(l+1.0,w+1.0,.65),MATERIALS["ivory"],.08)
    b.box("roof inset",(0,0,height+.97),(l-1.0,w-.8,.08),MATERIALS["roof-flat"])
    tower_x=-l*.34
    b.box("stair tower",(tower_x,-w/2-.3,height/2+1.0),(l*.18,1.45,height+1.1),MATERIALS["ivory"],.05)
    b.box("tower glazing",(tower_x,-w/2-1.04,height/2+.9),(l*.145,.09,height-.6),MATERIALS["glass"])
    for j in range(5):
        z=1.1+j*2.9
        b.box("tower frame",(tower_x,-w/2-1.10,z),(l*.16,.16,.14),MATERIALS["frame"])
    for x in (-l*.39,-l*.34,-l*.29):
        b.box("tower vertical frame",(x,-w/2-1.12,height/2+.8),(.09,.13,height),MATERIALS["frame"])
    # Two offset yellow panels with a glazing slot between them.
    sign_x=l*.27
    sign_width=l*.19
    front=-w/2-.35
    b.box("yellow identity panel",(sign_x,front,8.4),(sign_width,.48,7.7),MATERIALS["yellow"],.06)
    b.box("yellow raised wing",(sign_x-sign_width*.72,front+.03,10.5),(sign_width*.30,.46,4.8),MATERIALS["yellow"],.04)
    b.box("entry canopy",(-l*.08,-w/2-1.4,3.4),(l*.32,3.2,.33),MATERIALS["ivory"],.08)
    for x in (-l*.22,l*.06):
        b.box("canopy support",(x,-w/2-2.7,1.7),(.18,.18,3.4),MATERIALS["frame"])
    for i in range(3):
        b.box("entry steps",(-l*.08,-w/2-2.1-i*.5,.20-i*.05),(l*.35,1.5,.15),MATERIALS["stone"])
    # User-provided institutional crest, referenced as a real texture.
    crest=ROOT/"reference/school-crest.png"
    if crest.exists():
        mat=bpy.data.materials.new("GLA institutional crest")
        mat.use_nodes=True
        nodes=mat.node_tree.nodes
        texture=nodes.new("ShaderNodeTexImage")
        texture.image=bpy.data.images.load(str(crest),check_existing=True)
        mat.node_tree.links.new(texture.outputs["Color"],nodes["Principled BSDF"].inputs["Base Color"])
        nodes["Principled BSDF"].inputs["Roughness"].default_value=.6
        cx,cy,cz=sign_x,front-.25,9.45
        half=min(1.7,sign_width*.36)
        verts=[b.p(cx-half,cy,cz-half),b.p(cx+half,cy,cz-half),
               b.p(cx+half,cy,cz+half),b.p(cx-half,cy,cz+half)]
        obj=mesh("Administrativo · escudo GLA",verts,[(0,1,2,3)],mat)
        uv=obj.data.uv_layers.new(name="UVMap")
        for loop,coord in zip(uv.data,[(0,0),(1,0),(1,1),(0,1)]): loop.uv=coord
    text3d("GLA lettering","GLA",b.p(sign_x,front-.29,6.6),1.20,MATERIALS["navy"],(math.pi/2,0,b.angle))
    # Roof plant enclosure and small roof equipment.
    b.box("roof service enclosure",(l*.1,w*.18,height+1.5),(l*.17,w*.3,1.1),MATERIALS["ivory"])
    for i in range(3):
        b.box("roof plant",(l*.12+i*1.2,w*.2,height+2.12),(.85,.85,.18),MATERIALS["aluminium"])
    TARGETS["administrativo"]["center"]=list(b.p(0,0,5.8))
    # The review close-up faces the yellow facade; the general view stays fixed.
    direction=(-b.ey*.94-b.ex*.34).normalized()*math.sqrt(2)+Vector((0,0,1))
    TARGETS["administrativo"]["direction"]=list(direction.normalized())
    for x in (-l*.43,l*.43):
        planter(b.p(x,-w/2-3.3,.35),2.2,.8,b.angle)


def classrooms():
    collection("02 · Bloque de salones · detailed")
    b=Building("salones","4:17",.98,.33)
    l,w=b.length,b.width
    h=8.9
    b.box("paved apron",(0,0,.16),(l+3,w+3,.3),MATERIALS["stone"],.08)
    b.box("body",(0,0,h/2+.4),(l,w,h),MATERIALS["ivory"],.08)
    facade(b,3,2.85)
    # Recessed outdoor circulation gallery, slab edges and lightweight railings.
    for j in range(3):
        z=.58+j*2.85
        b.box("gallery deck",(0,-w/2-.76,z),(l+1,1.8,.22),MATERIALS["ivory"])
        b.box("gallery shade",(0,-w/2-1.5,z+2.70),(l+1,.12,.18),MATERIALS["frame"])
        if j:
            b.box("balcony handrail",(0,-w/2-1.60,z+.98),(l,.10,.09),MATERIALS["aluminium"])
            b.box("balcony lower rail",(0,-w/2-1.60,z+.32),(l,.065,.065),MATERIALS["aluminium"])
            for k in range(int(l/1.2)+1):
                b.box("railing post",(-l/2+k*1.2,-w/2-1.60,z+.65),(.06,.06,.9),MATERIALS["aluminium"])
    for k in range(7):
        x=-l/2+k*l/6
        b.box("gallery column",(x,-w/2-1.55,h/2),(.20,.20,h),MATERIALS["ivory"])
    b.roof(h+.45,.9)
    # Stepped white end walls and a legible recessed entrance.
    for x in (-l/2-.12,l/2+.12):
        b.box("end parapet",(x,0,h+.8),(.35,w+1.2,1.0),MATERIALS["ivory"])
    b.box("entrance surround",(-l*.31,-w/2-.15,1.58),(3.0,.55,2.8),MATERIALS["navy"])
    b.box("entrance glazing",(-l*.31,-w/2-.46,1.55),(2.4,.07,2.40),MATERIALS["glass"])
    for i in range(5):
        x=l*.08+i*l*.075
        b.box("ground-floor color panel",(x,-w/2-.17,1.3),(l*.065,.18,1.75),MATERIALS["sage" if i%2 else "yellow-soft"])
    for x in (-l*.43,l*.43):
        b.line("downpipe",[(x,w/2+.25,.5),(x,w/2+.25,h+.45)],.06,MATERIALS["frame"])
    TARGETS["salones"]["center"]=list(b.p(0,0,3.6))


def preschool():
    collection("03 · Preescolar · detailed")
    p=[xy(v) for v in REGIONS["4:33"]]
    base=slab("Preescolar irregular plinth",p,.08,.38,MATERIALS["stone"],.06)
    c=sum(p,Vector())/len(p)
    TARGETS["preescolar"]={"center":list(c+Vector((0,0,3))),"extent":61,"region":"4:33"}
    # Build individual perimeter wings instead of filling the irregular L with
    # an opaque prism. The central covered space keeps its structural depth.
    corner=p[0]
    north=(p[1]-corner).normalized()
    west=(p[5]-corner).normalized()
    seam_direction=(north+west).normalized()
    seam_normal=Vector((-seam_direction.y,seam_direction.x,0))
    def trim_roof(vertices, keep):
        """Miter the two roofs at their shared corner; avoid coplanar overlaps."""
        result=[]
        sign=1 if (keep-corner).dot(seam_normal)>=0 else -1
        for a,b in zip(vertices, vertices[1:]+vertices[:1]):
            da=(a-corner).dot(seam_normal)*sign
            db=(b-corner).dot(seam_normal)*sign
            if da>=-.00001: result.append(a)
            if (da<0)!=(db<0): result.append(a.lerp(b,da/(da-db)))
        return result
    def wing(name,a,b,width,height,roof_blue=True,keep=None):
        delta=b-a
        length=delta.length
        ex=delta.normalized()
        ey=Vector((-ex.y,ex.x,0))
        middle=(a+b)/2
        if ey.dot(c-middle)<0: ey=-ey
        middle+=ey*width/2
        ang=math.atan2(ex.y,ex.x)
        box(name+".body",middle+Vector((0,0,height/2+.4)),(length,width,height),MATERIALS["ivory"],ang,.05)
        for side in (-1,1):
            for i in range(max(3,int(length/2.6))):
                count=max(3,int(length/2.6))
                loc=middle+ex*((i+.5)*length/count-length/2)+ey*(side*(width/2+.025))+Vector((0,0,2.3))
                box(name+".window",loc,(length/count-.35,.10,2.15),MATERIALS["glass"],ang)
        z=height+.6
        if roof_blue:
            verts=[middle+ex*x+ey*y+Vector((0,0,zz)) for x,y,zz in
                   [(-length/2,-width/2-.35,z),(length/2,-width/2-.35,z),
                    (-length/2,0,z+.7),(length/2,0,z+.7),
                    (-length/2,width/2+.35,z),(length/2,width/2+.35,z)]]
            for ids in [(0,1,3,2),(2,3,5,4)]:
                face=[verts[i] for i in ids]
                if keep is not None: face=trim_roof(face,keep)
                if len(face)>=3: mesh(name+".blue roof",face,[tuple(range(len(face)))],MATERIALS["roof"])
            for i in range(int(length/.75)+1):
                x=-length/2+i*.75
                seam=[middle+ex*x+ey*y+Vector((0,0,zz+.03)) for y,zz in [(-width/2-.35,z),(0,z+.7),(width/2+.35,z)]]
                for aa,bb in zip(seam,seam[1:]):
                    segment=[aa,bb]
                    if keep is not None:
                        side=1 if (keep-corner).dot(seam_normal)>=0 else -1
                        da=(aa-corner).dot(seam_normal)*side
                        db=(bb-corner).dot(seam_normal)*side
                        if da<0 and db<0: continue
                        if da<0: segment[0]=aa.lerp(bb,da/(da-db))
                        elif db<0: segment[1]=aa.lerp(bb,da/(da-db))
                    stroke(name+".seam",segment,.018,MATERIALS["roof-rib"])
        else:
            box(name+".white roof",middle+Vector((0,0,z)),(length+1,width+1,.33),MATERIALS["ivory"],ang,.04)
        for side in (-1,1):
            loc=middle+ey*side*(width/2+.35)+Vector((0,0,z-.08))
            box(name+".fascia",loc,(length+.5,.22,.40),MATERIALS["ivory"],ang)
    wing("Preescolar north wing",p[0],p[1],5.8,4.1,keep=p[1])
    wing("Preescolar west wing",p[5],p[0],6.2,4.1,keep=p[5])
    wing("Preescolar entrance wing",p[5],p[4],3.6,3.7,False)
    # Four-edge canopy inside the two blue roof wings. A raised center and
    # visible diagonal steel members recreate the recognizable glazed roof.
    q=[p[0]*.72+c*.28,p[1]*.64+c*.36,p[3]*.80+c*.20,p[5]*.68+c*.32]
    q=[Vector((v.x,v.y,4.55)) for v in q]
    peak=sum(q,Vector())/4+Vector((0,0,3.25))
    for i in range(4):
        a,b=q[i],q[(i+1)%4]
        mesh("Preescolar.glass canopy", [a,b,peak], [(0,1,2)], MATERIALS["canopy-glass"])
        beam("Preescolar.canopy hip",a,peak,.16,MATERIALS["frame"])
        beam("Preescolar.canopy eave",a,b,.20,MATERIALS["ivory"])
        for j in range(1,9):
            t=j/9
            foot=a.lerp(b,t)
            beam("Preescolar.radial roof rib",foot,peak,.065,MATERIALS["aluminium"])
            beam("Preescolar.horizontal roof rib",a.lerp(peak,t),b.lerp(peak,t),.065,MATERIALS["aluminium"])
        for j in range(4):
            foot=a.lerp(b,j/4)
            beam("Preescolar.canopy column",(foot.x,foot.y,.45),foot,.16,MATERIALS["ivory"])
    # Courtyard paving under the glass, colorful low benches and planting.
    slab("Preescolar covered courtyard",q,.49,.04,MATERIALS["sand"])
    for i in range(4):
        pos=c+R*(i*2.5-3.5)+B*1.0+Vector((0,0,.80))
        box("Preescolar colored seat",pos,(1.8,.65,.5),MATERIALS[["yellow","sage","roof","coral"][i]],math.pi/4,.10)
    for v in (p[2],p[4]):
        planter(v*.90+c*.10+Vector((0,0,.5)),2.3,.9,math.pi/4)


def planter(pos,length,width,angle=0):
    box("Concrete planter",pos,(length,width,.65),MATERIALS["ivory"],angle,.06)
    box("Planter foliage",Vector(pos)+Vector((0,0,.45)),(length*.88,width*.80,.50),MATERIALS["leaf-dark"],angle,.15)


LEAF_MESHES={}


def tree(pos,scale=1):
    # Share mesh geometry for foliage; no per-tree subdivision dependency.
    pos=Vector(pos)
    beam("Tree trunk",pos,pos+Vector((0,0,2.5*scale)),.24*scale,MATERIALS["bark"])
    if not LEAF_MESHES:
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1)
        template=bpy.context.object
        original=template.data.copy()
        bpy.data.objects.remove(template,do_unlink=True)
        for key in ("leaf","leaf-light","leaf-dark"):
            data=original.copy()
            data.materials.clear()
            data.materials.append(MATERIALS[key])
            LEAF_MESHES[key]=data
    for i,(dx,dy,dz,radius) in enumerate([(-.6,0,2.8,1.35),(.6,.25,3.15,1.4),(0,-.4,3.8,1.25)]):
        key=random.choice(list(LEAF_MESHES))
        obj=bpy.data.objects.new("Tree crown",LEAF_MESHES[key])
        COLLECTION.objects.link(obj)
        obj.location=pos+Vector((dx,dy,dz))*scale
        obj.scale=(radius*scale,radius*scale,radius*scale)
        obj.rotation_euler=(random.random(),random.random(),random.random())


def court(name,corners,sport="basketball"):
    p=[xy(v,.22) for v in corners]
    def uv(u,v,z=.255):
        a=p[0].lerp(p[1],u)
        b=p[3].lerp(p[2],u)
        result=a.lerp(b,v)
        result.z=z
        return result
    slab(name+".surface",p,.18,.04,MATERIALS["court" if sport=="basketball" else "grass-field"])
    line_mat=MATERIALS["line"]
    stroke(name+".boundary",[uv(.04,.04),uv(.96,.04),uv(.96,.96),uv(.04,.96)],.055,line_mat,True)
    stroke(name+".center",[uv(.04,.50),uv(.96,.50)],.045,line_mat)
    stroke(name+".circle",[uv(.5+.17*math.cos(t),.5+.13*math.sin(t)) for t in [i*math.tau/64 for i in range(64)]],.045,line_mat,True)
    for end in (0,1):
        v0=.04 if end==0 else .96
        vi=.23 if end==0 else .77
        stroke(name+".key",[uv(.32,v0),uv(.32,vi),uv(.68,vi),uv(.68,v0)],.045,line_mat)
        if sport=="basketball":
            base=uv(.5,.005 if end==0 else .995,.26)
            top=base+Vector((0,0,2.8))
            beam(name+".basket support",base,top,.12,MATERIALS["frame"])
            back_r=R*.90
            mesh(name+".backboard",[top-back_r,top+back_r,top+back_r+Vector((0,0,1)),top-back_r+Vector((0,0,1))],
                 [(0,1,2,3)],MATERIALS["ivory"])
            hoop=top+B*(.35 if end==0 else -.35)+Vector((0,0,.08))
            stroke(name+".basket ring",[hoop+Vector((.23*math.cos(t),.23*math.sin(t),0)) for t in [i*math.tau/24 for i in range(24)]],.035,MATERIALS["coral"],True)


def landscape():
    global BOUNDARY
    collection("00 · Campus ground and preliminary context")
    line=next(n for n in RAW["vectors"] if n["id"]=="4:61")
    boundary=parse_paths(line)[0]
    # Complete the disconnected perimeter strokes without importing page chrome.
    boundary += [(285,280),(294,293),(793,301),(503,943),(545,992)]
    BOUNDARY=boundary
    world=[xy(v) for v in boundary]
    slab("Campus perimeter · architectural model base",world,-1.8,1.8,MATERIALS["base"],.20)
    slab("Campus paving",world,-.02,.12,MATERIALS["sand"])
    stroke("Perimeter edging",[xy(v,.12) for v in boundary],.17,MATERIALS["stone"],True)
    for region_index,(region,pts) in enumerate(REGIONS.items()):
        name,kind=CFG["regions"][region]
        if kind=="detail": continue
        mats={"grass":"grass","context":"context","new":"new-context","play":"play",
              "court":"asphalt","path":"stone"}
        p=[xy(v) for v in pts]
        # Figma includes overlapping context zones. Thin separated layers keep
        # the reference outlines readable without coplanar rendering artifacts.
        top=.14+region_index*.002
        slab(name+" · reference footprint",p,.105,top-.105,MATERIALS[mats[kind]])
        if kind in ("context","new"):
            stroke(name+" · reference outline",[xy(v,top+.02) for v in pts],.045,MATERIALS["context-line"],True)
    # Two real maintenance landmarks: the central hard courts and football lawn.
    court("Central court A",[(795,680),(982,699),(954,905),(743,881)])
    court("Central court B",[(1008,711),(1181,731),(1237,937),(981,909)])
    court("Central court C",[(1198,755),(1344,820),(1435,958),(1261,940)])
    court("Football lawn",[(420,215),(887,215),(872,284),(352,269)],"football")
    court("North sports court",[(971,124),(1139,124),(1176,159),(979,159)])
    # Pedestrian route and yellow curb around the central sports area.
    stroke("Central circulation stripe",[xy(v,.25) for v in [(780,622),(921,625),(1094,514),(1406,773),(1479,951)]],
           .10,MATERIALS["yellow-soft"])
    for i in range(12):
        pos=xy((755+i*13,942+i*1.4),.20)
        box("Parking bay marking",pos,(.08,3.0,.03),MATERIALS["line"],math.pi/4)
    # Lightly populated landscape. No generic 3D stand-ins for the other buildings.
    tree_points=[(310+i*34,280-i*.3) for i in range(17)]
    tree_points += [(653+i*20,114) for i in range(6)]
    tree_points += [(763,374),(749,405),(741,451),(713,521),(692,572),
                    (813,582),(828,594),(855,607),(885,620),(1490,491),
                    (1779,642),(1740,629),(1642,758),(1438,608)]
    for point in tree_points:
        tree(xy(point,.20),random.uniform(.65,1.0))
    # Courtyard furniture and understated lamps give scale without visual noise.
    for point in [(794,635),(869,651),(955,674),(1320,748),(1402,850)]:
        pos=xy(point,.25)
        box("Timber bench",pos+Vector((0,0,.65)),(2.2,.65,.18),MATERIALS["wood"],math.pi/4,.05)
        for dx in (-.65,.65):
            beam("Bench leg",pos+R*dx,pos+R*dx+Vector((0,0,.65)),.13,MATERIALS["frame"])
    for point in [(758,890),(1000,942),(1401,939),(1077,563)]:
        pos=xy(point,.22)
        beam("Campus light mast",pos,pos+Vector((0,0,5.3)),.12,MATERIALS["frame"])
        box("Lamp head",pos+Vector((0,0,5.35)),(.7,.5,.13),MATERIALS["ivory"],math.pi/4)


def setup():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for c in list(bpy.data.collections):
        if c.name != "Collection" and c.users==0: bpy.data.collections.remove(c)
    colors={
        "ivory":("F0F1EB",.42,0,0),"stone":("C3CDC9",.75,0,0),
        "sand":("E0E2D5",.82,0,0),"base":("B2C3BA",.72,0,0),
        "navy":("141B46",.45,0,0),"yellow":("F5BC21",.4,0,0),
        "yellow-soft":("D6BA66",.65,0,0),"glass":("466774",.26,.12,0),
        "canopy-glass":("6EA2B5",.13,.1,.30),"frame":("2D454B",.35,.35,0),
        "aluminium":("647F85",.38,.55,0),"roof":("159CCB",.58,.03,0),
        "roof-rib":("409FB9",.42,.15,0),"roof-flat":("AAB8B8",.8,0,0),
        "grass":("68956B",.95,0,0),"grass-field":("608963",.95,0,0),
        "leaf":("54805A",.8,0,0),"leaf-light":("82A464",.8,0,0),
        "leaf-dark":("3E6A50",.85,0,0),"bark":("81715A",.8,0,0),
        "asphalt":("777E81",.92,0,0),"court":("687F88",.85,0,0),
        "line":("E7E9D7",.9,0,0),"context":("C5D7D7",.85,0,0),
        "context-line":("8FAEAD",.8,0,0),"new-context":("D4D2BC",.9,0,0),
        "play":("C9CAB0",.85,0,0),"sage":("88AC91",.65,0,0),
        "coral":("D2734F",.6,0,0),"wood":("B48F60",.8,0,0),
        "background":("EAF0ED",.9,0,0)
    }
    for name,args in colors.items(): material(name,*args)
    scene=bpy.context.scene
    scene.render.engine="CYCLES"
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=5
    scene.cycles.transmission_bounces=3
    scene.cycles.transparent_max_bounces=4
    scene.cycles.adaptive_threshold=.035
    scene.render.image_settings.file_format="PNG"
    scene.render.image_settings.color_mode="RGB"
    scene.render.film_transparent=False
    scene.view_settings.view_transform="AgX"
    scene.view_settings.look="AgX - Medium High Contrast"
    scene.view_settings.exposure=.30
    scene.world.use_nodes=True
    bg=scene.world.node_tree.nodes.get("Background")
    bg.inputs[0].default_value=(.66,.77,.85,1)
    bg.inputs[1].default_value=.65
    collection("04 · Studio light and camera")
    box("Studio ground",(0,0,-2.32),(1400,1400,.5),MATERIALS["background"])
    light=bpy.data.lights.new("Soft afternoon sun","AREA")
    light.energy=125000
    light.shape="DISK"
    light.size=95
    obj=bpy.data.objects.new("Soft afternoon sun",light)
    COLLECTION.objects.link(obj)
    obj.location=(25,-50,150)
    obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat("-Z","Y").to_euler()
    fill=bpy.data.lights.new("Facade soft fill","AREA")
    fill.energy=55000
    fill.shape="DISK"
    fill.size=100
    obj=bpy.data.objects.new("Facade soft fill",fill)
    COLLECTION.objects.link(obj)
    obj.location=(90,-50,75)
    obj.rotation_euler=(-obj.location).to_track_quat("-Z","Y").to_euler()
    sun=bpy.data.lights.new("Broad architectural sunlight","SUN")
    sun.energy=1.6
    sun.angle=math.radians(12)
    obj=bpy.data.objects.new("Broad architectural sunlight",sun)
    COLLECTION.objects.link(obj)
    obj.rotation_euler=(math.radians(25),math.radians(-25),math.radians(-25))
    camera=bpy.data.cameras.new("Campus orthographic camera")
    camera.type="ORTHO"
    camera.clip_end=1600
    obj=bpy.data.objects.new("Campus orthographic camera",camera)
    COLLECTION.objects.link(obj)
    scene.camera=obj
    configure_device()


def configure_device():
    scene=bpy.context.scene
    prefs=bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type="CUDA"
        prefs.get_devices()
        for dev in prefs.devices: dev.use=dev.type=="CUDA"
        scene.cycles.device="GPU" if any(d.type=="CUDA" for d in prefs.devices) else "CPU"
    except Exception:
        scene.cycles.device="CPU"


def camera_at(center,extent,direction=None):
    camera=bpy.context.scene.camera
    direction=Vector(direction) if direction else CAM_DIRECTION
    camera.location=Vector(center)+direction*240
    camera.rotation_euler=(Vector(center)-camera.location).to_track_quat("-Z","Y").to_euler()
    camera.data.ortho_scale=extent
    bpy.context.view_layer.update()


def overview_camera():
    points=[xy(p) for pts in REGIONS.values() for p in pts]+[xy(p) for p in BOUNDARY]
    # Center by projected screen coordinates, not by the irregular world bounds.
    right=[v.dot(R) for v in points]
    up=Vector((-.408248,.408248,.816496))
    vertical=[v.dot(up) for v in points]
    center=R*((min(right)+max(right))/2)+B*((min(vertical)+max(vertical))/2/SIN_ELEV)
    center.z=2.8
    extent=max(max(right)-min(right)+24,(max(vertical)-min(vertical)+29)*3200/2200)
    camera_at(center,extent)


def detail_camera(key,data):
    """Fit the actual modeled vertices, not the length of an oblique footprint."""
    camera_at(data["center"],data["extent"],data.get("direction"))
    camera=bpy.context.scene.camera
    rot=camera.rotation_euler.to_matrix()
    right=rot@Vector((1,0,0))
    up=rot@Vector((0,1,0))
    objects=review_objects(key,data)
    points=[obj.matrix_world@v.co for obj in objects if obj.type=="MESH" for v in obj.data.vertices]
    xs=[v.dot(right) for v in points]
    ys=[v.dot(up) for v in points]
    center=Vector(data["center"])
    center+=right*((min(xs)+max(xs))/2-center.dot(right))
    center+=up*((min(ys)+max(ys))/2-center.dot(up))
    extent=max((max(xs)-min(xs))*1.20,(max(ys)-min(ys))*4/3*1.20)
    camera_at(center,extent,data.get("direction"))


def review_groups(key,data):
    defaults={"administrativo":["01 ·"],"salones":["02 ·"],"preescolar":["03 ·"]}
    prefixes=data.get('collections',defaults.get(key,[]))
    groups=[c for c in bpy.data.collections if any(c.name.startswith(p) for p in prefixes)]
    if not groups: raise RuntimeError(f'No geometry for review view: {key}')
    return groups


def review_objects(key,data):
    objects={o.name:o for c in review_groups(key,data) for o in c.objects}
    extra=data.get('extra_object_prefixes',[])
    objects.update({o.name:o for o in bpy.context.scene.objects if any(o.name.startswith(p) for p in extra)})
    return list(objects.values())


def prepare_review_cameras():
    scene=bpy.context.scene
    reports={}
    camera_group=next(c for c in bpy.data.collections if c.name.startswith("04 ·"))
    for key in ("overview",*TARGETS):
        if key=="overview":
            overview_camera()
            scene.render.resolution_x,scene.render.resolution_y=3200,2200
            groups=[c for c in bpy.data.collections if c.name[:2] in ("00","01","02","03","05","06","07","08")]
        else:
            detail_camera(key,TARGETS[key])
            scene.render.resolution_x,scene.render.resolution_y=1800,1350
            groups=review_groups(key,TARGETS[key])
        objects=[o for c in groups for o in c.objects] if key=='overview' else review_objects(key,TARGETS[key])
        points=[obj.matrix_world@v.co for obj in objects if obj.type=="MESH" for v in obj.data.vertices]
        projected=[world_to_camera_view(scene,scene.camera,v) for v in points]
        bounds=[min(v.x for v in projected),min(v.y for v in projected),max(v.x for v in projected),max(v.y for v in projected)]
        if not (bounds[0]>0 and bounds[1]>0 and bounds[2]<1 and bounds[3]<1):
            raise RuntimeError(f"Clipped review camera {key}: {bounds}")
        reports[key]={"normalized_bounds":bounds,"clipped":False,"ortho_scale":scene.camera.data.ortho_scale,
                      "location":list(scene.camera.location),"rotation_radians":list(scene.camera.rotation_euler)}
        saved=scene.camera.copy()
        saved.data=scene.camera.data.copy()
        saved.name="Review camera · "+key
        camera_group.objects.link(saved)
    (OUT/"camera-validation.json").write_text(json.dumps(reports,indent=2),encoding="utf-8")
    original=ROOT/'iterations/v1/output/camera-validation.json'
    if original.exists():
        prior=json.loads(original.read_text(encoding='utf-8'))['overview']
        current=reports['overview']
        errors=[abs(prior['ortho_scale']-current['ortho_scale'])]
        errors += [abs(x-y) for key in ('location','rotation_radians') for x,y in zip(prior[key],current[key])]
        if max(errors)>1e-5: raise RuntimeError('The base overview camera changed from iteration 1')
        (OUT/'camera-comparison.json').write_text(json.dumps({'same_base_camera':True,'max_parameter_delta':max(errors),'reference':'iterations/v1/output/camera-validation.json'},indent=2),encoding='utf-8')
    overview_camera()
    scene.render.resolution_x,scene.render.resolution_y=3200,2200


def export_layout():
    """Editable annotated SVG: source paths with transformations already applied."""
    palette={"grass":"#b9d4b7","context":"#dce5e5","new":"#e5dec7","play":"#e3dec9",
             "court":"#d5dce0","path":"#e2e8e4","detail":"#235c7a"}
    labels=[("01","Administrativo","4:37"),("02","Bloque de salones","4:17"),("03","Preescolar","4:33"),
            ("","11º","4:45"),("","GYM","4:47"),
            ("","Fútbol","4:9"),("","Zona 1 · canchas","4:6"),("","Bachillerato · contexto","4:25")]
    parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2417 1160">',
           '<rect width="2417" height="1160" fill="#f3f6f4"/>',
           '<text x="65" y="58" fill="#132c3c" font-family="Arial" font-weight="700" font-size="30">ARRAYANES / DISTRIBUCIÓN DE REFERENCIA</text>',
           '<text x="65" y="89" fill="#64767c" font-family="Arial" font-size="17">Fase 1 · Tres edificios detallados · Coordenadas originales de Figma · Sin escala</text>']
    for key,pts in REGIONS.items():
        kind=CFG["regions"][key][1]
        points=" ".join(f"{x:.2f},{y:.2f}" for x,y in pts)
        parts.append(f'<polygon points="{points}" fill="{palette[kind]}" stroke="#91aaa7" stroke-width="2"/>')
    for number,label,key in labels:
        pts=REGIONS[key]
        x=sum(p[0] for p in pts)/len(pts)
        y=sum(p[1] for p in pts)/len(pts)
        color="#ffffff" if number else "#24444b"
        if number:
            parts.append(f'<circle cx="{x:.1f}" cy="{y-13:.1f}" r="18" fill="#e6b94b"/>')
            parts.append(f'<text x="{x:.1f}" y="{y-7:.1f}" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="#172b40">{number}</text>')
        if not number:
            parts.append(f'<text x="{x:.1f}" y="{y+6:.1f}" text-anchor="middle" font-family="Arial" font-size="16" font-weight="700" fill="{color}">{escape(label)}</text>')
    parts.append('<rect x="1880" y="120" width="470" height="890" rx="24" fill="white"/>')
    notes=[("TRES EDIFICIOS · FASE 1", ""),
           ("01   Administrativo", "Capa 4:37 · Franja contigua 4:39"),
           ("02   Bloque de salones", "Capa 4:17 · Próximo al patio central"),
           ("03   Preescolar", "Capa 4:33 · Planta irregular"),
           ("Grado 11 + GYM", "Posiciones del plano corregido"),
           ("Contexto preliminar", "Las otras regiones quedan como huellas"),
           ("Referencia verificada", "Frame 2:2 · 2417 × 1110"),
           ("Escala aproximada", "No es un levantamiento arquitectónico")]
    for i,(title,note) in enumerate(notes):
        yy=177+i*104
        parts.append(f'<text x="1910" y="{yy}" font-family="Arial" font-size="21" font-weight="700" fill="#152d42">{escape(title)}</text>')
        parts.append(f'<text x="1910" y="{yy+31}" font-family="Arial" font-size="17" fill="#64767c">{escape(note)}</text>')
    parts.append('<text x="65" y="1115" font-family="Arial" font-size="17" fill="#64767c">Fuente: frame 2:2 · 26 regiones vectoriales. Los grupos no equivalen a registros del gestor.</text></svg>')
    (OUT/"distribution.svg").write_text("\n".join(parts),encoding="utf-8")
    (OUT/"region-coordinates.json").write_text(json.dumps({"source_frame":"2:2","deduplicated_paths":REGIONS,"targets":TARGETS},indent=2),encoding="utf-8")


def export_annotated_overview():
    scene=bpy.context.scene
    overview_camera()
    scene.render.resolution_x,scene.render.resolution_y=3200,2200
    items=[("01","Administrativo",TARGETS["administrativo"]["center"]),
           ("02","Salones",TARGETS["salones"]["center"]),
           ("03","Preescolar",TARGETS["preescolar"]["center"])]
    for label,region in [("GRADO 11","4:45"),("GYM","4:47"),("BACHILLERATO","4:25"),("TRANSICIÓN","4:27"),
                         ("ATRAVESADO","4:23"),("4 BLOQUES","4:19"),("FÚTBOL","4:9"),("PATIO CENTRAL","4:6")]:
        pts=[xy(p,1) for p in REGIONS[region]]
        items.append((label,"",sum(pts,Vector())/len(pts)))
    parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3200 2200">',
           '<image href="overview.png" width="3200" height="2200"/>']
    for number,label,center in items:
        co=world_to_camera_view(scene,scene.camera,Vector(center)+Vector((0,0,5)))
        x,y=co.x*3200,(1-co.y)*2200
        if number=='ATRAVESADO': x+=105;y-=80
        width=80 if label else max(100,len(number)*18+34)
        parts.append(f'<rect x="{x-width/2:.1f}" y="{y-30:.1f}" width="{width}" height="60" rx="24" fill="#152044" stroke="white" stroke-width="3"/>')
        parts.append(f'<text x="{x:.1f}" y="{y+10:.1f}" text-anchor="middle" font-family="Arial" font-size="27" font-weight="700" fill="white">{number}</text>')
    parts.append('<rect x="90" y="1920" width="800" height="170" rx="24" fill="white" fill-opacity=".96"/>')
    parts.append('<text x="125" y="1973" font-family="Arial" font-weight="700" font-size="30" fill="#172242">ARRAYANES · ITERACIÓN 3 / FASE 1</text>')
    for i,(num,label,_) in enumerate(items[:3]):
        parts.append(f'<text x="{125+i*250}" y="2035" font-family="Arial" font-size="25" fill="#465361">{num}  {label}</text>')
    parts.append('</svg>')
    (OUT/"overview-annotated.svg").write_text("\n".join(parts),encoding="utf-8")


def validate():
    scene=bpy.context.scene
    bad=[]
    for obj in scene.objects:
        if obj.type=="MESH":
            if not obj.data.materials: bad.append(obj.name+": missing material")
            if any(not math.isfinite(c) for v in obj.data.vertices for c in v.co): bad.append(obj.name+": nonfinite vertex")
    expected_bars=['salones','bloque-2','bloque-3','bloque-4','bloque-atravesado']
    for key in expected_bars:
        if not any(o.name.startswith(key+'.white core') for o in scene.objects):
            bad.append(key+': classroom body missing')
    gym_objects=[o for o in scene.objects if o.name.startswith('GYM ')]
    if not gym_objects or any('roof' in o.name.lower() or 'wall' in o.name.lower() for o in gym_objects):
        bad.append('GYM must contain only outdoor surfaces/equipment')
    if GEOMETRY_REVIEW.get('tienda',{}).get('new_head_to_preschool_tip',float('inf'))>=GEOMETRY_REVIEW.get('tienda',{}).get('original_head_to_preschool_tip',0):
        bad.append('Tienda did not move closer to preschool')
    if bad: raise RuntimeError("; ".join(bad))
    report={"blender":bpy.app.version_string,"iteration":3,"source_frame":"2:2","region_count":len(REGIONS),
            "detailed_buildings":list(TARGETS),"objects":len(scene.objects),
            "mesh_objects":sum(o.type=="MESH" for o in scene.objects),
            "render_device":scene.cycles.device,"seed":42,"validation_errors":bad,
            "scope":"Visual prototype only; all dimensions approximate. No application or database integration."}
    (OUT/"scene-validation.json").write_text(json.dumps(report,indent=2),encoding="utf-8")
    (OUT/'geometry-review.json').write_text(json.dumps(GEOMETRY_REVIEW,indent=2),encoding='utf-8')
    print("SCENE_VALIDATION "+json.dumps(report))


def render(name,resolution,samples):
    scene=bpy.context.scene
    scene.render.resolution_x,scene.render.resolution_y=resolution
    scene.render.resolution_percentage=100
    scene.cycles.samples=samples
    scene.render.filepath=str(OUT/(name+".png"))
    print(f"RENDER_START {name} {resolution} {samples}",flush=True)
    started=time.perf_counter()
    try:
        bpy.ops.render.render(write_still=True)
    except RuntimeError:
        if scene.cycles.device!="GPU": raise
        print("GPU render failed; retrying with CPU.",flush=True)
        scene.cycles.device="CPU"
        bpy.ops.render.render(write_still=True)
    elapsed=time.perf_counter()-started
    manifest_path=OUT/("preview-manifest.json" if name.startswith("preview-") else "render-manifest.json")
    manifest=json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    manifest[name]={"resolution":list(resolution),"samples":samples,"device":scene.cycles.device,
                    "seconds":round(elapsed,2),"utc":datetime.now(timezone.utc).isoformat(),
                    "blender":bpy.app.version_string,"script_sha256":hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                    "png_sha256":hashlib.sha256(Path(scene.render.filepath).read_bytes()).hexdigest()}
    manifest[name]['refinement_sha256']=hashlib.sha256((ROOT/'refine_scene.py').read_bytes()).hexdigest()
    manifest[name]['layout_sha256']=hashlib.sha256((ROOT/'layout.json').read_bytes()).hexdigest()
    manifest[name]['geometry_sha256']=hashlib.sha256((ROOT/'campus_geometry.py').read_bytes()).hexdigest()
    manifest[name]['zones_sha256']=hashlib.sha256((ROOT/'corrected_zones.py').read_bytes()).hexdigest()
    manifest[name]['iteration']=3
    manifest_path.write_text(json.dumps(manifest,indent=2),encoding="utf-8")
    print(f"RENDER_DONE {name}",flush=True)


def main():
    # Prior visual iterations are preserved in iterations/v1 and iterations/v2.
    sys.path.insert(0,str(ROOT))
    import refine_scene
    api=sys.modules[__name__]
    parser=argparse.ArgumentParser()
    parser.add_argument("--preview",action="store_true")
    parser.add_argument("--view",choices=["all","overview","administrativo","salones","preescolar","conjunto-bloques","bachillerato"],default="all")
    args=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    setup()
    refine_scene.configure(api)
    landscape()
    admin()
    refine_scene.refine_admin(api)
    refine_scene.school_blocks(api)
    refine_scene.preschool(api)
    refine_scene.context(api)
    refine_scene.landscape_details(api)
    export_layout()
    export_annotated_overview()
    prepare_review_cameras()
    validate()
    overview_camera()
    bpy.context.scene.render.resolution_x=3200
    bpy.context.scene.render.resolution_y=2200
    bpy.context.scene.cycles.samples=96
    # Keep the native file portable, including the provided institutional crest.
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"arrayanes-campus.blend"))
    if args.view in ("overview","all"):
        render("preview-overview" if args.preview else "overview",
               (1440,990) if args.preview else (3200,2200),20 if args.preview else 96)
    for key,data in TARGETS.items():
        if args.view not in ("all",key): continue
        detail_camera(key,data)
        render(("preview-" if args.preview else "")+key,
               (1100,825) if args.preview else (1800,1350),20 if args.preview else 96)
    # Native scene opens at the same overview as the review gallery.
    overview_camera()
    bpy.context.scene.render.resolution_x=3200
    bpy.context.scene.render.resolution_y=2200
    bpy.context.scene.cycles.samples=96
    bpy.context.scene.render.filepath=str(OUT/"overview.png")
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/"arrayanes-campus.blend"))


if __name__=="__main__":
    main()
