# Szandi Yoga – gyertya az oldal illusztrációjának stílusában: valódi 3D test,
# lapos tónusokkal (árnyék / alap / fény) és fekete tus-kontúrral (Freestyle).
# Blender 5.2 / Cycles. A színek emisszióból jönnek, fényforrás nincs → a hex kód
# pontosan az marad, ami a rajzon ('Standard' nézet).
# Futtatás (fejléc nélkül):
#   blender -b --factory-startup --python gyertya_blender.py -- mode=preview res=700
# mode: preview | body | flame | blend
#   preview  – test és láng együtt, háttérre montírozva (img/_preview_bg.png; bg=r,g,b 0..1)
#   body     – gyertyatest, átlátszó háttér            (img/gyertya.webp)
#   flame    – a láng hurkolt animációja sprite-lapként (img/gyertya-lang.webp + lang.json)
#   blend    – csak elmenti a jelenetet (gyertya.blend)
# Mértékegység: 1 egység = 1 cm. A kamera a -Y oldalról néz.
import bpy, bmesh, math, sys, os, json, random
from mathutils import Vector

ARGS = dict(a.split('=', 1) for a in sys.argv[sys.argv.index('--') + 1:]) if '--' in sys.argv else {}
MODE = ARGS.get('mode', 'preview')
RES = int(ARGS.get('res', 1024))
SAMPLES = int(ARGS.get('samples', 24))
FRAMES = int(ARGS.get('frames', 64))
HERE = os.path.dirname(os.path.abspath(sys.argv[sys.argv.index('--python') + 1]))
OUT = os.path.join(HERE, 'img')
os.makedirs(OUT, exist_ok=True)
TAU = math.tau


def lin(h):
    """#rrggbb (sRGB) -> lineáris RGBA"""
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


