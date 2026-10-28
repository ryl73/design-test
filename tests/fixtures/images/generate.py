"""Synthetic local image fixtures; stdlib + macOS sips, no network/user images.
Run: python3 generate.py /tmp/design-qa-image-fixtures
"""
import pathlib
import struct
import subprocess
import sys
import zlib

out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data))

def png(width, height, animated=False):
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    if animated:
        data += chunk(b'acTL', struct.pack('>II', 1, 0))
    # Visible grid and transparency exercise natural pixel alignment and white alpha background.
    pixels = b''.join(b'\x00' + b''.join(bytes((40 if x % 32 < 16 else 220, 80 if y % 32 < 16 else 200, 150, 255 if x < width // 2 else 100)) for x in range(width)) for y in range(height))
    return data + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')

valid = png(320, 240)
(out / 'site-320x240.png').write_bytes(valid)
(out / 'figma-300x200.png').write_bytes(png(300, 200))
(out / 'animated.png').write_bytes(png(32, 24, True))
(out / 'corrupt.png').write_bytes(valid[:40])
# Syntactically valid header and chunks but broken compressed pixels: decode must fail.
(out / 'decode-corrupt.png').write_bytes(valid[:33] + chunk(b'IDAT', b'broken') + chunk(b'IEND', b''))
(out / 'unsupported.gif').write_bytes(b'GIF89a' + b'\0' * 24)
(out / 'oversize.png').write_bytes(valid + b'\0' * (15 * 1024 * 1024 + 1 - len(valid)))
for name, width, height in [('width-limit.png', 4097, 1), ('height-limit.png', 1, 10001), ('pixels-limit.png', 4096, 6251)]:
    (out / name).write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IEND', b''))
subprocess.run(['sips', '-s', 'format', 'jpeg', str(out / 'site-320x240.png'), '--out', str(out / 'site-320x240.jpg')], check=True, capture_output=True)
jpeg = (out / 'site-320x240.jpg').read_bytes()
# Little-endian TIFF, Orientation=6 (90 degrees clockwise); browser dimensions become 240 x 320.
tiff = b'II\x2a\x00\x08\x00\x00\x00\x01\x00' + struct.pack('<HHI', 274, 3, 1) + b'\x06\x00\x00\x00' + b'\x00\x00\x00\x00'
exif = b'Exif\x00\x00' + tiff
(out / 'oriented-240x320.jpg').write_bytes(jpeg[:2] + b'\xff\xe1' + struct.pack('>H', len(exif) + 2) + exif + jpeg[2:])
print(out)
