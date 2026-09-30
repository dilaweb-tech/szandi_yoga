# Szandi Yoga – realisztikus gyertya, Blender 5.2 / Cycles.
# Futtatás (fejléc nélkül):
#   blender -b --factory-startup --python gyertya_blender.py -- mode=preview res=600 samples=96
# mode: preview | day | night | flame | blend
#   preview  – nappali kép lánggal együtt, gyors ellenőrzéshez (img/_preview.png)
#   day      – gyertyatest nappali fénnyel, átlátszó háttér (img/gyertya-nappal.webp)
#   night    – gyertyatest csak a láng fényével          (img/gyertya-este.webp)
#   flame    – a láng hurkolt animációja sprite-lapként  (img/gyertya-lang.webp + lang.json)
#   blend    – csak elmenti a jelenetet (gyertya.blend)
# Mértékegység: 1 egység = 1 cm. A kamera a -Y oldalról néz.
import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector

ARGS = dict(a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else {}
MODE = ARGS.get('mode', 'preview')
RES = int(ARGS.get('res', 1024))
SAMPLES = int(ARGS.get('samples', 512))
FRAMES = int(ARGS.get('frames', 64))
HERE = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python') + 1]))
OUT = os.path.join(HERE, 'img')
os.makedirs(OUT, exist_ok=True)
TAU = math.tau


def lin(h):
    """#rrggbb (sRGB) -> lineáris RGBA"""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


WAX, DISH = lin('#F1DCB8'), lin('#5B3F3E')

# ---------------------------------------------------------------- geometria
R, Z0 = 3.5, 0.35                 # gyertya sugara, a tál aljának magassága
HTOP = Z0 + 10.3                  # a perem legmagasabb pontja
HP = HTOP - 1.15                  # az olvadt tó szintje
rng = random.Random(11)


def harmonics(kmax, amp):
    hs = [(k, rng.uniform(.4, 1) / k ** .8, rng.uniform(0, TAU)) for k in range(2, kmax)]
    lo = min(sum(a * math.sin(k * t / 90 * TAU + p) for k, a, p in hs) for t in range(90))
    hi = max(sum(a * math.sin(k * t / 90 * TAU + p) for k, a, p in hs) for t in range(90))
    return lambda th: amp * (sum(a * math.sin(k * th + p) for k, a, p in hs) - lo) / (hi - lo)


rim_n = harmonics(10, 1.0)        # 0..1, a leégett perem egyenetlensége
wall_n = harmonics(8, 1.0)


def adiff(a, b):
    return (a - b + math.pi) % TAU - math.pi


# csorgások: szög (fok), hossz, szélesség, vastagság – mind cm
DRIPS = [(-35, 5.4, .36, .36), (-100, 9.9, .44, .3), (-142, 2.6, .27, .24), (-66, 1.3, .22, .17),
         (-8, 3.1, .26, .22), (-170, 1.8, .23, .19), (40, 3.2, .27, .22), (118, 6.2, .32, .28), (-122, .8, .2, .14)]
DRIPS = [(math.radians(a), L, w, t) for a, L, w, t in DRIPS]


def rim_h(th):
    h = HTOP - .3 * rim_n(th)
    for a, L, w, t in DRIPS:          # ahol a viasz átbukott, ott a perem is lejjebb van
        h -= t * (1.4 if L > 5 else .7) * math.exp(-(adiff(th, a) * R / (w * 1.6)) ** 2)
    return h


def drip_off(th, z):
    off = 0.0
    for a, L, w, t in DRIPS:
        zs = rim_h(a) - .25
        s = (zs - z) / L
        if s < 0:
            A = .5 * math.exp(-(s * L / .3) ** 2)
        elif s <= 1:
            A = .5 + .5 * s
        else:
            A = math.exp(-((s - 1) * L / (.7 * w)) ** 2)
        bulb = math.exp(-((s - .97) * L / (1.2 * w)) ** 2)
        A += .9 * bulb
        W = w * (.8 + .2 * min(max(s, 0), 1) + .5 * bulb) * (1 + .18 * math.sin(z * 2.3 + a * 7))
        wob = .1 * math.sin(max(s, 0) * L * .8 + a * 3) * min(max(s, 0) * 4, 1)   # a csorgás kanyarog
        off += t * A * math.exp(-((adiff(th, a) * R - wob) / W) ** 2)
    return off


def catmull(pts, n):
    """Catmull–Rom a pontokon át, n mintával, az utolsó pont nélkül"""
    P = [pts[0]] + pts + [pts[-1]]
    out, seg = [], len(pts) - 1
    for k in range(n):
        u = k / n * seg
        i = int(u); f = u - i
        p0, p1, p2, p3 = P[i], P[i + 1], P[i + 2], P[i + 3]
        out.append(tuple(.5 * (2 * p1[d] + (-p0[d] + p2[d]) * f + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * f * f
                               + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * f ** 3) for d in (0, 1)))
    return out


def candle_profile(th):
    hr = rim_h(th); hw = hr - .25
    pts = [(.02 + (R - .14) * i / 8, Z0) for i in range(8)]
    pts += [(R - .12 + .12 * math.cos(-math.pi / 2 + math.pi / 2 * i / 6), Z0 + .12 + .12 * math.sin(-math.pi / 2 + math.pi / 2 * i / 6)) for i in range(6)]
    nw = 320
    pts += [(R, Z0 + .12 + (hw - Z0 - .12) * i / nw) for i in range(nw)]
    pts += catmull([(R, hw), (R - .04, hr - .08), (R - .18, hr), (R - .34, hr - .07), (R - .44, hr - .24),
                    (R - .5, HP + .15), (R - .66, HP + .01), (R - .86, HP)], 56)
    pts += [((R - .86) * (1 - i / 24) + .02 * i / 24, HP) for i in range(25)]
    # a fal és a perem külső íve kapja a csorgásokat és a finom egyenetlenséget
    return [(r + (drip_off(th, z) + .012 * wall_n(th) + .004 * math.sin(z * 1.7 + th * 3)) if r >= R - .1 else r, z)
            for r, z in pts]


def lathe(name, prof, nt, center_lo, center_hi):
    """Forgástest: prof(th) -> [(rho, z)], két pólussal. Egyetlen zárt háló."""
    rows = [prof(TAU * i / nt) for i in range(nt)]
    m = len(rows[0])
    verts = [(r * math.cos(TAU * i / nt), r * math.sin(TAU * i / nt), z) for i, row in enumerate(rows) for r, z in row]
    lo, hi = len(verts), len(verts) + 1
    verts += [(0, 0, center_lo), (0, 0, center_hi)]
    faces = []
    for i in range(nt):
        i2 = (i + 1) % nt
        for j in range(m - 1):
            faces.append((i * m + j, i2 * m + j, i2 * m + j + 1, i * m + j + 1))
        faces.append((lo, i2 * m, i * m))
        faces.append((hi, i * m + m - 1, i2 * m + m - 1))
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


# ---------------------------------------------------------------- anyagok
def mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes, m.node_tree.links


def node(nodes, t, **kw):
    n = nodes.new(t)
    for k, v in kw.items():
        if k in n.inputs:
            n.inputs[k].default_value = v
        else:
            setattr(n, k, v)
    return n


def ramp(nodes, stops):
    n = nodes.new('ShaderNodeValToRGB')
    el = n.color_ramp.elements
    while len(el) > len(stops):
        el.remove(el[-1])
    while len(el) < len(stops):
        el.new(0)
    for e, (p, c) in zip(el, stops):
        e.position, e.color = p, (c, c, c, 1) if isinstance(c, (int, float)) else c
    return n


def wax_mat(name, rough, sss_scale):
    m, N, L = mat(name)
    p = N['Principled BSDF']
    p.subsurface_method = 'RANDOM_WALK'
    for k, v in {'Subsurface Weight': 1.0, 'Subsurface Radius': (1.0, .4, .15), 'Subsurface Scale': sss_scale,
                 'Roughness': rough, 'IOR': 1.44, 'Specular IOR Level': .5}.items():
        p.inputs[k].default_value = v
    tc = node(N, 'ShaderNodeTexCoord')
    # enyhe színeltérés (öntési foltok), és a láng közelében kicsit melegebb
    n1 = node(N, 'ShaderNodeTexNoise', **{'Scale': 1.6, 'Detail': 4.0})
    L.new(tc.outputs['Object'], n1.inputs['Vector'])
    cr = ramp(N, [(.35, WAX), (.7, tuple(c * .93 for c in WAX[:3]) + (1,))])
    L.new(n1.outputs['Fac'], cr.inputs['Fac'])
    L.new(cr.outputs['Color'], p.inputs['Base Color'])
    # felület: apró gödröcskék + függőleges öntési csíkok
    mp = node(N, 'ShaderNodeMapping'); mp.inputs['Scale'].default_value = (1, 1, .3)
    L.new(tc.outputs['Object'], mp.inputs['Vector'])
    n2 = node(N, 'ShaderNodeTexNoise', **{'Scale': 9.0, 'Detail': 3.0})
    L.new(mp.outputs['Vector'], n2.inputs['Vector'])
    n3 = node(N, 'ShaderNodeTexNoise', **{'Scale': 38.0, 'Detail': 8.0, 'Roughness': .6})
    L.new(tc.outputs['Object'], n3.inputs['Vector'])
    mx = node(N, 'ShaderNodeMath', operation='MULTIPLY_ADD'); mx.inputs[1].default_value = .3
    L.new(n2.outputs['Fac'], mx.inputs[0]); L.new(n3.outputs['Fac'], mx.inputs[2])
    bp = node(N, 'ShaderNodeBump', **{'Strength': .22, 'Distance': .015})
    L.new(mx.outputs['Value'], bp.inputs['Height'])
    L.new(bp.outputs['Normal'], p.inputs['Normal'])
    rr = ramp(N, [(.3, rough * .75), (.75, rough * 1.25)])
    L.new(n3.outputs['Fac'], rr.inputs['Fac'])
    L.new(rr.outputs['Color'], p.inputs['Roughness'])
    return m


def dish_mat():
    m, N, L = mat('Keramia')
    p = N['Principled BSDF']
    for k, v in {'Roughness': .38, 'Coat Weight': 1.0, 'Coat Roughness': .07, 'Coat IOR': 1.52}.items():
        p.inputs[k].default_value = v
    tc = node(N, 'ShaderNodeTexCoord')
    geo = node(N, 'ShaderNodeNewGeometry')
    n1 = node(N, 'ShaderNodeTexNoise', **{'Scale': 2.2, 'Detail': 6.0})
    L.new(tc.outputs['Object'], n1.inputs['Vector'])
    base = ramp(N, [(.3, tuple(c * .72 for c in DISH[:3]) + (1,)), (.72, tuple(min(1, c * 1.22) for c in DISH[:3]) + (1,))])
    L.new(n1.outputs['Fac'], base.inputs['Fac'])
    # az élen elvékonyodó máz: a peremen világosabb, homokszínű agyag sejlik át
    edge = ramp(N, [(.5, 0.0), (.56, 1.0)])
    L.new(geo.outputs['Pointiness'], edge.inputs['Fac'])
    mix = node(N, 'ShaderNodeMix', data_type='RGBA')
    L.new(edge.outputs['Color'], mix.inputs['Factor'])
    L.new(base.outputs['Color'], mix.inputs['A'])
    mix.inputs['B'].default_value = lin('#9C7A64')
    # pöttyös kőagyag
    vo = node(N, 'ShaderNodeTexVoronoi', **{'Scale': 55.0})
    L.new(tc.outputs['Object'], vo.inputs['Vector'])
    dots = ramp(N, [(0.0, 0.0), (.07, 1.0)])
    L.new(vo.outputs['Distance'], dots.inputs['Fac'])
    mul = node(N, 'ShaderNodeMix', data_type='RGBA', blend_type='MULTIPLY')
    mul.inputs['Factor'].default_value = 1.0
    L.new(mix.outputs['Result'], mul.inputs['A'])
    dm = node(N, 'ShaderNodeMix', data_type='RGBA')
    L.new(dots.outputs['Color'], dm.inputs['Factor'])
    dm.inputs['A'].default_value = (.55, .5, .48, 1)
    dm.inputs['B'].default_value = (1, 1, 1, 1)
    L.new(dm.outputs['Result'], mul.inputs['B'])
    L.new(mul.outputs['Result'], p.inputs['Base Color'])
    nb = node(N, 'ShaderNodeTexNoise', **{'Scale': 14.0, 'Detail': 6.0})
    L.new(tc.outputs['Object'], nb.inputs['Vector'])
    bp = node(N, 'ShaderNodeBump', **{'Strength': .08, 'Distance': .02})
    L.new(nb.outputs['Fac'], bp.inputs['Height'])
    L.new(bp.outputs['Normal'], p.inputs['Normal'])
    return m


def emit_mat(name, color, strength):
    m, N, L = mat(name)
    N.remove(N['Principled BSDF'])
    e = node(N, 'ShaderNodeEmission', **{'Color': color, 'Strength': strength})
    L.new(e.outputs['Emission'], N['Material Output'].inputs['Surface'])
    return m


def flame_mat(name, stops_c, stops_s, strength, power, alpha_mul):
    """Áttetsző, önvilágító héj: szín és erő a magasság szerint, a széle elhalványul."""
    m, N, L = mat(name)
    N.remove(N['Principled BSDF'])
    tc = node(N, 'ShaderNodeTexCoord')
    sp = node(N, 'ShaderNodeSeparateXYZ')
    L.new(tc.outputs['Generated'], sp.inputs['Vector'])
    col = ramp(N, stops_c)
    stn = ramp(N, stops_s)
    L.new(sp.outputs['Z'], col.inputs['Fac']); L.new(sp.outputs['Z'], stn.inputs['Fac'])
    lw = node(N, 'ShaderNodeLayerWeight', **{'Blend': .5})
    inv = node(N, 'ShaderNodeMath', operation='SUBTRACT'); inv.inputs[0].default_value = 1.0
    L.new(lw.outputs['Facing'], inv.inputs[1])
    pw = node(N, 'ShaderNodeMath', operation='POWER'); pw.inputs[1].default_value = power
    L.new(inv.outputs['Value'], pw.inputs[0])
    am = node(N, 'ShaderNodeMath', operation='MULTIPLY'); am.inputs[1].default_value = alpha_mul
    L.new(pw.outputs['Value'], am.inputs[0])
    sm = node(N, 'ShaderNodeMath', operation='MULTIPLY'); sm.inputs[1].default_value = strength
    sm.name = 'flicker'
    L.new(stn.outputs['Color'], sm.inputs[0])
    em = node(N, 'ShaderNodeEmission')
    L.new(col.outputs['Color'], em.inputs['Color']); L.new(sm.outputs['Value'], em.inputs['Strength'])
    tr = node(N, 'ShaderNodeBsdfTransparent')
    mx = node(N, 'ShaderNodeMixShader')
    L.new(am.outputs['Value'], mx.inputs['Fac'])
    L.new(tr.outputs['BSDF'], mx.inputs[1]); L.new(em.outputs['Emission'], mx.inputs[2])
    L.new(mx.outputs['Shader'], N['Material Output'].inputs['Surface'])
    return m


# ---------------------------------------------------------------- jelenet
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
sc = bpy.context.scene

candle = lathe('Gyertya', candle_profile, 480, Z0, HP)
candle.data.materials.append(wax_mat('Viasz', .3, .55))

bpy.ops.mesh.primitive_circle_add(vertices=160, radius=R - .6, fill_type='TRIFAN', location=(0, 0, HP + .025))
pool = bpy.context.object; pool.name = 'OlvadtTo'
pool.data.materials.append(wax_mat('OlvadtViasz', .03, .3))
pool.visible_shadow = False       # a láng fénye akadálytalanul éri a gyertya belsejét → a fal izzik

# a tálra lecsorgott, megdermedt viaszfolt a hosszú csorgás alatt
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1)
puddle = bpy.context.object; puddle.name = 'ViaszFolt'
a = DRIPS[1][0]
puddle.location = ((R + .12) * math.cos(a), (R + .12) * math.sin(a), Z0)
puddle.scale = (.72, .5, .11); puddle.rotation_euler = (0, 0, a)
bpy.ops.object.shade_smooth()
puddle.data.materials.append(candle.data.materials[0])

