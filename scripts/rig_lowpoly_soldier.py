#!/usr/bin/env python3
"""Turn the approved Meshy desert rifleman into a skinned, animated game GLB.

Blender headless:
 blender -b -t 2 --python scripts/rig_lowpoly_soldier.py -- INPUT.glb OUTPUT.glb
The source mesh/materials/UVs are preserved. Skeleton and animations are authored
as editable Blender bones and NLA clips. The weapon is a separate skinned assembly.
"""
import bpy
from math import sin, cos, pi
from mathutils import Vector, Matrix
from pathlib import Path
import json
import sys

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
if len(args)!=2:
    raise SystemExit('Usage: blender -b --python scripts/rig_lowpoly_soldier.py -- IN.glb OUT.glb')
src,dst=map(Path,args)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(src))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not meshes:
    raise RuntimeError('No renderable geometry in imported Meshy GLB')
source_stats={'mesh_count':len(meshes),'triangles':sum(len(m.data.polygons) for m in meshes),
              'materials':list(dict.fromkeys(mat.name for o in meshes for mat in o.data.materials if mat))}
# Bake all imported nested glTF object transforms into vertices before skinning.
for ob in meshes:
    world=ob.matrix_world.copy()
    ob.parent=None
    ob.matrix_world=world
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active=ob
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in meshes: ob.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
body=bpy.context.view_layer.objects.active
body.name='Sandforge_LowPoly_Infantry'
body.data.name='Sandforge_Authored_Desert_Mesh'
# Imported glTF scene empties no longer serve a purpose.
for ob in list(bpy.data.objects):
    if ob!=body and ob.type!='MESH': bpy.data.objects.remove(ob,do_unlink=True)
allv=[v.co for v in body.data.vertices]
minimum=Vector(tuple(min(v[i] for v in allv) for i in range(3)))
maximum=Vector(tuple(max(v[i] for v in allv) for i in range(3)))
width=maximum.x-minimum.x
depth=maximum.y-minimum.y
height=maximum.z-minimum.z
if not (.1<height<20 and .05<width<20):
    raise RuntimeError('Unexpected Meshy soldier bounds '+str((width,depth,height)))
centerx=(minimum.x+maximum.x)*.5
centery=(minimum.y+maximum.y)*.5
# Root origin at ground, centred about the body, not around a moving world node.
for v in body.data.vertices:
    v.co.x-=centerx
    v.co.y-=centery
    v.co.z-=minimum.z

def V(x,y,z):return (x*width,y*depth,z*height)
# Proportional armature. The import is an upright character with Z-up after Blender
# glTF conversion, wearing an A-pose: hands near thigh height, feet on the floor.
bpy.ops.object.armature_add(enter_editmode=True, location=(0,0,0))
rig=bpy.context.object
rig.name='SandforgeSoldierRig'
rig.data.name='SandforgeBiped'
rig.data.display_type='STICK'
rig.show_in_front=True
rig.data.edit_bones.remove(rig.data.edit_bones[0])
bonespec=[
 ('Root',None,V(0,0,.45),V(0,0,.49)),
 ('Hips','Root',V(0,0,.48),V(0,0,.55)),
 ('Spine','Hips',V(0,0,.54),V(0,0,.69)),
 ('Chest','Spine',V(0,0,.69),V(0,0,.79)),
 ('Neck','Chest',V(0,0,.79),V(0,0,.84)),
 ('Head','Neck',V(0,0,.83),V(0,0,.975)),
 ('UpperArm.L','Chest',V(.125,0,.77),V(.31,0,.65)),
 ('Forearm.L','UpperArm.L',V(.31,0,.65),V(.40,0,.53)),
 ('Hand.L','Forearm.L',V(.40,0,.53),V(.41,0,.45)),
 ('UpperArm.R','Chest',V(-.125,0,.77),V(-.31,0,.65)),
 ('Forearm.R','UpperArm.R',V(-.31,0,.65),V(-.40,0,.53)),
 ('Hand.R','Forearm.R',V(-.40,0,.53),V(-.41,0,.45)),
 ('Thigh.L','Hips',V(.115,0,.48),V(.115,0,.28)),
 ('Shin.L','Thigh.L',V(.115,0,.28),V(.115,0,.10)),
 ('Foot.L','Shin.L',V(.115,0,.10),V(.115,-.23,.045)),
 ('Thigh.R','Hips',V(-.115,0,.48),V(-.115,0,.28)),
 ('Shin.R','Thigh.R',V(-.115,0,.28),V(-.115,0,.10)),
 ('Foot.R','Shin.R',V(-.115,0,.10),V(-.115,-.23,.045)),
]
for name,parent,head,tail in bonespec:
    bone=rig.data.edit_bones.new(name)
    bone.head=head
    bone.tail=tail
    if parent:bone.parent=rig.data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
