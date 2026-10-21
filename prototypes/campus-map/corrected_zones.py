"""Resolved context for visual iteration 3: Bachillerato, outdoor GYM, Tienda 1."""
import math
import bpy
from mathutils import Vector


def bachillerato(a):
    a.collection('08 · Bachillerato · refined')
    b=a.Building('bachillerato','4:25',.92,.86)
    l,w=b.length,b.width
    height=8.5
    # A complete enclosed teaching building replaces the oversized empty U.
    a.slab('Bachillerato reference plinth',[a.xy(p) for p in a.REGIONS['4:25']],.14,.26,a.MATERIALS['paver'],.05)
    b.box('enclosed teaching volume',(0,0,height/2+.45),(l,w,height),a.MATERIALS['ivory'],.09)
    a.facade(b,3,2.65)
    for side in (-1,1):
        y=side*(w/2+.13)
        for i in range(7):
            x=-l/2+(i+.5)*l/7
            for floor in range(3):
                b.box('deep white window jamb',(x,y,.8+floor*2.65+1.2),(.11,.30,2.42),a.MATERIALS['ivory'])
        for z in (1.0,3.6,6.25):
            b.box('blue facade band',(0,y+side*.06,z),(l-.5,.13,.42),a.MATERIALS['blue-panel'])
    # The south-facing glass hall and its white portal recall the aerial view.
    front=-w/2-.32
    b.box('main glass hall',(0,front,3.15),(l*.73,.28,5.55),a.MATERIALS['glass'])
    for x in (-l*.38,l*.38):
        b.box('portal pier',(x,front-.18,3.4),(.55,.65,6.4),a.MATERIALS['ivory'])
    b.box('portal lintel',(0,front-.18,6.66),(l*.80,.70,.46),a.MATERIALS['ivory'])
    for i in range(10):
        x=-l*.36+i*l*.72/9
        b.box('hall mullion',(x,front-.20,3.15),(.065,.12,5.5),a.MATERIALS['frame'])
    for z in (2.6,4.75):
        b.box('hall transom',(0,front-.20,z),(l*.73,.12,.08),a.MATERIALS['frame'])
    b.box('entrance canopy',(0,front-1.3,3.0),(l*.46,2.7,.24),a.MATERIALS['ivory'],.04)
    b.box('double entrance doors',(0,front-.24,1.45),(2.5,.12,2.3),a.MATERIALS['glass-light'])
    for x in (-l*.2,l*.2):
        b.box('entrance post',(x,front-2.5,1.4),(.12,.12,2.8),a.MATERIALS['frame'])
    # The front of the real footprint is the end facing the central campus,
    # with a tall glazed hall instead of the previous generic end-window grid.
    end=1 if b.ex.dot(a.CAM_DIRECTION)>0 else -1
    xfront=end*(l/2+.22)
    b.box('campus front curtain wall',(xfront,0,4.05),(.18,w*.76,7.20),a.MATERIALS['glass'])
    for yy in (-w*.40,w*.40):
        b.box('campus front portal pier',(xfront+end*.1,yy,4.25),(.50,.50,7.7),a.MATERIALS['ivory'])
    b.box('campus front white lintel',(xfront+end*.1,0,8.15),(.55,w*.84,.44),a.MATERIALS['ivory'])
    for i in range(10):
        yy=-w*.37+i*w*.74/9
        b.box('campus front glazing mullion',(xfront+end*.12,yy,4.05),(.10,.065,7.2),a.MATERIALS['frame'])
    for z in (2.95,5.55):
        b.box('campus front transom',(xfront+end*.13,0,z),(.12,w*.76,.10),a.MATERIALS['frame'])
    b.box('campus front entrance canopy',(xfront+end*1.35,0,3.0),(2.6,w*.46,.22),a.MATERIALS['ivory'],.03)
    b.box('campus front doors',(xfront+end*.20,0,1.6),(.08,2.3,2.35),a.MATERIALS['glass-light'])
    # White roof framework, six blue roof fields and two linear glazed monitors.
    roof_z=height+.62
    b.box('continuous white roof',(0,0,roof_z),(l+1,w+1,.42),a.MATERIALS['ivory'],.06)
    for x in (-l/2,l/2):
        b.box('white roof parapet',(x,0,roof_z+.40),(.30,w+.6,.5),a.MATERIALS['ivory'])
    for row in (-1,1):
        yc=row*w*.27
        for col in range(3):
            xc=(col-1)*l*.305
            panel_l=l*.278;panel_w=w*.35
            verts=[b.p(xc+xx,yc+yy,roof_z+zz) for xx,yy,zz in [
                (-panel_l/2,-panel_w/2,.28),(panel_l/2,-panel_w/2,.28),
                (panel_l/2,panel_w/2,.62),(-panel_l/2,panel_w/2,.62)]]
            a.mesh('Bachillerato blue roof section',verts,[(0,1,2,3)],a.MATERIALS['roof'])
            for i in range(max(4,int(panel_l/.6))):
                xx=xc-panel_l/2+i*.6
                b.line('roof standing seam',[(xx,yc-panel_w/2,roof_z+.30),(xx,yc+panel_w/2,roof_z+.64)],.018,a.MATERIALS['roof-rib'])
    for x in (-l*.19,l*.19):
        monitor_l=l*.25
        b.box('roof monitor white base',(x,0,roof_z+.45),(monitor_l,1.8,.45),a.MATERIALS['ivory'])
        for sign in (-1,1):
            face=[b.p(x-monitor_l/2,sign*.8,roof_z+.65),b.p(x+monitor_l/2,sign*.8,roof_z+.65),
                  b.p(x+monitor_l/2,0,roof_z+1.1),b.p(x-monitor_l/2,0,roof_z+1.1)]
            a.mesh('Bachillerato glazed roof monitor',face,[(0,1,2,3)],a.MATERIALS['glass-light'])
        for i in range(5):
            xx=x-monitor_l/2+i*monitor_l/4
            b.line('monitor glazing frame',[(xx,-.8,roof_z+.67),(xx,0,roof_z+1.12),(xx,.8,roof_z+.67)],.035,a.MATERIALS['frame'])
    for x in (-l*.37,l*.37):
        a.planter(b.p(x,front-3.1,.5),2.5,1.0,b.angle)
        a.tree(b.p(x,front-3.1,.9),.65)
    a.TARGETS['bachillerato'].update(center=list(b.p(0,0,4.4)),extent=l*1.6,collections=['08 ·'])
    a.GEOMETRY_REVIEW['bachillerato']={'region':'4:25','enclosed_storeys':3,
        'open_courtyard_removed':True,'continuous_roof':True,'blue_roof_fields':6,
        'glazed_roof_monitors':2,'glass_entrance_hall':True}


