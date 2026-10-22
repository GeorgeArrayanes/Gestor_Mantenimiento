"""Vectorize the Blender ID pass and compress the approved render, without edits.

Uses existing Pillow/numpy runtime. No manually drawn interaction polygons.
Pixel boundary tracing preserves separate islands and holes (SVG evenodd).
"""
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
WORK=ROOT/'interactive'/'output'
PUBLIC=ROOT.parents[1]/'frontend'/'public'/'campus-map'
PUBLIC.mkdir(exist_ok=True,parents=True)
source=json.loads((WORK/'mask-source.json').read_text(encoding='utf-8'))
width,height=source['width'],source['height']
rgb=np.array(Image.open(WORK/'semantic-ids.png').convert('RGB'),dtype=np.int32)
best=np.sum(rgb*rgb,axis=2)
labels=np.zeros((height,width),dtype=np.uint8)
for index,region in enumerate(source['regions'],1):
    delta=rgb-np.array(region['rgb'])
    dist=np.sum(delta*delta,axis=2)
    hit=dist<best
    labels[hit]=index
    best[hit]=dist[hit]


def boundary_loops(mask):
    edges={}
    def add(points,dx1,dy1,dx2,dy2):
        for y,x in zip(*np.nonzero(points)):
            start=(int(x)+dx1,int(y)+dy1)
            edges.setdefault(start,[]).append((int(x)+dx2,int(y)+dy2))
    add(mask & ~np.pad(mask[:-1],((1,0),(0,0))),0,0,1,0)
    add(mask & ~np.pad(mask[1:],((0,1),(0,0))),1,1,0,1)
    add(mask & ~np.pad(mask[:,:-1],((0,0),(1,0))),0,1,0,0)
    add(mask & ~np.pad(mask[:,1:],((0,0),(0,1))),1,0,1,1)
    loops=[]
    while edges:
        start=next(iter(edges));point=start;previous=None;loop=[]
        while True:
            loop.append(point)
            choices=edges[point]
            if len(choices)>1 and previous is not None:
                dx,dy=point[0]-previous[0],point[1]-previous[1]
                preference=[(-dy,dx),(dx,dy),(dy,-dx),(-dx,-dy)]
                end=min(choices,key=lambda q:preference.index((q[0]-point[0],q[1]-point[1])))
            else: end=choices[0]
            choices.remove(end)
            if not choices: del edges[point]
            previous,point=point,end
            if point==start: break
        if len(loop)>=4: loops.append(loop)
    return loops


def area(poly):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1])))/2


def simplify_open(points,epsilon=0.5):
    keep={0,len(points)-1};stack=[(0,len(points)-1)]
    while stack:
        first,last=stack.pop()
        if last-first<2: continue
        a,b=points[first],points[last]
        dx,dy=b[0]-a[0],b[1]-a[1];length=dx*dx+dy*dy
        farthest=epsilon*epsilon;chosen=None
        for i in range(first+1,last):
            p=points[i]
            t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)) if length else 0
            distance=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
            if distance>farthest: farthest=distance;chosen=i
        if chosen is not None:
            keep.add(chosen);stack.extend([(first,chosen),(chosen,last)])
    return [points[i] for i in sorted(keep)]


def simplify_closed(points):
    p=[b for a,b,c in zip(points[-1:]+points[:-1],points,points[1:]+points[:1])
       if (b[0]-a[0])*(c[1]-b[1])!=(b[1]-a[1])*(c[0]-b[0])]
    if len(p)<4: return p
    split=max(range(1,len(p)),key=lambda i:(p[i][0]-p[0][0])**2+(p[i][1]-p[0][1])**2)
    return simplify_open(p[:split+1])[:-1]+simplify_open(p[split:]+p[:1])[:-1]


