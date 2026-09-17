from PIL import Image, ImageFilter
import numpy as np

img_path = r"d:\Darse Burhani\client\public\mishkat-raw.jpg"
out_path = r"d:\Darse Burhani\client\public\mishkat-isolated.png"
out_path_root = r"d:\Darse Burhani\public\mishkat-isolated.png"

img = Image.open(img_path).convert("RGBA")
w, h = img.size
arr = np.array(img, dtype=np.float32)

# Clear any watermark artifacts outside the lamp base
arr[820:940, 850:960, :3] = 0.0
arr[820:940, 40:150, :3] = 0.0

r, g, b = arr[:,:,0], arr[:,:,1], arr[:,:,2]
lum = 0.299 * r + 0.587 * g + 0.114 * b

# Alpha curve with smooth edge
alpha = np.clip((lum - 5.0) / 12.0, 0.0, 1.0) * 255.0

# Clear background outside lamp silhouette
y_indices, x_indices = np.indices((h, w))
# Outside lamp bounding region
outside_lamp = (y_indices < 45) | ((y_indices > 850) & ((x_indices < 200) | (x_indices > 820)))
alpha[outside_lamp] = 0.0

mask_img = Image.fromarray(alpha.astype(np.uint8), mode="L").filter(ImageFilter.GaussianBlur(radius=0.8))

result = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), mode="RGBA")
result.putalpha(mask_img)

bbox = result.getbbox()
if bbox:
    result = result.crop(bbox)

result.save(out_path, "PNG")
result.save(out_path_root, "PNG")

print(f"Spotless Mishkat cutout saved: {result.size}")
