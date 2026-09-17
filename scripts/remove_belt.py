from PIL import Image, ImageFilter, ImageDraw
import numpy as np

img_path = r"d:\Darse Burhani\client\public\mishkat.jpg"
out_path = r"d:\Darse Burhani\client\public\mishkat-isolated.png"
out_path_root = r"d:\Darse Burhani\public\mishkat-isolated.png"

img = Image.open(img_path).convert("RGBA")
w, h = img.size
arr = np.array(img, dtype=np.float32)

# Create an authentic Fatimi Mosque glass bowl without the belt:
# Top rim lip: x=140..885, y=280..360
# Belly with Quranic calligraphy: x=130..895, y=340..780
# Pedestal base with star: x=295..730, y=740..925

# 1. Mask for the clean glass bowl
mask = Image.new("L", (w, h), 0)
draw = ImageDraw.Draw(mask)

# Top opening rim
draw.ellipse([140, 280, 885, 390], fill=255)
# Main bulbous belly
draw.ellipse([130, 310, 895, 780], fill=255)
# Pedestal & Base
draw.polygon([
    (360, 740), (660, 740),
    (710, 830), (730, 880), (725, 915), (670, 925), (512, 925), (300, 915), (295, 880), (315, 830)
], fill=255)
draw.ellipse([295, 835, 730, 925], fill=255)

clean_arr = arr.copy()

# Along the top opening rim (y=280..360), inpaint any residual dark belt chain links with the golden glass tone
for y in range(280, 360):
    for x in range(140, 885):
        r, g, b = clean_arr[y, x, :3]
        lum = 0.299*r + 0.587*g + 0.114*b
        if lum < 100 or (r < 110 and g < 95):
            # Sample from the glowing glass below (y=380..450)
            sample_y = min(700, y + 50)
            clean_arr[y, x, :3] = clean_arr[sample_y, x, :3] * 0.95

# Smooth the top rim
result_img = Image.fromarray(np.clip(clean_arr, 0, 255).astype(np.uint8), mode="RGBA")
rim_crop = result_img.crop((130, 275, 895, 370))
rim_crop_smooth = rim_crop.filter(ImageFilter.GaussianBlur(radius=2.5))
result_img.paste(rim_crop_smooth, (130, 275))

# Draw the natural antique bronze / golden rim lip on top opening
rim_draw = ImageDraw.Draw(result_img)
rim_pts = []
for i in range(100):
    t = i / 99.0
    rx = 145 + t * (880 - 145)
    ry = 320 + 35 * np.sin(t * np.pi)
    rim_pts.append((rx, ry))

for i in range(len(rim_pts)-1):
    rim_draw.line([rim_pts[i], rim_pts[i+1]], fill=(40, 25, 12, 255), width=4)
    rim_draw.line([(rim_pts[i][0], rim_pts[i][1]+2), (rim_pts[i+1][0], rim_pts[i+1][1]+2)], fill=(160, 120, 60, 255), width=2)

# Soft feathered alpha mask
mask_blurred = mask.filter(ImageFilter.GaussianBlur(radius=2.0))
result_img.putalpha(mask_blurred)

# Crop tight bounding box
bbox = result_img.getbbox()
if bbox:
    result_img = result_img.crop(bbox)

result_img.save(out_path, "PNG")
result_img.save(out_path_root, "PNG")

print(f"Clean authentic belt-free Mishkat bowl created: {result_img.size}")