DISH_PTS = [(.01, 0), (3.8, 0), (4.02, .04), (4.12, .14), (5.0, .46), (5.55, .92), (5.82, 1.14), (5.8, 1.27),
            (5.62, 1.24), (5.3, .98), (4.8, .56), (4.2, Z0 + .02), (3.0, Z0), (.01, Z0)]
dish = lathe('Tal', lambda th: catmull(DISH_PTS, 150) + [DISH_PTS[-1]], 256, 0, Z0)
dish.data.materials.append(dish_mat())

ground = bpy.data.objects.new('Arnyekfogo', bpy.data.meshes.new('ground'))
ground.data.from_pydata([(-200, -200, 0), (200, -200, 0), (200, 200, 0), (-200, 200, 0)], [], [(0, 1, 2, 3)])
sc.collection.objects.link(ground)
ground.is_shadow_catcher = True

# kanóc: enyhén meghajló, szenes szál, izzó véggel
cu = bpy.data.curves.new('kanoc', 'CURVE'); cu.dimensions = '3D'
cu.bevel_depth, cu.bevel_resolution = .045, 4
spl = cu.splines.new('POLY'); spl.points.add(23)
for k, pt in enumerate(spl.points):
    t = k / 23
    pt.co = (.2 * t ** 2.4, 0, HP - .2 + .95 * t, 1)
    pt.radius = 1 - .35 * t
