import struct
import zlib

def create_icon(size, filename):
    pixels = []
    center = size // 2
    radius = size // 2 - 2

    for y in range(size):
        row = []
        for x in range(size):
            dx = x - center
            dy = y - center
            dist = (dx*dx + dy*dy) ** 0.5
            if dist < radius:
                t = dist / radius
                r = int(10 + t * 30)
                g = int(8 + t * 20)
                b = int(40 + t * 80)
                a = 255
                if dist < radius * 0.4:
                    r = int(r + 129)
                    g = int(g + 84)
                    b = int(b + 206)
                    if r > 255: r = 255
                    if g > 255: g = 255
                    if b > 255: b = 255
            else:
                r, g, b, a = 0, 0, 0, 0
            row.extend([r, g, b, a])
        pixels.append(bytes([0] + row))

    raw = b''.join(pixels)
    compressed = zlib.compress(raw)

    def chunk(ctype, data):
        c = ctype + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)

    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', ihdr)
    png += chunk(b'IDAT', compressed)
    png += chunk(b'IEND', b'')

    with open(filename, 'wb') as f:
        f.write(png)
    print(f'{filename} ({len(png)} bytes)')

create_icon(192, r'C:\Users\art_eus\Desktop\temp_site\icon-192.png')
create_icon(512, r'C:\Users\art_eus\Desktop\temp_site\icon-512.png')