# Make painting independent of texture UVs. The generated one-figure mesh often
# includes dozens of disconnected pieces, so automatic bone heat weights are
# unstable; robust height/side-driven smooth influences are reproducible.
groups={name:body.vertex_groups.new(name=name) for name,_,_,_ in bonespec}
def clamp(x,a=0.,b=1.):return min(b,max(a,x))
def blend(a,b,t):return a+(b-a)*clamp(t)
def add(weights,name,val):
    if val>0.0001: weights[name]=weights.get(name,0)+val
for v in body.data.vertices:
    x=v.co.x/max(width,1e-5)
    z=v.co.z/max(height,1e-5)
    ax=abs(x)
    side='L' if x>=0 else 'R'
    w={}
    if z < .51:
        # Hip/leg seam is blended, not a hard cut across triangles.
        leg=clamp((.535-z)/.10)
        leg*=clamp((ax-.015)/.08)
        add(w,'Hips',1-leg)
        if leg>0:
            thigh=clamp((z-.235)/.105)
            foot=clamp((.145-z)/.07)
            add(w,'Thigh.'+side,leg*thigh)
            add(w,'Shin.'+side,leg*(1-thigh)*(1-foot))
            add(w,'Foot.'+side,leg*foot*(1-thigh))
    elif z < .83:
        # Belt packs/vest stay with body; real arm silhouette starts
        # significantly wider than the torso at shoulder and elbow.
        threshold=blend(.095,.145,clamp((z-.53)/.25))
        arm=clamp((ax-threshold)/.075)
        add(w,'Hips', (1-arm)*clamp((.575-z)/.07))
        torso=(1-arm)*(1-clamp((.575-z)/.07))
        add(w,'Spine',torso*(1-clamp((z-.62)/.13)))
        add(w,'Chest',torso*clamp((z-.62)/.13))
        upper=clamp((z-.605)/.095)
        hand=clamp((.555-z)/.085)
        add(w,'UpperArm.'+side,arm*upper)
        add(w,'Forearm.'+side,arm*(1-upper)*(1-hand))
        add(w,'Hand.'+side,arm*(1-upper)*hand)
    else:
        t=clamp((z-.83)/.055)
        add(w,'Neck',1-t)
        add(w,'Head',t)
    total=sum(w.values())
    if total<1e-8: w={'Hips':1.};total=1.
    for name,weight in w.items():groups[name].add([v.index],weight/total,'REPLACE')
body.parent=rig
armod=body.modifiers.new(name='SandforgeRigDeform',type='ARMATURE')
armod.object=rig
# Purpose-built lightweight rifle, separate mesh and material but skinned to hand.
# The texture/geometry of the original character is not regenerated.
weapon_parts=[]
gun_dark=bpy.data.materials.new('SF_Gun_Charcoal')
gun_dark.diffuse_color=(.105,.117,.123,1)
gun_metal=bpy.data.materials.new('SF_Gun_Metal')
gun_metal.diffuse_color=(.18,.19,.18,1)
def cube(name, loc, scale, material):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    ob=bpy.context.object
    ob.name=name
    ob.dimensions=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    ob.data.materials.append(material)
    weapon_parts.append(ob)
    return ob