wick = bpy.data.objects.new('Kanoc', cu); sc.collection.objects.link(wick)
wick.data.materials.append(wax_mat('Szen', .8, .01))
wm = wick.data.materials[0].node_tree.nodes['Principled BSDF']
wm.inputs['Base Color'].default_value = lin('#1b130e'); wm.inputs['Subsurface Weight'].default_value = 0
for l in list(wick.data.materials[0].node_tree.links):
    if l.to_socket == wm.inputs['Base Color']:
        wick.data.materials[0].node_tree.links.remove(l)
WTIP = Vector((.2, 0, HP + .75))
bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=.05, location=WTIP)
ember = bpy.context.object; ember.name = 'Parazs'
ember.data.materials.append(emit_mat('Parazs', lin('#ff5a1a'), 6))

# láng
FB, HF, RMAX = HP + .38, 3.7, .6
FX = .07


def flame_obj(name, rscale, hscale, zoff, material):
    def prof(th):
        return [(RMAX * rscale * (u ** .5) * (1 - u) ** 1.15 / .5186, zoff + HF * hscale * u)
                for u in (.002 + .996 * i / 90 for i in range(91))]
    ob = lathe(name, prof, 64, zoff, zoff + HF * hscale)
    ob.location = (FX, 0, FB)
    vg = ob.vertex_groups.new(name='csucs')
    for v in ob.data.vertices:
        vg.add([v.index], max(0.0, (v.co.z - zoff) / (HF * hscale)) ** 1.7, 'REPLACE')
    ob.data.materials.append(material)
    return ob


