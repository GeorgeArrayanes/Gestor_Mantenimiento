"""Phase 1 / iteration 5. Visual refinement based on the corrected campus plan.

No network, application imports, endpoints or persistent campus data.
"""
import math
import random
import bpy
from mathutils import Vector


def linear(code):
    values=[int(code[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values)+(1,)


def color(mat,code,roughness=None):
    rgba=linear(code)
    mat.diffuse_color=rgba
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=rgba
    if roughness is not None: bsdf.inputs['Roughness'].default_value=roughness


def texture(mat,c1,c2,scale=1,brick=False):
    nodes,links=mat.node_tree.nodes,mat.node_tree.links
    geo=nodes.new('ShaderNodeNewGeometry')
    tex=nodes.new('ShaderNodeTexBrick' if brick else 'ShaderNodeTexNoise')
    links.new(geo.outputs['Position'],tex.inputs['Vector'])
    tex.inputs['Scale'].default_value=scale
    if brick:
        tex.inputs['Color1'].default_value=linear(c1)
        tex.inputs['Color2'].default_value=linear(c2)
        tex.inputs['Mortar'].default_value=linear('777D78')
        tex.inputs['Mortar Size'].default_value=.015
        tex.inputs['Brick Width'].default_value=.70
        tex.inputs['Row Height'].default_value=.36
        output=tex.outputs['Color']
    else:
        ramp=nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].position=.2
        ramp.color_ramp.elements[0].color=linear(c1)
        ramp.color_ramp.elements[1].position=.8
        ramp.color_ramp.elements[1].color=linear(c2)
        links.new(tex.outputs['Fac'],ramp.inputs[0])
        output=ramp.outputs['Color']
    links.new(output,nodes.get('Principled BSDF').inputs['Base Color'])
    bump=nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value=.15
    bump.inputs['Distance'].default_value=.025
    links.new(tex.outputs['Fac'],bump.inputs['Height'])
    links.new(bump.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])


def configure(a):
    palette={'grass':'54843F','grass-field':'4E8245','leaf':'477940','leaf-light':'83A34E',
             'leaf-dark':'2F603F','roof':'087DB7','roof-rib':'167CA4','glass':'285366',
             'frame':'26353E','sand':'BEBBA6','stone':'A1A79F','base':'435761',
             'asphalt':'59616A','court':'59616A','background':'DFE7EB','yellow':'F6BE19',
             'ivory':'F2EEE3','navy':'152C51','yellow-soft':'E4BA44'}
    for key,code in palette.items(): color(a.MATERIALS[key],code)
    for key,code in {'blue-panel':'164B9A','green-panel':'58A82E','play-green':'399B75',
                     'play-blue':'147CAA','terra':'B57B60','paver':'C6BDA5','cream-line':'ECDDAD',
                     'court-red':'BB6554','wood-dark':'876F4D','glass-light':'719FA8'}.items():
        a.material(key,code,.65)
    texture(a.MATERIALS['sand'],'BEBCA9','D1C9B1',.8,True)
    texture(a.MATERIALS['paver'],'B3AE98','D1C4A9',1.5,True)
    texture(a.MATERIALS['grass'],'4E7E42','608B49',.35)
    texture(a.MATERIALS['grass-field'],'4E8147','5D8B4A',.28)
    texture(a.MATERIALS['asphalt'],'4F5963','6B747A',2.8)
    texture(a.MATERIALS['wood'],'947345','BD9A66',3)
    scene=bpy.context.scene
    scene.view_settings.exposure=.05
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.40
    bpy.data.lights['Soft afternoon sun'].energy=85000
    bpy.data.lights['Facade soft fill'].energy=35000
    sun=bpy.data.lights['Broad architectural sunlight']
    sun.energy=2.3
    sun.angle=math.radians(6)
    bpy.data.objects['Broad architectural sunlight'].rotation_euler=(math.radians(28),math.radians(-28),math.radians(-38))
    glass=a.MATERIALS['canopy-glass'].node_tree.nodes.get('Principled BSDF')
    glass.inputs['Transmission Weight'].default_value=.78
    glass.inputs['Roughness'].default_value=.10
    glass.inputs['IOR'].default_value=1.25
    color(a.MATERIALS['canopy-glass'],'A5CAD3')
    ridge=a.MATERIALS['glass-light'].node_tree.nodes.get('Principled BSDF')
    color(a.MATERIALS['glass-light'],'315B73',.20)
    ridge.inputs['Metallic'].default_value=.18


