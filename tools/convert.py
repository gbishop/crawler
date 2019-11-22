"""Make sprite sheets with atlas file"""

from PIL import Image
import os.path as osp
import json
import math

root = "/data/assets/Isometric Tower Defense/1. Characters"
character = "Knight"
nframes = 30
framestep = 3

folder = osp.join(root, character)

directions = [f"{axis}{step}" for axis in ["x", "y"] for step in ["+1", "-1"]]
patterns = {
    "x+1": "PNG/%s_Front-Walking-Front-Left_%d.png",
    "y+1": "PNG/%s_Front-Walking-Front_%d.png",
    "y-1": "PNG/%s_Back-Walking-Back_%d.png",
    "x-1": "PNG/%s_Back-Walking-Back-Right_%d.png",
}


# get the max width and height
mw = 0
mh = 0
images = {}
for direction in directions:
    images[direction] = []
    pattern = patterns[direction]
    for j in range(0, nframes, framestep):
        path = osp.join(folder, pattern % (character, j))
        im = Image.open(path).convert("RGBA")
        images[direction].append(im)
        w, h = im.size
        mw = max(mw, w)
        mh = max(mh, h)


def scale(d):
    return int(math.ceil(3 * d // 8))


# scale them
mw = scale(mw)
mh = scale(mh)


# create the result image
result = Image.new(
    mode="RGBA",
    size=(mw * (nframes // framestep), mh * len(directions)),
    color=(0, 0, 0, 0),
)


# revisit the images pasting them and building the datastructure
frames = []
for i, direction in enumerate(directions):
    for j, im in enumerate(images[direction]):
        w, h = im.size
        w = scale(w)
        h = scale(h)
        im = im.resize((w, h))
        xo = j * mw
        yo = i * mh
        result.paste(im, (xo, yo))
        frame = {
            "filename": "%s_%02d" % (direction, j),
            "frame": {"x": xo, "y": yo, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        frames.append(frame)


json.dump({"frames": frames}, open(f"../assets/{character}.json", "w"), indent=2)
result.save(f"../assets/{character}.png")