flame = flame_obj('Lang', 1, 1, 0, flame_mat('Lang', [
    (0, (.05, .18, 1, 1)), (.1, (.1, .3, 1, 1)), (.17, (1, .3, .04, 1)), (.28, (1, .52, .12, 1)),
    (.45, (1, .66, .24, 1)), (.7, (1, .55, .16, 1)), (.88, (1, .36, .07, 1)), (1, (.85, .2, .04, 1))],
    [(0, 0.0), (.04, .5), (.12, .35), (.2, .55), (.34, 1.0), (.7, .85), (.9, .35), (1, 0.0)], 7, 1.3, 1.0))
# a forró, sárgásfehér mag – a sötét, nem világító zóna fölött kezdődik
core = flame_obj('LangMag', .56, .66, .5, flame_mat('LangMag', [
    (0, (1, .8, .45, 1)), (.3, (1, .95, .8, 1)), (.7, (1, .9, .66, 1)), (1, (1, .7, .35, 1))],
    [(0, 0.0), (.14, .8), (.35, 1.0), (.75, .8), (1, 0.0)], 16, 2.0, 1.0))
halo = flame_obj('LangFeny', 1.9, 1.12, -.25, flame_mat('LangFeny', [
    (0, (1, .45, .1, 1)), (1, (1, .6, .2, 1))], [(0, 0.0), (.3, 1.0), (.8, .6), (1, 0.0)], 1.2, 4.0, .12))
