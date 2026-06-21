from PIL import Image, ImageDraw, ImageFont
import math, os

OUT = "/app/frontend/assets/images"

SURFACE = (16, 17, 18, 255)      # #101112
SURFACE2 = (26, 28, 30, 255)     # #1A1C1E
AMBER = (245, 166, 35, 255)      # #F5A623
AMBER_D = (216, 141, 22, 255)    # #D88D16
DARK = (16, 17, 18, 255)

def load_font(size, bold=True):
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def shield_polygon(cx, cy, w, h):
    """Return a list of points approximating a security shield centered at (cx,cy)."""
    half = w / 2
    top = cy - h / 2
    pts = []
    # top edge (slightly rounded via many points)
    pts.append((cx - half, top + h * 0.06))
    pts.append((cx, top))
    pts.append((cx + half, top + h * 0.06))
    # right side down
    pts.append((cx + half, cy + h * 0.10))
    # curve to bottom point
    steps = 24
    for i in range(steps + 1):
        t = i / steps
        # quadratic bezier from (cx+half, cy+0.10h) -> control (cx+half*0.5, cy+0.55h) -> (cx, cy+0.5h)
        x0, y0 = cx + half, cy + h * 0.10
        x1, y1 = cx + half * 0.55, cy + h * 0.46
        x2, y2 = cx, cy + h * 0.5
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2
        pts.append((x, y))
    # mirror for left side bottom->up
    for i in range(steps + 1):
        t = i / steps
        x0, y0 = cx, cy + h * 0.5
        x1, y1 = cx - half * 0.55, cy + h * 0.46
        x2, y2 = cx - half, cy + h * 0.10
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * x1 + t ** 2 * x2
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * y1 + t ** 2 * y2
        pts.append((x, y))
    return pts

def draw_icon(size, bg=True, scale=0.62):
    S = 1024
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bg:
        # rounded dark background full bleed
        d.rectangle([0, 0, S, S], fill=SURFACE)
        # subtle vignette glow top
        glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([S*0.1, -S*0.35, S*0.9, S*0.45], fill=(245, 166, 35, 26))
        img = Image.alpha_composite(img, glow)
        d = ImageDraw.Draw(img)

    cx, cy = S / 2, S / 2 - S * 0.02
    w = S * scale
    h = w * 1.18

    pts = shield_polygon(cx, cy, w, h)
    # shield border ring
    d.polygon(pts, fill=AMBER)
    # inner darker shield
    pts_in = shield_polygon(cx, cy + h*0.005, w * 0.86, h * 0.86)
    d.polygon(pts_in, fill=SURFACE)
    # inner amber face
    pts_face = shield_polygon(cx, cy + h*0.004, w * 0.76, h * 0.76)
    d.polygon(pts_face, fill=AMBER)

    # checkmark
    ck = w * 0.30
    p1 = (cx - ck * 0.55, cy + h * 0.02)
    p2 = (cx - ck * 0.10, cy + h * 0.18)
    p3 = (cx + ck * 0.70, cy - h * 0.20)
    lw = int(w * 0.075)
    d.line([p1, p2, p3], fill=DARK, width=lw, joint="curve")
    # round the check ends
    for p in (p1, p2, p3):
        r = lw / 2
        d.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], fill=DARK)

    if bg:
        # SPHR wordmark
        f = load_font(int(S * 0.085))
        text = "SPHR"
        tb = d.textbbox((0, 0), text, font=f)
        tw = tb[2] - tb[0]
        d.text((cx - tw / 2 - tb[0], cy + h * 0.56), text, font=f, fill=AMBER)

    img = img.resize((size, size), Image.LANCZOS)
    return img

# Main app icon (full bleed dark)
draw_icon(1024, bg=True).save(f"{OUT}/icon.png")
# iOS web favicon
draw_icon(196, bg=True).save(f"{OUT}/favicon.png")
# Android adaptive foreground (transparent bg, shield only, in safe zone ~ scale smaller)
draw_icon(1024, bg=False, scale=0.50).save(f"{OUT}/adaptive-icon.png")
# Splash icon (shield on transparent, used over dark splash bg)
draw_icon(1024, bg=False, scale=0.55).save(f"{OUT}/splash-icon.png")

print("icons written:", os.listdir(OUT))