# a rajz palettája: nadrág-krém, bőr-rózsa, póló-sárga, tus
INK = lin('#161616')
WAX = (lin('#E4CFBC'), lin('#F3E6D9'), lin('#FFFAF3'))      # árnyék, alap, fény
DRIP = (lin('#E7D3C1'), lin('#F6EBDF'), lin('#FFFCF7'))
POOL = lin('#F6DFB8')
DISH = (lin('#6E7A55'), lin('#828E66'), lin('#A6AF8C'))   # olíva csészealj (2026-10, az oldal palettájához)
FLAME = (lin('#F5C95B'), lin('#FFF3D1'))                    # külső sárga, belső mag
LDIR = Vector((-.55, -.62, .56)).normalized()                # a „rajzolt” fény: balról, elölről, fentről

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
DRIPS = [(-35, 5.4, .36, .36), (-100, 9.3, .44, .3), (-142, 2.6, .27, .24), (-66, 1.3, .22, .17),
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
    nw = 200
    pts += [(R, Z0 + .12 + (hw - Z0 - .12) * i / nw) for i in range(nw)]
    pts += catmull([(R, hw), (R - .04, hr - .08), (R - .18, hr), (R - .34, hr - .07), (R - .44, hr - .24),
                    (R - .5, HP + .15), (R - .66, HP + .01), (R - .86, HP)], 42)
    pts += [((R - .86) * (1 - i / 16) + .02 * i / 16, HP) for i in range(17)]
    # a fal és a perem külső íve kapja a csorgásokat és a finom egyenetlenséget
    return [(r + .012 * wall_n(th) if r >= R - .1 else r, z) for r, z in pts]


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


def ramp(nodes, stops, constant=True):
    n = nodes.new('ShaderNodeValToRGB')
    n.color_ramp.interpolation = 'CONSTANT' if constant else 'LINEAR'
    el = n.color_ramp.elements
    while len(el) < len(stops):
        el.new(0)
    for e, (pos, c) in zip(el, stops):
        e.position, e.color = pos, (c, c, c, 1) if isinstance(c, (int, float)) else c
    return n


def output(N, L, color_socket):
    N.remove(N['Principled BSDF'])
    e = N.new('ShaderNodeEmission')
    L.new(color_socket, e.inputs['Color'])
    L.new(e.outputs['Emission'], N['Material Output'].inputs['Surface'])


def toon(name, tones, cut=(.46, .93)):
    """Három lapos tónus a felület és a rajzolt fény szöge szerint."""
    m, N, L = mat(name)
    g = N.new('ShaderNodeNewGeometry')
    d = N.new('ShaderNodeVectorMath'); d.operation = 'DOT_PRODUCT'
    d.inputs[1].default_value = LDIR
    L.new(g.outputs['Normal'], d.inputs[0])
    f = N.new('ShaderNodeMath'); f.operation = 'MULTIPLY_ADD'
    f.inputs[1].default_value = f.inputs[2].default_value = .5
    L.new(d.outputs['Value'], f.inputs[0])
    r = ramp(N, [(0, tones[0]), (cut[0], tones[1]), (cut[1], tones[2])])
    L.new(f.outputs['Value'], r.inputs['Fac'])
    output(N, L, r.outputs['Color'])
    return m


def flat(name, color):
    m, N, L = mat(name)
    rgb = N.new('ShaderNodeRGB'); rgb.outputs[0].default_value = color
    output(N, L, rgb.outputs[0])
    return m


def flame_mat():
    """Sárga láng, benne világos mag. A mag ott van, ahol a felület szembenéz; a határa
    a magassággal szűkül → a körvonalat követő, kisebb könnycsepp."""
    m, N, L = mat('Lang')
    tc = N.new('ShaderNodeTexCoord')
    sp = N.new('ShaderNodeSeparateXYZ'); L.new(tc.outputs['Generated'], sp.inputs['Vector'])
    thr = ramp(N, [(0, 0.0), (.14, 0.0), (.3, .5), (.62, .42), (.84, 0.0)], constant=False)
    L.new(sp.outputs['Z'], thr.inputs['Fac'])
    lw = N.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = .5
    lt = N.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'
    L.new(lw.outputs['Facing'], lt.inputs[0]); L.new(thr.outputs['Color'], lt.inputs[1])
    mx = N.new('ShaderNodeMix'); mx.data_type = 'RGBA'
    L.new(lt.outputs['Value'], mx.inputs['Factor'])
    mx.inputs['A'].default_value, mx.inputs['B'].default_value = FLAME
    output(N, L, mx.outputs['Result'])
    return m


# ---------------------------------------------------------------- jelenet
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
sc = bpy.context.scene

candle = lathe('Gyertya', candle_profile, 360, Z0, HP)
candle.data.materials.append(toon('Viasz', WAX, (.5, .93)))
candle.data.materials.append(toon('Csorgas', DRIP, (.5, .9)))


def drip_ribbon(i, a, L, w, t):
    """Egy csorgás külön, zárt testként a falon: kerek keresztmetszet, lekerekített csepp-vég.
    A két szélén függőleges az érintő → a Freestyle ott sima sziluettet húz, mint egy tollvonás."""
    zs = rim_h(a) - .32
    s0, s1 = -.22 / L, 1 + 1.25 * w / L
    rows, cols = max(60, int(L / .025)), 24
    loops = []
    for j in range(rows + 1):
        s = s0 + (s1 - s0) * j / rows
        z = zs - s * L
        bulb = math.exp(-((s - .97) * L / (1.2 * w)) ** 2)
        if s < 0:
            A = .5 * (1 - s / s0) ** 1.5; W = w * .8 * (1 + .8 * s / s0)
        elif s <= 1:
            A = .5 + .5 * s + .9 * bulb; W = w * (.8 + .2 * s + .5 * bulb)
        else:
            k = math.sqrt(max(0.0, 1 - ((s - 1) / (s1 - 1)) ** 2))
            A = (1 + .9 * bulb) * k; W = w * (1 + .5 * bulb) * k
        W *= 1 + .18 * math.sin(z * 2.3 + a * 7)
        wob = .1 * math.sin(max(s, 0) * L * .8 + a * 3) * min(max(s, 0) * 4, 1)   # a csorgás kanyarog
        ac = a + wob / R
        W = max(W, 1e-3)
        base = R + .03 - .16 * min(1.0, s / s0) if s < 0 else R + .03   # a teteje a falból bukkan elő
        ring = []
        for c in range(cols + 1):            # elöl: félkör-ív
            u = -1 + 2 * c / cols
            th = ac + u * W / R
            r = base + t * A * math.sqrt(max(0.0, 1 - u * u))
            ring.append((r * math.cos(th), r * math.sin(th), z))
        for c in range(cols - 1, 0, -1):     # hátul: a falba süllyesztve
            u = -1 + 2 * c / cols
            th = ac + u * W / R
            ring.append(((R - .16) * math.cos(th), (R - .16) * math.sin(th), z))
        loops.append(ring)
    n = len(loops[0])
    verts = [v for ring in loops for v in ring]
    faces = [(j * n + c, j * n + (c + 1) % n, (j + 1) * n + (c + 1) % n, (j + 1) * n + c)
             for j in range(rows) for c in range(n)]
    faces += [tuple(range(n))[::-1], tuple(rows * n + c for c in range(n))]
    me = bpy.data.meshes.new(f'csorgas{i}'); me.from_pydata(verts, [], faces)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free()
    me.shade_smooth()
    ob = bpy.data.objects.new(f'Csorgas{i}', me); sc.collection.objects.link(ob)
    ob.data.materials.append(candle.data.materials[1])
    return ob


drips = [drip_ribbon(i, *d) for i, d in enumerate(DRIPS)]

bpy.ops.mesh.primitive_circle_add(vertices=160, radius=R - .6, fill_type='TRIFAN', location=(0, 0, HP + .025))
pool = bpy.context.object; pool.name = 'OlvadtTo'
pool.data.materials.append(flat('OlvadtViasz', POOL))

bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=1)
puddle = bpy.context.object; puddle.name = 'ViaszFolt'
a = DRIPS[1][0]
puddle.location = ((R + .12) * math.cos(a), (R + .12) * math.sin(a), Z0)
puddle.scale = (.72, .5, .11); puddle.rotation_euler = (0, 0, a)
bpy.ops.object.shade_smooth()
puddle.data.materials.append(candle.data.materials[1])

