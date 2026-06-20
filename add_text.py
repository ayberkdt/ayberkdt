from PIL import Image, ImageDraw, ImageFont

img = Image.open('assets/banner.png')
draw = ImageDraw.Draw(img)
try:
    font_title = ImageFont.truetype('C:\\Windows\\Fonts\\segoeuib.ttf', 120)
    font_subtitle = ImageFont.truetype('C:\\Windows\\Fonts\\segoeui.ttf', 50)
except IOError:
    font_title = ImageFont.load_default()
    font_subtitle = ImageFont.load_default()

title = "Ayberk Demirkanat"
subtitle = "Astrodynamics | Lunar Orbits | Hamiltonian Dynamics"

W, H = img.size

# Using textbbox
_, _, w_title, h_title = draw.textbbox((0, 0), title, font=font_title)
_, _, w_sub, h_sub = draw.textbbox((0, 0), subtitle, font=font_subtitle)

# Center X, middle Y
x_title = (W - w_title) / 2
y_title = (H - h_title) / 2 - 30

x_sub = (W - w_sub) / 2
y_sub = y_title + h_title + 20

# We draw with a subtle shadow for legibility
shadow_offset = 3
draw.text((x_title + shadow_offset, y_title + shadow_offset), title, font=font_title, fill="black")
draw.text((x_sub + shadow_offset, y_sub + shadow_offset), subtitle, font=font_subtitle, fill="black")

draw.text((x_title, y_title), title, font=font_title, fill="white")
draw.text((x_sub, y_sub), subtitle, font=font_subtitle, fill="#7dd3fc")

img.save('assets/banner_with_text.png')
print("Image saved as assets/banner_with_text.png")
