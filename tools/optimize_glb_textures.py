import bpy
import math
import os
import sys


def fit_size(width, height, limit):
    longest = max(width, height)
    if longest <= limit:
        return width, height
    scale = limit / longest
    return max(1, round(width * scale)), max(1, round(height * scale))


args = sys.argv[sys.argv.index("--") + 1 :]
source, destination, max_size = args[0], args[1], int(args[2])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)

for image in bpy.data.images:
    width, height = image.size
    target_width, target_height = fit_size(width, height, max_size)
    if (target_width, target_height) != (width, height):
        image.scale(target_width, target_height)

os.makedirs(os.path.dirname(destination), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=destination,
    export_format="GLB",
    export_image_format="AUTO",
    export_jpeg_quality=82,
)