FLAMES = (flame, core, halo)

# a láng mozgása: két-két, egymásba úsztatott zaj-eltolás X és Y irányban → a hurok varrat nélküli
tex = bpy.data.textures.new('lang_zaj', 'CLOUDS')
tex.noise_scale, tex.noise_depth = 2.6, 1
EMP = {}
for axis in 'XY':
    for k in 'ab':
        e = bpy.data.objects.new(f'zaj_{axis}{k}', None); sc.collection.objects.link(e)
        EMP[axis + k] = e
        for ob in FLAMES:
            md = ob.modifiers.new(f'{axis}{k}', 'DISPLACE')
            md.texture, md.texture_coords, md.texture_coords_object = tex, 'OBJECT', e
            md.direction, md.vertex_group, md.mid_level = axis, 'csucs', .5


def set_flame(t):
    """t: 0..1 a hurkon belül. t=1 pontosan t=0 állapota."""
    V, S = 7.0, .8
    for axis, dx in (('X', 0.0), ('Y', 37.0)):
        EMP[axis + 'a'].location = (dx, 0, -V * t)
        EMP[axis + 'b'].location = (dx, 0, -V * (t - 1))
        for ob in FLAMES:
            ob.modifiers[axis + 'a'].strength = S * math.cos(math.pi / 2 * t)
            ob.modifiers[axis + 'b'].strength = S * math.sin(math.pi / 2 * t)
    sz = 1 + .05 * math.sin(TAU * 2 * t) + .03 * math.sin(TAU * 5 * t + 1.3) + .018 * math.sin(TAU * 9 * t + .4)
    sx = 1 - .5 * (sz - 1)
    for ob in FLAMES:
        ob.scale = (sx, sx, sz)
    for mname, base in (('Lang', 7), ('LangMag', 16), ('LangFeny', 1.2)):
        bpy.data.materials[mname].node_tree.nodes['flicker'].inputs[1].default_value = base * (.94 + .06 * sz / 1.05)