# Relative to torso: rifle sits forward of the vest, its barrel points -Y.
g=max(.07,height*.075)
basez=height*.65
cube('Rifle_Receiver',(-width*.03,-depth*.55,basez),(.11*height,.19*height,.052*height),gun_dark)
cube('Rifle_Handguard',(-width*.03,-depth*.82,basez),(.065*height,.18*height,.043*height),gun_metal)
cube('Rifle_Barrel',(-width*.03,-depth*.99,basez),(.023*height,.19*height,.025*height),gun_dark)
cube('Rifle_Stock',(-width*.03,-depth*.30,basez),(.07*height,.16*height,.038*height),gun_dark)
cube('Rifle_Magazine',(-width*.03,-depth*.60,basez-.055*height),(.045*height,.055*height,.095*height),gun_dark)
cube('Rifle_Grip',(-width*.03,-depth*.44,basez-.044*height),(.029*height,.032*height,.071*height),gun_metal)
cube('Rifle_Sight',(-width*.03,-depth*.57,basez+.045*height),(.027*height,.065*height,.022*height),gun_metal)
for ob in weapon_parts:
    vg=ob.vertex_groups.new(name='Hand.R')
    vg.add(list(range(len(ob.data.vertices))),1.,'REPLACE')
    ob.parent=rig
    mod=ob.modifiers.new('WeaponSkin',type='ARMATURE')
    mod.object=rig
# glTF exports named empty as a child: the gameplay muzzle flash can follow it.
muzzle=bpy.data.objects.new('WeaponMuzzle',None)
bpy.context.collection.objects.link(muzzle)
muzzle.location=(-width*.03,-depth*1.11,basez)
# To avoid one model becoming many different gameplay hitboxes, muzzle and rifle
# are visual only; Sandforge's authoritative collision and damage are unchanged.
muzzle['sandforgeVisualOnly']=True
for pb in rig.pose.bones:pb.rotation_mode='XYZ'
# Keyframe all channels to guarantee every exported NLA action is self-contained.
fps=24
scene=bpy.context.scene
scene.render.fps=fps
names=[b[0] for b in bonespec]
def poseframe(frame,angles=None,offsets=None):
    angles=angles or {}
    offsets=offsets or {}
    for name in names:
        pb=rig.pose.bones[name]
        pb.rotation_euler=angles.get(name,(0,0,0))
        pb.location=offsets.get(name,(0,0,0))
        pb.keyframe_insert('rotation_euler',frame=frame,group=name)
        pb.keyframe_insert('location',frame=frame,group=name)
def build_action(name,frames,end,loop=True):
    rig.animation_data_create()
    action=bpy.data.actions.new(name)
    action.use_fake_user=True
    rig.animation_data.action=action
    for i,rot,loc in frames:poseframe(i,rot,loc)
    rig.animation_data.action=None
    track=rig.animation_data.nla_tracks.new()
    track.name=name
    strip=track.strips.new(name,1,action)
    strip.action_frame_start=1
    strip.action_frame_end=end
    strip.repeat=1
    strip.use_sync_length=True
    return action
# Arms begin low in the source A-pose. Raise them to cradle rifle at rest.
hold={'UpperArm.L':(-.73,0,-.10),'Forearm.L':(-.53,0,-.10),
      'UpperArm.R':(-.76,0,.11),'Forearm.R':(-.68,0,.08),
      'Hand.R':(0,0,0)}
def clip(keyframe_values,end):
    return [(fr,{**hold,**(angles or {})},(offsets or {})) for fr,angles,offsets in keyframe_values]