DISH_PTS = [(.01, 0), (3.8, 0), (4.02, .04), (4.12, .14), (5.0, .46), (5.55, .92), (5.82, 1.14), (5.8, 1.27),
            (5.62, 1.24), (5.3, .98), (4.8, .56), (4.2, Z0 + .02), (3.0, Z0), (.01, Z0)]
dish = lathe('Tal', lambda th: catmull(DISH_PTS, 150) + [DISH_PTS[-1]], 256, 0, Z0)
dish.data.materials.append(toon('Keramia', DISH, (.4, .9)))

# kanóc: vékony, enyhén meghajló, tusszínű szál
cu = bpy.data.curves.new('kanoc', 'CURVE'); cu.dimensions = '3D'
cu.bevel_depth, cu.bevel_resolution = .05, 3
spl = cu.splines.new('POLY'); spl.points.add(15)
for k, pt in enumerate(spl.points):
    t = k / 15
    pt.co = (.2 * t ** 2.4, 0, HP - .2 + .95 * t, 1)
wick = bpy.data.objects.new('Kanoc', cu); sc.collection.objects.link(wick)
wick.data.materials.append(flat('Tus', INK))

# láng: saját gyűjteményben, hogy külön menetben renderelhető legyen
FB, HF, RMAX = HP + .38, 3.7, .66
FX = .07
fcol = bpy.data.collections.new('LangCol'); sc.collection.children.link(fcol)


def flame_obj(name, material):
    def prof(th):
        return [(RMAX * (u ** .5) * (1 - u) ** 1.15 / .5186, HF * u) for u in (.002 + .996 * i / 90 for i in range(91))]
    ob = lathe(name, prof, 64, 0, HF)
    bpy.context.collection.objects.unlink(ob); fcol.objects.link(ob)
    ob.location = (FX, 0, FB)
    vg = ob.vertex_groups.new(name='csucs')
    for v in ob.data.vertices:
        vg.add([v.index], max(0.0, v.co.z / HF) ** 1.7, 'REPLACE')
    ob.data.materials.append(material)
    return ob