def gym_park(a):
    from refine_scene import group
    group(a,'06 ·')
    points=[a.xy(p) for p in a.REGIONS['4:47']]
    center=sum(points,Vector())/len(points)
    a.slab('GYM outdoor rubber surface',points,.14,.11,a.MATERIALS['play-green'],.03)
    a.stroke('GYM outdoor perimeter',[p+Vector((0,0,.27)) for p in points],.045,a.MATERIALS['cream-line'],True)
    base=center-a.R*.95-a.B*.4
    for x,h in [(-.8,2.0),(.8,2.0),(1.4,1.25)]:
        foot=base+a.R*x+Vector((0,0,.25))
        a.beam('GYM outdoor exercise upright',foot,foot+Vector((0,0,h)),.10,a.MATERIALS['frame'])
        a.box('GYM apparatus foot',foot,(.30,.30,.12),a.MATERIALS['aluminium'])
    a.beam('GYM outdoor pull-up bar',base-a.R*.8+Vector((0,0,2.25)),base+a.R*.8+Vector((0,0,2.25)),.09,a.MATERIALS['blue-panel'])
    a.beam('GYM outdoor low bar',base+a.R*.8+Vector((0,0,1.50)),base+a.R*1.4+Vector((0,0,1.50)),.08,a.MATERIALS['blue-panel'])
    # Open exercise bench and balance/step equipment; no roof or wall elements.
    seat=center+a.B*1.3+a.R*.3+Vector((0,0,.65))
    a.box('GYM outdoor exercise bench',seat,(1.5,.48,.15),a.MATERIALS['wood'],math.pi/4,.04)
    for dx in (-.50,.50):
        a.beam('GYM bench support',seat+a.R*dx-Vector((0,0,.40)),seat+a.R*dx,.08,a.MATERIALS['frame'])
    for i in range(3):
        pos=center+a.R*(i*.62-1.1)+a.B*1.7+Vector((0,0,.35+i*.05))
        a.box('GYM outdoor step',pos,(.42,.42,.20),a.MATERIALS['blue-panel'],math.pi/4,.035)
    a.GEOMETRY_REVIEW['gym']={'region':'4:47','type':'open_air_exercise_park','building':False,
                             'walls':0,'roof':0,'equipment':['pull-up bars','exercise bench','steps']}


