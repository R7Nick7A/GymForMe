from PIL import Image, ImageDraw

def make_icon(size, path):
    img = Image.new('RGBA', (size, size), (15, 23, 42, 255))  # slate-900
    d = ImageDraw.Draw(img)
    # rounded-square brand background
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=(15, 23, 42, 255))
    # emerald dumbbell
    bar_h = size * 0.10
    bar_y = size * 0.45
    bar_x0 = size * 0.18
    bar_x1 = size * 0.82
    d.rectangle([bar_x0, bar_y, bar_x1, bar_y + bar_h], fill=(52, 211, 153, 255))
    # two plates
    plate_w = size * 0.16
    plate_h = size * 0.34
    for cx in (bar_x0, bar_x1):
        x0 = cx - plate_w / 2
        y0 = size * 0.5 - plate_h / 2
        d.rounded_rectangle([x0, y0, x0 + plate_w, y0 + plate_h], radius=size * 0.04, fill=(52, 211, 153, 255))
    img.save(path)
    print('saved', path)

make_icon(192, 'public/icon-192.png')
make_icon(512, 'public/icon-512.png')