flame = flame_obj('Lang', flame_mat())

# a láng mozgása: két-két, egymásba úsztatott zaj-eltolás X és Y irányban → a hurok varrat nélküli
tex = bpy.data.textures.new('lang_zaj', 'CLOUDS')
tex.noise_scale, tex.noise_depth = 2.6, 1
EMP = {}
for axis in 'XY':
    for k in 'ab':
        e = bpy.data.objects.new(f'zaj_{axis}{k}', None); sc.collection.objects.link(e)
        EMP[axis + k] = e
        md = flame.modifiers.new(f'{axis}{k}', 'DISPLACE')
        md.texture, md.texture_coords, md.texture_coords_object = tex, 'OBJECT', e
        md.direction, md.vertex_group, md.mid_level = axis, 'csucs', .5


def set_flame(t):
    """t: 0..1 a hurkon belül. t=1 pontosan t=0 állapota."""
    V, S = 7.0, .8
    for axis, dx in (('X', 0.0), ('Y', 37.0)):
        EMP[axis + 'a'].location = (dx, 0, -V * t)
        EMP[axis + 'b'].location = (dx, 0, -V * (t - 1))
        flame.modifiers[axis + 'a'].strength = S * math.cos(math.pi / 2 * t)
        flame.modifiers[axis + 'b'].strength = S * math.sin(math.pi / 2 * t)
    sz = 1 + .05 * math.sin(TAU * 2 * t) + .03 * math.sin(TAU * 5 * t + 1.3) + .018 * math.sin(TAU * 9 * t + .4)
    sx = 1 - .5 * (sz - 1)
    flame.scale = (sx, sx, sz)


set_flame(0)

# kamera: 120 mm, 12°-os rálátás, a régi CSS-gyertya képkivágásához igazítva (a doboz 24,7 cm széles)
cd = bpy.data.cameras.new('Kamera'); cd.lens, cd.sensor_width, cd.sensor_fit = 120, 36, 'HORIZONTAL'
cd.clip_start, cd.clip_end = 1, 1000
cam = bpy.data.objects.new('Kamera', cd); sc.collection.objects.link(cam); sc.camera = cam
EL, D, AIM = math.radians(12), 24.7 * 120 / 36, Z0 + 9.2
cam.location = (0, -D * math.cos(EL), AIM + D * math.sin(EL))
cam.rotation_euler = (math.pi / 2 - EL, 0, 0)

# render: lapos szín, nincs fény → kevés minta is zajmentes
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
for d in prefs.devices:
    d.use = d.type == 'OPTIX'
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device, cy.samples, cy.use_denoising = 'GPU', SAMPLES, False
cy.max_bounces = 0
sc.world = bpy.data.worlds.new('Vilag')
sc.render.resolution_x = sc.render.resolution_y = RES
sc.render.resolution_percentage = 100
sc.view_settings.view_transform, sc.view_settings.look = 'Standard', 'None'
sc.render.film_transparent = True

# tus-kontúr: Freestyle, abszolút vastagság (a rajz vonala ~3 px 1000 px-en)
sc.render.use_freestyle = True
sc.render.line_thickness_mode, sc.render.line_thickness = 'ABSOLUTE', 1.0
vl = sc.view_layers[0]; vl.use_freestyle = True
fs = vl.freestyle_settings; fs.crease_angle = math.radians(125)
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('Kontur')
ls.select_by_visibility = ls.select_by_edge_types = True
ls.visibility = 'VISIBLE'
for k in ('silhouette', 'border', 'crease', 'material_boundary'):
    setattr(ls, 'select_' + k, True)
for k in ('contour', 'external_contour', 'suggestive_contour', 'ridge_valley', 'edge_mark'):
    setattr(ls, 'select_' + k, False)
st = ls.linestyle
st.color, st.thickness, st.caps, st.thickness_position = INK[:3], RES / 1024 * 3.4, 'ROUND', 'CENTER'
ls.collection = fcol


