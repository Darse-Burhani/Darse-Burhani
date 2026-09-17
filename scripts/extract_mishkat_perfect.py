from PIL import Image, ImageDraw, ImageFilter
import numpy as np

img_path = r"d:\Darse Burhani\client\public\mishkat.jpg"
out_lamp = r"d:\Darse Burhani\client\public\mishkat-isolated.png"
out_lamp_root = r"d:\Darse Burhani\public\mishkat-isolated.png"

img = Image.open(img_path).convert("RGBA")
w, h = img.size

# Let's create an exact silhouette mask for the entire lamp:
# 1. Chains at top
# 2. Top lid / finial cap
# 3. Upper rounded lip
# 4. Glass body with calligraphy
# 5. Base with star
mask = Image.new("L", (w, h), 0)
draw = ImageDraw.Draw(mask)

# Top Lid & Cap (x: 290..735, y: 80..190)
lid_pts = [
    (310, 140), (350, 100), (430, 85), (512, 85), (595, 85), (675, 100), (715, 140),
    (730, 165), (700, 185), (600, 195), (512, 195), (420, 195), (320, 185), (295, 165)
]
draw.polygon(lid_pts, fill=255)
draw.ellipse([300, 80, 725, 190], fill=255)

# Upper Lip & Neck (x: 135..890, y: 140..350)
upper_lip = [
    (140, 310), (160, 240), (250, 190), (360, 160), (512, 155), (665, 160), (775, 190), (865, 240), (885, 310),
    (875, 365), (780, 380), (670, 365), (512, 355), (355, 365), (245, 380), (150, 365)
]
draw.polygon(upper_lip, fill=255)
draw.ellipse([135, 150, 890, 370], fill=255)

# Main Glowing Glass Belly (x: 130..895, y: 280..780)
draw.ellipse([130, 260, 895, 780], fill=255)

# Lower Pedestal Neck & Base Foot (x: 295..730, y: 740..925)
pedestal_pts = [
    (360, 740), (660, 740),
    (710, 830), (730, 880), (725, 915), (670, 925), (512, 925), (355, 925), (300, 915), (295, 880), (315, 830)
]
draw.polygon(pedestal_pts, fill=255)
draw.ellipse([295, 835, 730, 925], fill=255)

# Left hanging chain link corridor (so the chain going to ceiling stays intact)
draw.polygon([
    (240, 0), (290, 0), (200, 190), (140, 280), (115, 270), (170, 180)
], fill=255)

# Right hanging chain link corridor
draw.polygon([
    (580, 0), (630, 0), (675, 160), (860, 280), (895, 320), (870, 335), (840, 270), (650, 150)
], fill=255)

# Soft blur mask for clean anti-aliasing (radius 2.5px)
mask_blurred = mask.filter(ImageFilter.GaussianBlur(radius=2.5))

result = img.copy()
result.putalpha(mask_blurred)

# Crop tight bounding box
bbox = result.getbbox()
if bbox:
    result = result.crop(bbox)

result.save(out_lamp, "PNG")
result.save(out_lamp_root, "PNG")

print(f"Pristine isolated Mishkat saved: {result.size}")