def group(a,prefix):
    target=next(c for c in bpy.data.collections if c.name.startswith(prefix))
    a.COLLECTION=target
    return target


def remove_prefix(prefixes):
    for obj in list(bpy.data.objects):
        if any(obj.name.startswith(p) for p in prefixes): bpy.data.objects.remove(obj,do_unlink=True)


def ribbon(a,name,points,width,mat,z=.25):
    """Flat joined strip. Pavement and paint must never become round tubes."""
    points=[Vector((v[0],v[1],z)) if len(v)==2 else Vector((v[0],v[1],z)) for v in points]
    left=[];right=[]
    for i,p in enumerate(points):
        before=(p-points[max(0,i-1)]) if i else points[1]-p
        after=(points[min(len(points)-1,i+1)]-p) if i<len(points)-1 else before
        n1=Vector((-before.y,before.x,0)).normalized()
        n2=Vector((-after.y,after.x,0)).normalized()
        n=(n1+n2).normalized()
        reach=min(width*1.1,width/2/max(.5,n.dot(n1)))
        left.append(p+n*reach);right.append(p-n*reach)
    verts=left+right
    count=len(points)
    return a.mesh(name,verts,[(i,i+1,count+i+1,count+i) for i in range(count-1)],mat)


def refine_admin(a):
    group(a,'01 ·')
    b=a.Building('administrativo','4:37',.91,.27)
    l,w=b.length,b.width
    # Horizontal panel joints and slender end glazing visible in the tour.
    for side in (-1,1):
        b.box('end white cladding',(side*(l/2+.11),0,6.4),(.18,w+.05,12.1),a.MATERIALS['ivory'])
        for yy in (-w*.32,w*.32):
            b.box('end vertical glazing',(side*(l/2+.22),yy,6.5),(.09,w*.15,11.2),a.MATERIALS['glass'])
            for zz in (3.3,6.3,9.3):
                b.box('end glazing frame',(side*(l/2+.28),yy,zz),(.10,w*.17,.12),a.MATERIALS['frame'])
        for z in [1.1+i*.83 for i in range(14)]:
            b.box('cladding horizontal joint',(side*(l/2+.215),0,z),(.018,w,.012),a.MATERIALS['stone'])
    # The yellow facade has depth: projecting vertical reveals rather than a decal.
    for i in range(7):
        x=l*.27-l*.095+i*l*.19/6
        if abs(x-l*.27)<1.95: continue
        b.box('yellow facade reveal',(x,-w/2-.63,8.4),(.10,.18,7.65),a.MATERIALS['yellow'])
    b.box('timber entrance lining',(-l*.08,-w/2-.26,1.6),(l*.25,.22,2.45),a.MATERIALS['wood'])
    b.box('entrance glazed doors',(-l*.08,-w/2-.40,1.6),(l*.16,.09,2.35),a.MATERIALS['glass'])
    for i in range(6):
        x=-l*.20+i*l*.045
        b.box('entrance timber slat',(x,-w/2-.42,1.6),(.07,.08,2.4),a.MATERIALS['wood-dark'])
    b.box('entry paving',(-l*.08,-w/2-3.2,.20),(l*.39,3.0,.12),a.MATERIALS['paver'])
    b.line('linear drainage',[(-l*.28,-w/2-4.35,.28),(l*.11,-w/2-4.35,.28)],.045,a.MATERIALS['frame'])
    for x in (-l*.40,l*.44):
        a.planter(b.p(x,-w/2-3.15,.45),2.9,1.15,b.angle)
        a.tree(b.p(x,-w/2-3.15,.7),.68)
    direction=(-b.ey*.94-b.ex*.34).normalized()*math.sqrt(2)+Vector((0,0,1))
    a.TARGETS['administrativo'].update(center=list(b.p(0,0,5.8)),direction=list(direction.normalized()))