def tienda(a):
    from refine_scene import group,ribbon
    group(a,'06 ·')
    for obj in list(bpy.data.objects):
        if obj.name.startswith('Tienda 1 · reference'): bpy.data.objects.remove(obj,do_unlink=True)
    b=a.Building('tienda','4:35',.90,.48)
    original=b.center.copy()
    tip=a.xy(a.REGIONS['4:33'][4])
    previous=a.xy(a.REGIONS['4:33'][5])
    outward=(tip-previous).normalized()
    ends=[b.p(-b.length/2,0,0),b.p(b.length/2,0,0)]
    near=min(ends,key=lambda p:(p-tip).length)
    original_gap=(near-tip).length
    head=tip+outward*1.8
    b.center+=head-near
    l,w=b.length,b.width
    b.box('compact paving base',(0,0,.24),(l+1,w+1,.22),a.MATERIALS['paver'])
    b.box('shop body',(0,0,1.95),(l,w,3.3),a.MATERIALS['ivory'],.04)
    for side in (-1,1):
        for i in range(max(5,int(l/2.5))):
            count=max(5,int(l/2.5));x=-l/2+(i+.5)*l/count
            b.box('shopfront glazing',(x,side*(w/2+.06),1.9),(l/count-.32,.09,2.1),a.MATERIALS['glass'])
            b.box('shopfront transom',(x,side*(w/2+.13),2.35),(l/count-.28,.09,.07),a.MATERIALS['frame'])
        b.box('shop blue fascia',(0,side*(w/2+.16),2.96),(l,.18,.25),a.MATERIALS['blue-panel'])
    b.box('shop white flat roof',(0,0,3.72),(l+.65,w+.65,.26),a.MATERIALS['ivory'],.04)
    b.box('shop inset roof',(0,0,3.87),(l-.5,w-.5,.06),a.MATERIALS['roof-flat'])
    ribbon(a,'Tienda short pedestrian connection',[tip,head],2.2,a.MATERIALS['paver'],.30)
    # A thin awning marks the connection while preserving a small readable gap.
    mid=(tip+head)/2+Vector((0,0,3.53))
    angle=math.atan2(outward.y,outward.x)
    a.box('Tienda entrance link awning',mid,(1.9,2.0,.16),a.MATERIALS['ivory'],angle)
    a.TARGETS.pop('tienda',None)
    a.TARGETS['preescolar']['extra_object_prefixes']=['tienda.','Tienda ']
    a.GEOMETRY_REVIEW['tienda']={'region':'4:35','moved_toward_preschool':True,
        'original_center':list(original),'new_center':list(b.center),'translation':list(b.center-original),
        'original_head_to_preschool_tip':round(original_gap,3),'new_head_to_preschool_tip':1.8,
        'description':'Shop head moved next to the end of the white preschool wing; short paved link.'}
