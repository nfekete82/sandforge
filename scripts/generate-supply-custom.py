#!/usr/bin/env python3
"""Regenerate the user-approved Sandforge custom supply truck from pinned sources."""
import argparse
import base64
import hashlib
import pathlib
import struct
import subprocess
import sys
import tempfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / 'scripts/assets/sandforge-supply-6x6-source.zlib.b64'
OUT = ROOT / 'src/assets/reborn/supply-custom'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', action='store_true')
    args = parser.parse_args()
    raw = zlib.decompress(base64.b64decode(SRC.read_text().strip()))
    length = struct.unpack_from('<I', raw)[0]
    original = [raw[4:4 + length], raw[4 + length:]]
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='sf-supply-6x6-') as tmp:
        temporary = pathlib.Path(tmp)
        for name, data in zip(('build_supply_truck.py', 'optimize_asset.py'), original):
            script = data.decode('utf-8').replace('/mnt/data/sandforge_hauler', str(temporary))
            (temporary / name).write_text(script, encoding='utf-8')
        for name in ('build_supply_truck.py', 'optimize_asset.py'):
            subprocess.run([sys.executable, str(temporary / name)], check=True)
        generated = temporary / 'Sandforge_Nachschubtransporter_6x6_GAME_READY.glb'
        model = generated.read_bytes()
        if model[:4] != b'glTF' or int.from_bytes(model[8:12], 'little') != len(model):
            raise ValueError('Exported supply GLB is corrupt')
        if args.verify and hashlib.sha256(model).hexdigest() != '476f5604215a2a796e8c2cb3b15aa6661a6c89c5e74e4fdbf96fd2a599c31ae2':
            raise ValueError('Source output differs from the uploaded supply GLB')
        for team in (0, 1):
            target = OUT / f'supply-{team}.glb'
            target.write_bytes(model)
            print(f'{target.relative_to(ROOT)} | {len(model)} bytes')

if __name__ == '__main__':
    main()