def school_block(a,key,region,main=False):
    if main: group(a,'02 ·')
    b=a.Building(key,region,.95,.29)
    # Keep the front pair fixed and pull back only the rear ends of the upper
    # pair. Retain their existing widths and architectural proportions.
    if key in ('bloque-3','bloque-4'):
        b.length-=3.0
        b.center-=b.ex*1.5
        b.center+=b.ey*(.55 if key=='bloque-3' else -.55)
    elif key=='bloque-atravesado':
        b.center+=b.ey*2.25
        b.length*=.93
    a.CLASSROOM_FORMS[key]=b
    l,w=b.length,b.width
    h=9.1
    b.box('paved apron',(0,0,.22),(l+1.6,w+2.5,.20),a.MATERIALS['paver'])
    b.box('white core',(0,0,h/2+.45),(l,w,h),a.MATERIALS['ivory'],.05)
    a.facade(b,3,2.9)
    for side in (-1,1):
        for floor in range(3):
            z=.7+floor*2.9
            b.box('corridor slab',(0,side*(w/2+.6),z),(l+.3,1.5,.24),a.MATERIALS['ivory'])
            b.box('dark horizontal ribbon',(0,side*(w/2+1.25),z+1.05),(l-.4,.08,.95),a.MATERIALS['frame'])
            for i in range(6):
                x=-l/2+(i+.5)*l/6
                if (i+floor)%3!=1:
                    b.box('blue green facade panel',(x,side*(w/2+1.32),z+1.10),(l/6*.79,.10,.83),a.MATERIALS['blue-panel' if floor==2 or (i+floor)%2 else 'green-panel'])
            b.box('white corridor rail',(0,side*(w/2+1.39),z+1.68),(l+.4,.13,.17),a.MATERIALS['ivory'])
        for i in range(7):
            x=-l/2+i*l/6
            b.box('white columns',(x,side*(w/2+1.22),h/2),(.16,.20,h),a.MATERIALS['ivory'])
    b.roof(h+.6,.55)
    b.box('ridge skylight',(0,0,h+1.23),(l*.90,.80,.06),a.MATERIALS['glass-light'])
    for x in (-l/2,l/2):
        b.box('end frame',(x,0,h/2+.65),(.3,w+.7,h+.75),a.MATERIALS['ivory'])
        b.box('end narrow glazing',(x+(.18 if x>0 else -.18),-w*.27,h/2+.6),(.08,w*.18,h-.6),a.MATERIALS['glass'])
        # A small layered lattice reads as the school's dark decorative screen.
        sx=x+(.23 if x>0 else -.23)
        for yy in [w*.05+i*w*.12 for i in range(4)]:
            b.box('screen upright',(sx,yy,4.8),(.08,.055,7.6),a.MATERIALS['navy'])
        for z in [1.2+i*.45 for i in range(17)]:
            b.box('screen horizontal',(sx,w*.23,z),(.07,w*.53,.055),a.MATERIALS['navy'])
            for yy in [w*.08+i*w*.14 for i in range(3)]:
                a.beam('Decorative diagonal',b.p(sx,yy,z),b.p(sx,yy+w*.12,z+.44),.045,a.MATERIALS['navy'])
    if main: a.TARGETS[key]['center']=list(b.p(0,0,4))
    else: a.TARGETS.pop(key,None)
    return b


def school_blocks(a):
    a.CLASSROOM_FORMS={}
    a.collection('02 · Bloque de salones · detailed')
    school_block(a,'salones','4:17',True)
    a.collection('05 · Cuatro bloques · context development')
    for key,region in [('bloque-2','4:15'),('bloque-3','4:19'),('bloque-4','4:21')]:
        school_block(a,key,region)
    from campus_geometry import transverse_block
    transverse_block(a)
    # Garden and paved spines between each pair make the group legible.
    for pts in [[(876,442),(1028,365)],[(1074,386),(1197,315)]]:
        ribbon(a,'Inter-block garden spine',[a.xy(p) for p in pts],1.6,a.MATERIALS['grass'],.35)
        for t in (.12,.40,.72,.91):
            pt=Vector(pts[0]).lerp(Vector(pts[1]),t)
            a.tree(a.xy(pt,.3),.55)


