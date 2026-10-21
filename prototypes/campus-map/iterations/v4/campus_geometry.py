"""Iteration 4: resolve the campus geometry against the corrected footprint.

All coordinates are visual prototype units. No application/data integration.
"""
import json
from mathutils import Vector


def cross2(a,b):
    return a.x*b.y-a.y*b.x


def line_intersection(p,u,q,v):
    denominator=cross2(u,v)
    if abs(denominator)<1e-7: raise ValueError('Parallel architectural reference edges')
    return p+u*(cross2(q-p,v)/denominator)


def polygon_area(points):
    return abs(sum(cross2(p,q) for p,q in zip(points,points[1:]+points[:1])))/2


def roof_footprint(points,offsets):
    """Inset each real edge by its roof/white fascia width, preserving the V.

    Unlike the former centroid-scaled quad, this retains the re-entrant corner
    and both ends of the six-vertex preschool footprint.
    """
    signed=sum(cross2(p,q) for p,q in zip(points,points[1:]+points[:1]))
    interior=1 if signed>0 else -1
    lines=[]
    for i,(p,q) in enumerate(zip(points,points[1:]+points[:1])):
        direction=(q-p).normalized()
        normal=Vector((-direction.y,direction.x,0))*interior
        lines.append((p+normal*offsets[i],direction))
    return [line_intersection(*lines[i-1],*lines[i]) for i in range(len(lines))]


def inside(point,polygon):
    hit=False
    for aa,bb in zip(polygon,polygon[1:]+polygon[:1]):
        if (aa.y>point.y)!=(bb.y>point.y):
            x=(bb.x-aa.x)*(point.y-aa.y)/(bb.y-aa.y)+aa.x
            if point.x<x: hit=not hit
    return hit


def preschool_canopy(a,p,c):
    # Insets meet the inside edges of both blue roofs and the white access wing.
    glass=roof_footprint(p,[5.15,.28,.28,.28,3.85,5.55])
    if len(glass)!=6 or not all(inside(v,p) for v in glass):
        raise RuntimeError('Preschool V roof left its reference footprint')
    a.slab('Preescolar continuous V play floor',glass,.525,.035,a.MATERIALS['play-green'])
    eaves=[Vector((v.x,v.y,7.80)) for v in glass]
    # The two complete glass arms share A-D, including the same raised ridge.
    # Joining their cross-sections gives a continuous bent roof, without filling
    # the concave notch or leaving the southern arm open to the sky.
    A,B,C,D,E,F=eaves
    partition_area=polygon_area([A,B,C,D])+polygon_area([A,F,E,D])
    if abs(partition_area-polygon_area(glass))>.001:
        raise RuntimeError('The two preschool glass arms do not cover the V footprint')
    junction=(A+D)/2+Vector((0,0,1.45))
    r_right=(B+C)/2+Vector((0,0,1.45))
    r_lower=(F+E)/2+Vector((0,0,1.45))
    members=set()
    panel_count=0
    def member(name,aa,bb,width,mat):
        key=tuple(sorted(tuple(round(v,4) for v in pos) for pos in (aa,bb)))
        if key in members: return
        members.add(key)
        a.beam(name,aa,bb,width,mat)
    # Quad order: blue-side start/end, outer-side end/start.
    for arm,(s0,s1,t1,t0,r0,r1) in enumerate([
        (A,B,C,D,junction,r_right),
        (A,F,E,D,junction,r_lower)
    ]):
        length=max((s1-s0).length,(t1-t0).length)
        bays=max(7,round(length/1.55))
        for i in range(bays):
            lo=i/bays;hi=(i+1)/bays
            for aa,bb in [(s0,s1),(t0,t1)]:
                v=[aa.lerp(bb,lo),aa.lerp(bb,hi),r0.lerp(r1,hi),r0.lerp(r1,lo)]
                a.mesh(f'Preescolar V glass arm {arm+1} panel',v,[(0,1,2),(0,2,3)],a.MATERIALS['canopy-glass'])
                panel_count+=1
        for i in range(bays+1):
            t=i/bays
            left=s0.lerp(s1,t);right=t0.lerp(t1,t);ridge=r0.lerp(r1,t)
            member('Preescolar V rafter',left,ridge,.09,a.MATERIALS['frame'])
            member('Preescolar V rafter',ridge,right,.09,a.MATERIALS['frame'])
            if i%3==0 or i==bays:
                member('Preescolar V truss tie',left,right,.085,a.MATERIALS['frame'])
                member('Preescolar V truss king post',(left+right)/2,ridge,.065,a.MATERIALS['frame'])
        member('Preescolar V continuous ridge',r0,r1,.12,a.MATERIALS['frame'])
        for v in (.25,.50,.75):
            for aa,bb in [(s0,s1),(t0,t1)]:
                member('Preescolar V glazing purlin',aa.lerp(r0,v),bb.lerp(r1,v),.055,a.MATERIALS['aluminium'])
    for i,(aa,bb) in enumerate(zip(eaves,eaves[1:]+eaves[:1])):
        member('Preescolar V white perimeter fascia',aa,bb,.20,a.MATERIALS['ivory'])
        length=(bb-aa).length
        for j in range(max(1,round(length/4.2))+1):
            loc=aa.lerp(bb,j/max(1,round(length/4.2)))
            member('Preescolar V perimeter support',Vector((loc.x,loc.y,.5)),loc,.14,a.MATERIALS['frame'])
    # White boundary beams continue around the concave opening, not across it.
    for i in (1,2,3):
        aa,bb=p[i],p[i+1]
        aa=Vector((aa.x,aa.y,7.70));bb=Vector((bb.x,bb.y,7.70))
        member('Preescolar white outer structure',aa,bb,.28,a.MATERIALS['ivory'])
    a.GEOMETRY_REVIEW['preschool_roof']={
        'reference_region':'4:33','footprint_vertices':6,'glass_vertices':6,
        'glass_area':round(polygon_area(glass),3),'reference_area':round(polygon_area(p),3),
        'two_glass_arms':True,'shared_ridge_junction':list(junction),'panels':panel_count,
        'roof_partition_area_error':round(abs(partition_area-polygon_area(glass)),6),
        'all_glass_vertices_inside_reference':True,
        'glass_world_footprint':[list(v) for v in glass],
        'description':'Complete V roof follows the re-entrant corner and both arms; blue/white edges set its insets.'}


