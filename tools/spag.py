"""Construct an atlas for spaghetti_atlas.png"""

# +x is down to right, +y is down to left */

import json


width = 85
height = 170

cols = 24
perdirection = 6

directions = [
    "x+1y-1",
    "x+0y-1",
    "x-1y-1",
    "x-1y+0",
    "x-1y+1",
    "x+0y+1",
    "x+1y+0",
    "x+1y+1",
]

frames = []
xo = 0
yo = 0
for direction in directions:
    for i in range(perdirection):
        frame = {
            "filename": "%s_%d" % (direction, i),
            "frame": {"x": xo, "y": yo, "w": width, "h": height},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": width, "h": height},
            "sourceSize": {"w": width, "h": height},
        }
        frames.append(frame)
        xo += width
        if xo > 2048:
            xo = 0
            yo += height

json.dump({"frames": frames}, open("../assets/spag.json", "w"), indent=2)