def preschool(a):
    a.collection('03 · Preescolar · detailed')
    p=[a.xy(v) for v in a.REGIONS['4:33']]
    c=sum(p,Vector())/len(p)
    a.slab('Preescolar irregular base',p,.12,.32,a.MATERIALS['paver'],.04)
    a.TARGETS['preescolar']={'center':list(c+Vector((0,0,4.2))),'extent':61,'region':'4:33'}
    corner=p[0]
    seam=((p[1]-corner).normalized()+(p[5]-corner).normalized()).normalized()
    normal=Vector((-seam.y,seam.x,0))
    def clip(vertices,keep):
        out=[]
        sign=1 if (keep-corner).dot(normal)>=0 else -1
        for aa,bb in zip(vertices,vertices[1:]+vertices[:1]):
            da=(aa-corner).dot(normal)*sign; db=(bb-corner).dot(normal)*sign
            if da>=0: out.append(aa)
            if (da<0)!=(db<0): out.append(aa.lerp(bb,da/(da-db)))
        return out
    def wing(name,aa,bb,width,blue=True,keep=None):
        ex=(bb-aa).normalized(); ey=Vector((-ex.y,ex.x,0)); length=(bb-aa).length
        if ey.dot(c-(aa+bb)/2)<0: ey=-ey
        mid=(aa+bb)/2+ey*width/2
        angle=math.atan2(ex.y,ex.x)
        def pt(x,y,z): return mid+ex*x+ey*y+Vector((0,0,z))
        a.box(name+' core',pt(0,0,3.8),(length,width,6.7),a.MATERIALS['ivory'],angle,.04)
        n=max(4,int(length/3))
        for floor in range(2):
            z=.8+floor*3.2
            for i in range(n):
                x=-length/2+(i+.5)*length/n
                for side in ((1,) if not blue else (-1,1)):
                    a.box(name+' glazing',pt(x,side*(width/2+.04),z+1.35),(length/n*.67,.08,2.1),a.MATERIALS['glass'],angle)
                a.box(name+' colored door',pt(x, width/2+.10,z+1.1),(.45,.10,2.15),a.MATERIALS['green-panel' if i%2 else 'yellow'],angle)
            a.box(name+' internal gallery',pt(0,width/2+.6,z-.10),(length,1.5,.20),a.MATERIALS['ivory'],angle)
            if floor:
                a.box(name+' dark gallery rail',pt(0,width/2+1.3,z+.55),(length,.09,.85),a.MATERIALS['frame'],angle)
                for i in range(n*3):
                    x=-length/2+i*length/(n*3)
                    a.box(name+' rail detail',pt(x,width/2+1.36,z+.55),(.05,.05,.70),a.MATERIALS['aluminium'],angle)
        if not blue:
            # The courtyard-facing white wing has two broad glazed openings,
            # not a repeated classroom-window grid. Keep the atrium side intact.
            for x in (-length*.245,length*.245):
                window_w=length*.405
                a.box(name+' large window reveal',pt(x,-width/2-.055,3.80),(window_w+.24,.22,5.70),a.MATERIALS['stone'],angle,.035)
                a.box(name+' large window frame',pt(x,-width/2-.18,3.80),(window_w,.12,5.48),a.MATERIALS['frame'],angle)
                a.box(name+' large glazing',pt(x,-width/2-.25,3.80),(window_w-.18,.065,5.30),a.MATERIALS['glass'],angle)
                a.box(name+' large window central mullion',pt(x,-width/2-.29,3.80),(.065,.09,5.30),a.MATERIALS['frame'],angle)
                a.box(name+' broad window sill',pt(x,-width/2-.18,.98),(window_w+.30,.38,.16),a.MATERIALS['ivory'],angle)
            a.GEOMETRY_REVIEW['preschool_lateral_facade']={'large_window_assemblies':2,'repeated_small_outer_windows':0,
                'wing':'entrance / courtyard-facing white wing','window_height':5.30,'description':'Two broad, two-storey glazed openings separated by a white central pier.'}
        for i in range(n+1):
            x=-length/2+i*length/n
            a.beam(name+' atrium upright',pt(x,width/2+1.32,.5),pt(x,width/2+1.32,7.4),.14,a.MATERIALS['frame'])
        for i in range(0,n-1,3):
            x=-length/2+i*length/n
            a.beam(name+' X brace',pt(x,width/2+1.34,.6),pt(x+length/n*2,width/2+1.34,7.0),.13,a.MATERIALS['frame'])
            a.beam(name+' X brace',pt(x,width/2+1.34,7.0),pt(x+length/n*2,width/2+1.34,.6),.13,a.MATERIALS['frame'])
        z=7.55
        if blue:
            face=[pt(-length/2,-width/2-.35,z+.20),pt(length/2,-width/2-.35,z+.20),pt(length/2,width/2+.35,z+.20),pt(-length/2,width/2+.35,z+.20)]
            if keep is not None: face=clip(face,keep)
            if len(face)>2: a.slab(name+' blue roof',face,z+.13,.14,a.MATERIALS['roof'],.02)
            for i in range(int(length/.7)):
                x=-length/2+i*.7
                aa=pt(x,-width/2-.35,z+.29);bb=pt(x,width/2+.35,z+.29)
                if keep is not None:
                    sign=1 if (keep-corner).dot(normal)>0 else -1
                    da=(aa-corner).dot(normal)*sign;db=(bb-corner).dot(normal)*sign
                    if da<0 and db<0: continue
                    if da<0: aa=aa.lerp(bb,da/(da-db))
                    elif db<0: bb=aa.lerp(bb,da/(da-db))
                a.stroke(name+' roof rib',[aa,bb],.018,a.MATERIALS['roof-rib'])
        else: a.box(name+' roof',pt(0,0,z),(length+.5,width+.5,.23),a.MATERIALS['ivory'],angle)
    wing('Preescolar north',p[0],p[1],4.8,keep=p[1])
    wing('Preescolar west',p[5],p[0],5.2,keep=p[5])
    wing('Preescolar entrance',p[5],p[4],3.6,False)
    q=[p[0]*.72+c*.28,p[1]*.64+c*.36,p[3]*.80+c*.20,p[5]*.68+c*.32]
    ground=[Vector((v.x,v.y,.53)) for v in q]
    from campus_geometry import preschool_canopy
    preschool_canopy(a,p,c)
    # Restrained stylized play markings inspired by the real painted floor.
    def flooruv(u,v):
        pos=ground[0].lerp(ground[1],u).lerp(ground[3].lerp(ground[2],u),v)
        pos.z=.575
        return pos
    track=[flooruv(.5+.32*math.cos(i*math.tau/64),.5+.29*math.sin(i*math.tau/64)) for i in range(64)]
    outer=[flooruv(.5+.35*math.cos(i*math.tau/64),.5+.32*math.sin(i*math.tau/64)) for i in range(64)]
    inner=[flooruv(.5+.29*math.cos(i*math.tau/64),.5+.26*math.sin(i*math.tau/64)) for i in range(64)]
    a.mesh('Preescolar blue learning track',outer+inner,[(i,(i+1)%64,(i+1)%64+64,i+64) for i in range(64)],a.MATERIALS['play-blue'])
    a.stroke('Preescolar track center marking',track,.035,a.MATERIALS['cream-line'],True)
    for i in range(8):
        a.beam('Preescolar crossing',flooruv(.37+i*.035,.37),flooruv(.37+i*.035,.58),.14,a.MATERIALS['cream-line'])
    for i in range(4):
        a.box('Preescolar colored seat',flooruv(.20+i*.17,.80)+Vector((0,0,.25)),(1.6,.6,.4),a.MATERIALS[['yellow','green-panel','blue-panel','coral'][i]],math.pi/4,.06)
    a.stroke('Preescolar planted edge',[a.xy(a.REGIONS['4:33'][i],.55) for i in (2,3,4)],.65,a.MATERIALS['leaf-dark'])