set_flame(0)

# fények
def sun(name, frm, strength, angle, color=(1, 1, 1)):
    ld = bpy.data.lights.new(name, 'SUN'); ld.energy, ld.angle, ld.color = strength, math.radians(angle), color
    ob = bpy.data.objects.new(name, ld); sc.collection.objects.link(ob)
    ob.rotation_euler = (-Vector(frm)).normalized().to_track_quat('-Z', 'Y').to_euler()
    return ob


key = sun('Ablak', (-1.1, -.7, 1.8), 3.0, 24, (1, .96, .9))
rim = sun('Perem', (1.2, 1.4, .7), 1.4, 8, (.9, .95, 1))
sb = bpy.data.lights.new('Softbox', 'AREA'); sb.shape, sb.size, sb.size_y = 'RECTANGLE', 30, 45
sbo = bpy.data.objects.new('Softbox', sb); sc.collection.objects.link(sbo)
sbo.location = (-48, -42, 14)
sbo.rotation_euler = (-sbo.location + Vector((0, 0, 6))).normalized().to_track_quat('-Z', 'Y').to_euler()
pl = bpy.data.lights.new('LangFenye', 'POINT'); pl.shadow_soft_size = .35; pl.color = (1, .52, .2)
pobj = bpy.data.objects.new('LangFenye', pl); sc.collection.objects.link(pobj)
pobj.location = (FX, 0, FB + .9)

