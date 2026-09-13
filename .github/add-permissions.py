#!/usr/bin/env python3
"""
Add camera and storage permissions to AndroidManifest.xml
"""
import os
import sys

MANIFEST_PATH = 'android/app/src/main/AndroidManifest.xml'

PERMISSIONS = '''
    <!-- Permissions added by SIC Enterprise build -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
'''

def add_permissions():
    if not os.path.exists(MANIFEST_PATH):
        print(f"ERROR: {MANIFEST_PATH} not found!")
        sys.exit(1)
    
    with open(MANIFEST_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if 'android.permission.CAMERA' in content:
        print("Permissions already present, skipping...")
        return
    
    if '</manifest>' not in content:
        print("ERROR: </manifest> tag not found!")
        sys.exit(1)
    
    content = content.replace('</manifest>', PERMISSIONS + '</manifest>')
    
    with open(MANIFEST_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("=" * 50)
    print("✅ Permissions added successfully!")
    print("=" * 50)
    print(content)
    print("=" * 50)

if __name__ == '__main__':
    add_permissions()