def transverse_block(a):
    from refine_scene import school_block,group,ribbon
    group(a,'05 ·')
    b=school_block(a,'bloque-atravesado','4:23')
    # Narrow, uncovered decks meet the adjusted gallery edges. They connect
    # circulation without making the separated roofs read as one fused mass.
    near_side=-1
    deck_links=[]
    for key in ('bloque-3','bloque-4'):
        rear=a.CLASSROOM_FORMS[key]
        start=rear.p(rear.length/2+.13,0)
        along=max(-b.length/2+1,min(b.length/2-1,(start-b.center).dot(b.ex)))
        finish=b.p(along,near_side*(b.width/2+1.3))
        pts=[start,finish]
        deck_links.append({'from':key,'length':round((finish-start).length,3)})
        for z in (.75,3.65,6.55):
            ribbon(a,'Conjunto transverse connecting deck',pts,1.1,a.MATERIALS['ivory'],z)
        for pos in pts:
            a.beam('Conjunto connector column',pos+Vector((0,0,.35)),pos+Vector((0,0,9.05)),.14,a.MATERIALS['ivory'])
    center=sum([a.xy(pt) for region in ('4:15','4:17','4:19','4:21','4:23') for pt in a.REGIONS[region]],Vector())/sum(len(a.REGIONS[region]) for region in ('4:15','4:17','4:19','4:21','4:23'))
    a.TARGETS['conjunto-bloques']={'center':list(center+Vector((0,0,4))),'extent':60,
                                 'region':'4:23','collections':['02 ·','05 ·']}
    a.GEOMETRY_REVIEW['classroom_ensemble']={'main_bars':4,'transverse_bars':1,
                                          'transverse_region':'4:23','shared_materials_and_levels':True,
                                          'connected_galleries':2}
    spacing_review(a,deck_links)


def spacing_review(a,links):
    """Measure visible roof/gallery envelopes, including their overhangs."""
    def outline(b,roof):
        l=b.length+(1 if roof else .4)
        w=b.width+(1 if roof else 2.91)
        return [b.p(x*l/2,y*w/2) for x,y in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    def gap(p,q):
        # Convex separating-axis check first: edges may cross without a vertex
        # being contained in the other rectangle.
        separated=False
        for polygon in (p,q):
            for aa,bb in zip(polygon,polygon[1:]+polygon[:1]):
                edge=bb-aa;normal=Vector((-edge.y,edge.x,0)).normalized()
                ap=[v.dot(normal) for v in p];aq=[v.dot(normal) for v in q]
                if min(aq)>max(ap) or min(ap)>max(aq): separated=True
        if not separated: return 0.0
        def distance(point,aa,bb):
            edge=bb-aa
            t=max(0,min(1,(point-aa).dot(edge)/edge.length_squared))
            return (point-(aa+edge*t)).length
        return min(distance(v,aa,bb) for points,edges in ((p,q),(q,p)) for v in points for aa,bb in zip(edges,edges[1:]+edges[:1]))
    cross=a.CLASSROOM_FORMS['bloque-atravesado']
    gaps={}
    for key in ('bloque-3','bloque-4'):
        rear=a.CLASSROOM_FORMS[key]
        gaps[key]={'roof_gap':round(gap(outline(cross,True),outline(rear,True)),3),
                   'gallery_gap':round(gap(outline(cross,False),outline(rear,False)),3)}
        if gaps[key]['roof_gap']<3 or gaps[key]['gallery_gap']<1.8:
            raise RuntimeError('Rear classroom bars still touch the transverse block: '+key)
    upper_gap=gap(outline(a.CLASSROOM_FORMS['bloque-3'],False),outline(a.CLASSROOM_FORMS['bloque-4'],False))
    if upper_gap<1.8: raise RuntimeError('Insufficient separation between the two upper classroom bars')
    a.GEOMETRY_REVIEW['classroom_spacing']={'units':'relative design units, not surveyed meters',
        'rear_end_retraction':3.0,'transverse_offset':2.25,'transverse_length_factor':.93,
        'upper_pair_outward_offsets':.55,'upper_pair_gallery_gap':round(upper_gap,3),
        'front_pair_unchanged':True,'envelope_clearances':gaps,'narrow_uncovered_links':links,
        'description':'Clear roof and gallery gaps, with narrow uncovered circulation links.'}