world = bpy.data.worlds.new('Vilag'); sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes['Background']

# kamera: 120 mm, 12°-os rálátás, a régi CSS-gyertya képkivágásához igazítva (a doboz 24,7 cm széles)
cd = bpy.data.cameras.new('Kamera'); cd.lens, cd.sensor_width, cd.sensor_fit = 120, 36, 'HORIZONTAL'
cd.clip_start, cd.clip_end = 1, 1000
cam = bpy.data.objects.new('Kamera', cd); sc.collection.objects.link(cam); sc.camera = cam
EL, D, AIM = math.radians(12), 24.7 * 120 / 36, Z0 + 9.2
cam.location = (0, -D * math.cos(EL), AIM + D * math.sin(EL))
cam.rotation_euler = (math.pi / 2 - EL, 0, 0)

# render
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'OPTIX'
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'GPU'
cy.samples, cy.use_adaptive_sampling = SAMPLES, True
cy.use_denoising, cy.denoiser = True, 'OPENIMAGEDENOISE'
cy.max_bounces, cy.transparent_max_bounces = 16, 48
cy.sample_clamp_indirect = 8
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.resolution_percentage = 100
sc.view_settings.view_transform, sc.view_settings.look = 'AgX', 'AgX - Medium High Contrast'
sc.render.film_transparent = True


def vis(ob, **kw):
    for k, v in kw.items():
        setattr(ob, 'visible_' + k, v)


def setup(lighting, flame_on_camera):
    # este mélyebbre szóródik a fény a viaszban: a perem alatt lefelé halványuló izzás
    for mname, day_s, night_s in (('Viasz', .55, .8), ('OlvadtViasz', .3, .3)):
        bpy.data.materials[mname].node_tree.nodes['Principled BSDF'].inputs['Subsurface Scale'].default_value = day_s if lighting == 'day' else night_s
    if lighting == 'day':
        key.hide_render = rim.hide_render = False
        bg.inputs['Color'].default_value, bg.inputs['Strength'].default_value = (.86, .82, .74, 1), .24
        pl.energy = 60; sbo.hide_render = False; sb.energy = 9000
    else:
        key.hide_render = True; rim.hide_render = False
        rim.data.energy = .16; rim.data.color = (1, .9, .8); sbo.hide_render = False; sb.energy = 25; sb.color = (1, .6, .35)
        bg.inputs['Color'].default_value, bg.inputs['Strength'].default_value = (.5, .45, .42, 1), .025
        pl.energy = 320
    for ob in FLAMES:
        vis(ob, camera=flame_on_camera, diffuse=False, transmission=False, volume_scatter=False, shadow=False)
    vis(flame, glossy=True); vis(core, glossy=True); vis(halo, glossy=False)


def save(path, fmt='WEBP', mode='RGBA', q=90):
    s = sc.render.image_settings
    s.file_format, s.color_mode = fmt, mode
    if fmt == 'WEBP':
        s.quality = q
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


if MODE == 'blend':
    setup('day', True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'gyertya.blend'))

