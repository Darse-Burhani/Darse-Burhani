from PIL import Image, ImageDraw, ImageFilter

img_path = r"d:\Darse Burhani\client\public\mishkat.png"
out_lamp1 = r"d:\Darse Burhani\client\public\mishkat-lamp.png"
out_lamp1_root = r"d:\Darse Burhani\public\mishkat-lamp.png"

img = Image.open(img_path).convert("RGBA")

# Crop upper lamp
crop1 = img.crop((10, 115, 205, 275))
w1, h1 = crop1.size

mask1 = Image.new("L", (w1, h1), 0)
draw1 = ImageDraw.Draw(mask1)

# Arc from (20, 56) to (174, 52)
top_rim = []
for i in range(50):
    t = i / 49.0
    x = 20 + t * (174 - 20)
    y = 56 * (1 - t) + 52 * t + 8 * 4 * t * (1 - t)
    top_rim.append((x, y))

bottom_pts = [
    (175, 54), (176, 75), (168, 98), (150, 122), (142, 134),
    (135, 146), (128, 155), (100, 158), (55, 158), (48, 148), (45, 136),
    (36, 120), (22, 95), (18, 75), (19, 56)
]

full_poly = top_rim + bottom_pts
draw1.polygon(full_poly, fill=255)
draw1.ellipse([18, 52, 175, 128], fill=255)
draw1.ellipse([45, 118, 142, 158], fill=255)

mask1_blurred = mask1.filter(ImageFilter.GaussianBlur(radius=1.2))
crop1.putalpha(mask1_blurred)
# Crop to bounding box of content
bbox = crop1.getbbox()
if bbox:
    crop1 = crop1.crop(bbox)

crop1.save(out_lamp1, "PNG")
crop1.save(out_lamp1_root, "PNG")

print("Clean trimmed Mishkat lamp saved!")