def save(path, fmt='WEBP', q=90):
    s = sc.render.image_settings
    s.file_format, s.color_mode = fmt, 'RGBA'
    if fmt == 'WEBP':
        s.quality = q
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


if MODE == 'blend':
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'gyertya.blend'))

elif MODE == 'preview':
    ls.select_by_collection = False
    pth = os.path.join(OUT, '_preview.png')
    save(pth, 'PNG')
    import numpy as np
    im = bpy.data.images.load(pth); w, h = im.size
    a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a); a = a.reshape(h, w, 4)
    bgc = np.array([float(x) for x in ARGS.get('bg', '1,1,1').split(',')])
    a[..., :3] = a[..., :3] * a[..., 3:] + bgc * (1 - a[..., 3:]); a[..., 3] = 1
    out = bpy.data.images.new('bg', w, h); out.pixels.foreach_set(a.ravel())
    out.file_format = 'PNG'; out.save(filepath=pth.replace('.png', '_bg.png'))

elif MODE == 'body':
    flame.hide_render = True
    ls.select_by_collection, ls.collection_negation = True, 'EXCLUSIVE'
    save(os.path.join(OUT, 'gyertya.webp'))

elif MODE == 'flame':
    import numpy as np
    from bpy_extras.object_utils import world_to_camera_view
    # a kivágás: a láng legnagyobb kilengése
    bpy.context.view_layer.update()
    xs, ys = [], []
    for dx in (-1.1, 1.1):
        for z in (FB - .3, FB + HF * 1.2 + .15):
            p = world_to_camera_view(sc, cam, Vector((FX + dx, -1.1, z)))
            xs.append(p.x); ys.append(p.y)
    x0, x1 = math.floor(min(xs) * RES), math.ceil(max(xs) * RES)
    y0, y1 = math.floor(min(ys) * RES), math.ceil(max(ys) * RES)
    r = sc.render
    r.use_border, r.use_crop_to_border = True, True
    r.border_min_x, r.border_max_x, r.border_min_y, r.border_max_y = x0 / RES, x1 / RES, y0 / RES, y1 / RES
    for ob in (candle, pool, puddle, dish, wick, *drips):
        ob.is_holdout = True           # a perem mögé kerülő lángtövet kitakarják, átlátszóként
    ls.select_by_collection, ls.collection_negation = True, 'INCLUSIVE'
    tmp = os.path.join(HERE, '_frames'); os.makedirs(tmp, exist_ok=True)
    frames = []
    for f in range(FRAMES):
        set_flame(f / FRAMES)
        pth = os.path.join(tmp, f'f{f:03d}.png')
        save(pth, 'PNG')
        im = bpy.data.images.load(pth)
        w, h = im.size
        a = np.empty(w * h * 4, np.float32); im.pixels.foreach_get(a)
        frames.append(a.reshape(h, w, 4)); bpy.data.images.remove(im)
    cols = 8; rows = math.ceil(FRAMES / cols)
    sheet = np.zeros((rows * h, cols * w, 4), np.float32)
    for k, fr in enumerate(frames):
        rr, cc = divmod(k, cols)
        yy = (rows - 1 - rr) * h           # a Blender-kép alulról felfelé tárolja a sorokat
        sheet[yy:yy + h, cc * w:(cc + 1) * w] = fr
    img = bpy.data.images.new('sprite', cols * w, rows * h, alpha=True)
    img.pixels.foreach_set(sheet.ravel())
    img.file_format = 'WEBP'
    img.save(filepath=os.path.join(OUT, 'gyertya-lang.webp'), quality=90)
    meta = dict(left=x0 / RES * 100, top=(1 - y1 / RES) * 100, width=(x1 - x0) / RES * 100,
                height=(y1 - y0) / RES * 100, frame_px=[w, h], frames=FRAMES, cols=cols, rows=rows, fps=24,
                base_y=(1 - world_to_camera_view(sc, cam, Vector((FX, 0, FB))).y) * 100)
    json.dump(meta, open(os.path.join(OUT, 'lang.json'), 'w'), indent=1)
    print('FLAME META', meta)