def reconstruct(loops):
    canvas=np.zeros((height,width),dtype=bool)
    for loop in loops:
        # Sample exact pixel centers, like the ID raster. Pillow's inclusive
        # polygon endpoints otherwise inflate narrow buildings by one pixel.
        p=np.array(loop,dtype=float);q=np.roll(p,-1,axis=0)
        for y in range(max(0,int(p[:,1].min())),min(height,int(p[:,1].max()))):
            cy=y+.5
            hits=(p[:,1]>cy)!=(q[:,1]>cy)
            a,b=p[hits],q[hits]
            xs=np.sort(a[:,0]+(b[:,0]-a[:,0])*(cy-a[:,1])/(b[:,1]-a[:,1]))
            for left,right in zip(xs[::2],xs[1::2]):
                start=max(0,math.ceil(left-.5));end=min(width,math.ceil(right-.5))
                canvas[y,start:end]^=True
    return canvas


regions=[];qa=[];overlay=Image.open(ROOT/'output'/'overview.png').convert('RGBA')
for index,region in enumerate(source['regions'],1):
    mask=labels==index
    ys,xs=np.nonzero(mask)
    assert len(xs)>40, 'Region has no visible area: '+region['id']
    loops=[simplify_closed(p) for p in boundary_loops(mask) if area(p)>=3]
    loops=[p for p in loops if len(p)>=3]
    traced=reconstruct(loops)
    intersection=np.logical_and(mask,traced).sum()
    union=np.logical_or(mask,traced).sum()
    iou=float(intersection/union)
    assert iou>.96, f"Mask vectorization error for {region['id']}: {iou}"
    path=''.join('M'+'L'.join(f'{x} {y}' for x,y in loop)+'Z' for loop in loops)
    item={key:region[key] for key in ('id','label','kind','sourceRegions')}
    item.update(path=path,bounds=[int(xs.min()),int(ys.min()),int(xs.max()-xs.min()+1),int(ys.max()-ys.min()+1)],
                center=[round(float(xs.mean()),1),round(float(ys.mean()),1)])
    regions.append(item)
    qa.append({'id':region['id'],'visible_pixels':len(xs),'subpaths':len(loops),'vertices':sum(map(len,loops)),
               'vector_pixel_iou':round(iou,5)})
    tint=np.zeros((height,width,4),dtype=np.uint8)
    tint[mask]=(*region['rgb'],65)
    overlay=Image.alpha_composite(overlay,Image.fromarray(tint))
    print('VECTORIZED',region['id'],len(xs),round(iou,5),flush=True)

payload={'width':width,'height':height,'sourceIteration':5,'selectionRevision':source.get('selection_revision',1),'coordinateSystem':'top-left / approved orthographic render',
         'sourceRenderSha256':source['source_render_sha256'],'sourceBlendSha256':source['source_blend_sha256'],
         'regions':regions}
(PUBLIC/'regions.json').write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3200 2200">'+''.join(
    f'<path id="{r["id"]}" d="{r["path"]}" fill="rgb{tuple(source["regions"][i]["rgb"])}" fill-rule="evenodd"/>'
    for i,r in enumerate(regions))+'</svg>'
(WORK/'regions.svg').write_text(svg,encoding='utf-8')
overlay.thumbnail((1600,1100));overlay.convert('RGB').save(WORK/'mask-overlay.jpg',quality=92)
approved=Image.open(ROOT/'output'/'overview.png').convert('RGB')
assets=[]
for size in (1600,2400,3200):
    resized=approved.resize((size,round(size*height/width)),Image.Resampling.LANCZOS) if size!=width else approved
    path=PUBLIC/f'campus-{size}.webp'
    resized.save(path,'WEBP',quality=88,method=6)
    assets.append({'name':path.name,'width':resized.width,'height':resized.height,'bytes':path.stat().st_size,
                   'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
report={'source':{k:source[k] for k in ('source_iteration','source_blend_sha256','source_render_sha256','camera','method','glass_selection')},
        'simplification_max_error_px':.5,'minimum_contour_area_px':3,'regions':qa,'assets':assets,
        'public_regions_bytes':(PUBLIC/'regions.json').stat().st_size,
        'source_unchanged':hashlib.sha256((ROOT/'output'/'overview.png').read_bytes()).hexdigest()==source['source_render_sha256']}
(WORK/'asset-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
np.save(WORK/'semantic-labels.npy',labels)
print('ASSETS_OK',json.dumps({'regions':len(regions),'json_bytes':report['public_regions_bytes'],'assets':assets}))