build_action('Idle',clip([
 (1,{'Chest':(.012,0,-.01)},{}),
 (13,{'Chest':(-.018,0,.018),'Head':(.013,0,-.01)},{'Root':(0,0,.004*height)}),
 (25,{'Chest':(.012,0,-.01)},{}),
],25),25)
walk=[]
for t in [0,.25,.5,.75,1]:
    phase=2*pi*t
    swing=sin(phase)
    bend=max(0,-sin(phase))
    walk.append((int(1+24*t),{'Thigh.L':(.43*swing,0,0),'Thigh.R':(-.43*swing,0,0),
        'Shin.L':(-.42*bend,0,0),'Shin.R':(-.42*max(0,swing),0,0),
        'UpperArm.L':(-.73+.12*swing,0,-.10),
        'UpperArm.R':(-.76-.12*swing,0,.11),
        'Chest':(0,0,.02*sin(phase))},
        {'Root':(0,0,.012*height*(1-cos(2*phase)))}))
build_action('Walk',clip(walk,25),25)
run=[]
for t in [0,.25,.5,.75,1]:
    phase=2*pi*t
    swing=sin(phase)
    run.append((int(1+16*t),{'Thigh.L':(.62*swing,0,0),'Thigh.R':(-.62*swing,0,0),
        'Shin.L':(-.55*max(0,-swing),0,0),'Shin.R':(-.55*max(0,swing),0,0),
        'Chest':(.12,0,.03*swing),'UpperArm.L':(-.83+.15*swing,0,-.1),
        'UpperArm.R':(-.85-.15*swing,0,.1)},
        {'Root':(0,0,.025*height*(1-cos(2*phase)))}))
build_action('Run',clip(run,17),17)
build_action('Attack',clip([
 (1,{'Chest':(0,0,0)},{}),
 (3,{'Chest':(-.08,0,.035),'UpperArm.R':(-.90,0,.12),'Head':(.025,0,0)},
   {'Root':(0,.02*height,0)}),
 (6,{'Chest':(.015,0,-.025)},{}),
 (11,{'Chest':(0,0,0)},{}),
],11),11)
build_action('Hit',clip([
 (1,{},{}),
 (4,{'Chest':(.20,0,.12),'Head':(-.15,0,-.12)},{}),
 (11,{},{}),
],11),11)
build_action('Death',clip([
 (1,{},{}),
 (9,{'Root':(.48,0,.12),'Chest':(.10,0,.06),
     'UpperArm.L':(-.1,0,-.35),'UpperArm.R':(-.1,0,.35)},{}),
 (22,{'Root':(1.32,0,.12),'Chest':(.25,0,.06),
      'UpperArm.L':(.15,0,-.38),'UpperArm.R':(.18,0,.38)},
      {'Root':(0,0,-.31*height)}),
 (30,{'Root':(1.37,0,.12),'Chest':(.21,0,.06),
      'UpperArm.L':(.18,0,-.38),'UpperArm.R':(.18,0,.38)},
      {'Root':(0,0,-.33*height)}),
],30),30,False)
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
body.select_set(True)
for o in weapon_parts:o.select_set(True)
muzzle.select_set(True)
bpy.context.view_layer.objects.active=rig
scene.frame_set(1)
output=dst.resolve()
output.parent.mkdir(parents=True,exist_ok=True)
kwargs=dict(filepath=str(output), export_format='GLB', use_selection=True,
            export_animations=True, export_nla_strips=True,
            export_force_sampling=True,export_frame_range=False,
            export_apply=False,export_skins=True)
bpy.ops.export_scene.gltf(**kwargs)
if not output.is_file() or output.stat().st_size<10000: raise RuntimeError('GLB export missing')
report={**source_stats,'dimensions_m':{'width':round(width,4),'depth':round(depth,4),'height':round(height,4)},
  'vertices':len(body.data.vertices),'armature_bones':names,
  'clips':['Idle','Walk','Run','Attack','Hit','Death'],
  'output_bytes':output.stat().st_size}
report_path=output.with_suffix('.report.json')
report_path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('SAND_FORGE_RIG_COMPLETE '+json.dumps(report))
