import bpy, math
from pathlib import Path
from mathutils import Vector
root=Path("/Users/ahbbang/Documents/2학년2학기/그래픽디자인2/기말 레퍼런스&작업/웹사이트 작업")
files=[p for p in root.rglob('*.glb') if '→' in p.name]
for idx,p in enumerate(files):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(p))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 coords=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
 lo=Vector([min(v[i] for v in coords) for i in range(3)])
 hi=Vector([max(v[i] for v in coords) for i in range(3)])
 center=(lo+hi)/2; size=max(hi-lo)
 print('MODEL',p.name,'bounds',list(lo),list(hi),'faces',sum(len(o.data.polygons) for o in meshes))
 import bmesh
 for o in meshes:
  bm=bmesh.new();bm.from_mesh(o.data)
  print('EDGES boundary',sum(e.is_boundary for e in bm.edges),'nonmanifold',sum(not e.is_manifold for e in bm.edges));bm.free()
 scene=bpy.context.scene
 scene.render.engine='BLENDER_WORKBENCH'
 scene.display.shading.light='STUDIO'
 scene.display.shading.color_type='TEXTURE'
 scene.display.shading.show_shadows=True
 scene.display.shading.show_cavity=True
 scene.render.resolution_x=800;scene.render.resolution_y=700;scene.render.resolution_percentage=100
 for label,direction in [('front',(0,-1,.35)),('back',(0,1,.35))]:
  bpy.ops.object.camera_add()
  cam=bpy.context.object;cam.location=center+Vector(direction).normalized()*size*1.8
  cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
  cam.data.type='ORTHO';cam.data.ortho_scale=size*1.3;scene.camera=cam
  scene.render.filepath=f'/tmp/descent-{idx}-{label}.png'
  bpy.ops.render.render(write_still=True)