def simple_wing(a,key,region,height=4.4,blue=True,floors=1):
    b=a.Building(key,region,.90,.48)
    l,w=b.length,b.width
    b.box('base',(0,0,.22),(l+1,w+1,.25),a.MATERIALS['paver'])
    b.box('body',(0,0,height/2+.4),(l,w,height),a.MATERIALS['ivory'],.04)
    a.facade(b,floors,(height-.4)/floors)
    if blue: b.roof(height+.5,.45)
    else: b.box('flat roof',(0,0,height+.55),(l+.5,w+.5,.3),a.MATERIALS['roof-flat'])
    for side in (-1,1):
        for i in range(max(3,int(l/4))):
            x=-l/2+(i+.5)*l/max(3,int(l/4))
            b.box('color panel',(x,side*(w/2+.12),1.0),(2,.15,.8),a.MATERIALS['blue-panel' if i%2 else 'green-panel'])
    a.TARGETS.pop(key,None)
    return b


def context(a):
    a.collection('06 · Bachillerato transición y norte · preliminary architecture')
    import corrected_zones
    corrected_zones.bachillerato(a)
    group(a,'06 ·')
    simple_wing(a,'transicion','4:27',6.7,True,2)
    simple_wing(a,'grado-11','4:45',4.1,True,1)
    corrected_zones.gym_park(a)
    for key,region in [('comedor','4:13'),('economato','4:41'),('primeros-auxilios','4:29'),('danzas-1','4:55'),('danzas-2','4:69')]:
        simple_wing(a,key,region,3.3,key not in ('economato','tienda'),1)
    corrected_zones.tienda(a)
    # Small stylized play areas in the actual reference regions.
    for region in ('4:65','4:67','4:63'):
        points=[a.xy(p) for p in a.REGIONS[region]]
        center=sum(points,Vector())/len(points)
        a.slab('Play area rubber surfacing',points,.30,.04,a.MATERIALS['play-green'])
        for j in range(2):
            loc=center+a.R*(j*2.3-1.1)+Vector((0,0,1.0))
            a.box('Play tower platform',loc,(1.35,1.35,.18),a.MATERIALS['yellow'],math.pi/4)
            for dx in (-.5,.5):
                for dy in (-.5,.5): a.beam('Play tower post',loc+a.R*dx+a.B*dy-Vector((0,0,.65)),loc+a.R*dx+a.B*dy+Vector((0,0,1.1)),.10,a.MATERIALS['blue-panel'])
            verts=[loc+a.R*x+a.B*y+Vector((0,0,z)) for x,y,z in [(-.9,-.9,1.2),(.9,-.9,1.2),(.9,.9,1.2),(-.9,.9,1.2),(0,0,2.0)]]
            a.mesh('Play tower tent roof',verts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4)],a.MATERIALS['coral' if j else 'blue-panel'])
            a.beam('Play slide',loc+a.B*.7,loc+a.B*2.6-Vector((0,0,.65)),.55,a.MATERIALS['yellow'])