elif MODE in ('preview', 'preview_night'):
    setup('night' if MODE == 'preview_night' else 'day', True)
    pth = os.path.join(OUT, f'_{MODE}.png')
    save(pth, 'PNG')
    import numpy as np
    im = bpy.data.images.load(pth); w, h = im.size
    a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a); a = a.reshape(h, w, 4)
    bgc = np.array([int(c, 16) / 255 for c in (('1C', '21', '17') if 'night' in MODE else ('A7', 'B5', '8C'))])
    a[..., :3] = a[..., :3] * a[..., 3:] + bgc * (1 - a[..., 3:]); a[..., 3] = 1
    out = bpy.data.images.new('bg', w, h); out.pixels.foreach_set(a.ravel())
    out.file_format = 'PNG'; out.save(filepath=pth.replace('.png', '_bg.png'))

elif MODE in ('day', 'night'):
    setup(MODE, False)
    save(os.path.join(OUT, 'gyertya-nappal.webp' if MODE == 'day' else 'gyertya-este.webp'))

elif MODE == 'flame':
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    # a kivágás: a láng legnagyobb kilengése + a fényudvar
    bpy.context.view_layer.update()
    xs, ys = [], []
    for dx in (-1.25, 1.25):
        for z in (FB - .45, FB + HF * 1.25 + .2):
            p = world_to_camera_view(sc, cam, Vector((FX + dx, -1.25, z)))
            xs.append(p.x); ys.append(p.y)
    x0, x1 = math.floor(min(xs) * RES), math.ceil(max(xs) * RES)
    y0, y1 = math.floor(min(ys) * RES), math.ceil(max(ys) * RES)
    r = sc.render
    r.use_border, r.use_crop_to_border = True, True
    r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y = x0 / RES, x1 / RES, y0 / RES, y1 / RES
    r.film_transparent = False
    bg.inputs['Strength'].default_value = 0
    key.hide_render = rim.hide_render = pobj.hide_render = sbo.hide_render = True
    for ob in (candle, pool, puddle, dish, wick, ember):
        ob.is_holdout = True           # kitakarják a lángot, de feketék maradnak
    ground.hide_render = True
    for ob in FLAMES:
        vis(ob, camera=True)
    cy.use_denoising = False
    cy.samples = min(SAMPLES, 48)
    tmp = os.path.join(HERE, '_frames'); os.makedirs(tmp, exist_ok=True)
    frames = []
    for f in range(FRAMES):
        set_flame(f / FRAMES)
        pth = os.path.join(tmp, f'f{f:03d}.png')
        save(pth, 'PNG', 'RGB')
        im = bpy.data.images.load(pth)
        w, h = im.size
        a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a)
        frames.append(a.reshape(h, w, 4)); bpy.data.images.remove(im)
    cols = 8; rows = math.ceil(FRAMES / cols)
    sheet = np.zeros((rows * h, cols * w, 4), np.float32); sheet[..., 3] = 1
    for k, fr in enumerate(frames):
        rr, cc = divmod(k, cols)
        yy = (rows - 1 - rr) * h           # a Blender-kép alulról felfelé tárolja a sorokat
        sheet[yy:yy + h, cc * w:(cc + 1) * w, :3] = fr[..., :3]
    # tiszta fekete háttér: a screen-keverésnél a legkisebb fátyol is téglalapként látszana
    sheet[..., :3] = np.clip((sheet[..., :3] - .008) / .992, 0, 1)
    img = bpy.data.images.new('sprite', cols * w, rows * h, alpha=False)
    img.pixels.foreach_set(sheet.ravel())
    img.file_format = 'WEBP'
    img.save(filepath=os.path.join(OUT, 'gyertya-lang.webp'), quality=86)
    meta = dict(left=x0 / RES * 100, top=(1 - y1 / RES) * 100, width=(x1 - x0) / RES * 100,
                height=(y1 - y0) / RES * 100, frame_px=[w, h], frames=FRAMES, cols=cols, rows=rows, fps=24,
                base_y=(1 - world_to_camera_view(sc, cam, Vector((FX, 0, FB))).y) * 100)
    json.dump(meta, open(os.path.join(OUT, 'lang.json'), 'w'), indent=1)
    print('FLAME META', meta)
