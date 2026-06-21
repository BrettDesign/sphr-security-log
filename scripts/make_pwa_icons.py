from PIL import Image
import os

ASSETS = "/app/frontend/assets/images"
PUB = "/app/frontend/public/icons"
os.makedirs(PUB, exist_ok=True)

SURFACE = (16, 17, 18, 255)  # #101112

icon = Image.open(f"{ASSETS}/icon.png").convert("RGBA")        # full bleed dark + shield + SPHR
adaptive = Image.open(f"{ASSETS}/adaptive-icon.png").convert("RGBA")  # transparent shield only

# Standard "any" purpose icons (full icon with dark bg)
icon.resize((512, 512), Image.LANCZOS).save(f"{PUB}/icon-512.png")
icon.resize((192, 192), Image.LANCZOS).save(f"{PUB}/icon-192.png")

# Apple touch icon (iOS home screen) — must be opaque, 180x180
icon.resize((180, 180), Image.LANCZOS).save(f"{PUB}/apple-touch-icon.png")

# Maskable icon: dark square + centered shield with generous safe-zone padding
def maskable(size):
    bg = Image.new("RGBA", (size, size), SURFACE)
    s = int(size * 0.70)
    fg = adaptive.resize((s, s), Image.LANCZOS)
    off = (size - s) // 2
    bg.alpha_composite(fg, (off, off))
    return bg

maskable(512).save(f"{PUB}/maskable-512.png")
maskable(192).save(f"{PUB}/maskable-192.png")

print("public icons:", os.listdir(PUB))
