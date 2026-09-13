#!/usr/bin/env python3
"""
Generate Android app icons from www/icon-512.png
Uses PIL (Pillow) to resize to all required sizes
"""

import os
import sys
import subprocess

def install_pillow():
    try:
        from PIL import Image
        return True
    except ImportError:
        print("Installing Pillow...")
        subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'Pillow', '--quiet'])
        return True

def generate_icons():
    install_pillow()
    from PIL import Image

    SOURCE = 'www/icon-512.png'
    if not os.path.exists(SOURCE):
        print(f"ERROR: {SOURCE} not found!")
        sys.exit(1)

    # Android icon sizes
    SIZES = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192,
    }

    BASE = 'android/app/src/main/res'
    img = Image.open(SOURCE).convert('RGBA')

    print("=" * 50)
    print("Generating Android icons from", SOURCE)
    print("=" * 50)

    for folder, size in SIZES.items():
        folder_path = os.path.join(BASE, folder)
        os.makedirs(folder_path, exist_ok=True)

        # Resize square icon
        resized = img.resize((size, size), Image.LANCZOS)

        # Save square
        square_path = os.path.join(folder_path, 'ic_launcher.png')
        resized.save(square_path, 'PNG')
        print(f"✓ {square_path} ({size}x{size})")

        # Save round (same image, Android handles masking)
        round_path = os.path.join(folder_path, 'ic_launcher_round.png')
        resized.save(round_path, 'PNG')
        print(f"✓ {round_path} ({size}x{size})")

        # Save foreground (for adaptive icons)
        fg_path = os.path.join(folder_path, 'ic_launcher_foreground.png')
        resized.save(fg_path, 'PNG')

    # Also save a splash icon
    drawable_path = os.path.join(BASE, 'drawable')
    os.makedirs(drawable_path, exist_ok=True)
    splash = img.resize((512, 512), Image.LANCZOS)
    splash.save(os.path.join(drawable_path, 'splash.png'), 'PNG')
    print("✓ Splash icon created")

    print("=" * 50)
    print("✅ All icons generated successfully!")
    print("=" * 50)

if __name__ == '__main__':
    generate_icons()