def landscape_details(a):
    a.collection('07 · Campus surfaces gardens and paths')
    a.slab('North lawn extension',[a.xy(p) for p in [(444,105),(627,106),(583,181),(388,189)]],.13,.02,a.MATERIALS['grass'])
    for point in [(465,125),(497,143),(525,119)]: a.tree(a.xy(point,.18),.8)
    for obj in bpy.data.objects:
        if obj.name.startswith('Central court') and obj.type=='MESH' and '.surface' in obj.name:
            obj.data.materials[0]=a.MATERIALS['asphalt']
        if obj.name.startswith('Central court') and obj.type=='CURVE' and not 'ring' in obj.name:
            obj.data.materials[0]=a.MATERIALS['yellow-soft']
    # Painted multi-sport overlays sit on one continuous hard court.
    for offset in (0,220,430):
        pts=[(800+offset,721),(932+offset,741),(961+offset,902),(776+offset,878)]
        a.stroke('Red multi-sport court',[a.xy(p,.284) for p in pts],.047,a.MATERIALS['court-red'],True)
    # Wide identifiable access route and smaller paved garden routes.
    for name,points,width,mat in [
        ('Central terracotta walk',[(783,627),(914,632),(1098,512),(1390,728)],.95,'terra'),
        ('North pedestrian spine',[(821,349),(862,294),(969,270)],.72,'paver'),
        ('Preschool pedestrian link',[(1365,601),(1478,670),(1516,728)],.75,'paver')]:
        ribbon(a,name,[a.xy(p) for p in points],width*2,a.MATERIALS[mat],.27)
    # Striping on the football turf is subtle and follows the traced field.
    corners=[Vector(p) for p in [(420,215),(887,215),(872,284),(352,269)]]
    for i in range(8):
        if i%2: continue
        q=[corners[0].lerp(corners[1],i/8),corners[0].lerp(corners[1],(i+1)/8),corners[3].lerp(corners[2],(i+1)/8),corners[3].lerp(corners[2],i/8)]
        a.slab('Subtle mown turf stripe',[a.xy(p) for p in q],.225,.002,a.MATERIALS['grass'])
    # Football goals are generated with their field markings. Landscape groups
    # and perimeter hedges retain the same positions as the previous iteration.
    for point in [(937,333),(949,354),(1141,438),(1172,454),(1230,497),(1361,551),(1456,597),(679,769),(664,821),(1636,676),(960,191),(1104,194)]:
        a.tree(a.xy(point,.22),random.uniform(.60,.90))
    for start,end in [((306,280),(782,291)),((645,602),(541,848)),((956,195),(1113,197))]:
        a.stroke('Campus clipped hedge',[a.xy(start,.60),a.xy(end,.60)],.42,a.MATERIALS['leaf-dark'])
    # Planting islands between courtyard and paths.
    for point in [(871,618),(927,600),(1074,541),(1427,706),(1255,502)]:
        pos=a.xy(point,.45)
        a.planter(pos,3.2,1.4,math.pi/4)
        a.tree(pos+Vector((0,0,.35)),.55)
