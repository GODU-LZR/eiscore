#!/usr/bin/env python3
import argparse
import hashlib
import os
import shutil
import stat
import sys
import tempfile
from pathlib import Path


SERVICE_ANCHORS = {
    "db": "  db:\n    image: postgres:16-alpine\n    restart: unless-stopped\n",
    "api": "  api:\n    image: postgrest/postgrest:latest\n    restart: unless-stopped\n",
    "web": "  web:\n    image: nginx:1.27-alpine\n    restart: unless-stopped\n",
}
NETWORK_BLOCK = '''networks:
  data-plane:
    external: true
    name: lundu-eiscore-data-plane
  flash-internal:
    external: true
    name: lundu-eiscore-flash-internal
'''


def patch_text(source):
    content = str(source)
    changed = False
    for service, anchor in SERVICE_ANCHORS.items():
        network_name = "data-plane" if service in ("db", "api") else "flash-internal"
        network_lines = f"    networks:\n      - default\n      - {network_name}\n"
        position = content.find(anchor)
        if position < 0:
            if f"  {service}:\n" not in content or f"      - {network_name}\n" not in content:
                raise ValueError(f"could not identify the expected Lundu {service} service")
            continue
        if content.startswith(network_lines, position + len(anchor)):
            continue
        content = content.replace(anchor, anchor + network_lines, 1)
        changed = True

    if "networks:\n  data-plane:\n    external: true\n    name: lundu-eiscore-data-plane\n  flash-internal:\n    external: true\n    name: lundu-eiscore-flash-internal\n" not in content:
        if "\nnetworks:\n" in content:
            raise ValueError("remote Compose already has an unrecognized networks section")
        content = content.rstrip() + "\n\n" + NETWORK_BLOCK
        changed = True
    return content, changed


def apply_file(path, backup):
    target = Path(path)
    backup_path = Path(backup)
    if target.is_symlink() or not target.is_file():
        raise ValueError("Compose file must be an existing regular file")
    original = target.read_text(encoding="utf-8")
    updated, changed = patch_text(original)
    before = hashlib.sha256(original.encode("utf-8")).hexdigest()
    if not changed:
        print(f"Lundu Flash Compose networks already configured; sha256={before}")
        return
    if backup_path.exists():
        raise ValueError("backup path already exists")
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup_path)
    os.chmod(backup_path, stat.S_IRUSR | stat.S_IWUSR)
    descriptor, temporary = tempfile.mkstemp(prefix=".lundu-flash-compose-", dir=target.parent)
    try:
        if hasattr(os, "fchmod"):
            os.fchmod(descriptor, stat.S_IMODE(target.stat().st_mode))
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as output:
            output.write(updated)
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, target)
        os.chmod(target, stat.S_IMODE(target.stat().st_mode))
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise
    after = hashlib.sha256(target.read_bytes()).hexdigest()
    print(f"Lundu Flash Compose network attachments applied; before={before}; after={after}; backup={backup_path}")


def self_test():
    fixture = '''name: lundu-eiscore
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    env_file: [.env]
  api:
    image: postgrest/postgrest:latest
    restart: unless-stopped
    env_file: [.env]
  web:
    image: nginx:1.27-alpine
    restart: unless-stopped
    ports: ["127.0.0.1:18393:80"]
'''
    first, changed = patch_text(fixture)
    assert changed
    assert first.count("- data-plane") == 2
    assert first.count("- flash-internal") == 1
    second, changed = patch_text(first)
    assert not changed and second == first
    try:
        patch_text(fixture.replace("image: postgres:16-alpine", "image: postgres:17-alpine"))
    except ValueError:
        pass
    else:
        raise AssertionError("unexpected Compose input must fail closed")
    print("PASS: Lundu Flash Compose network patch is scoped, idempotent, and fails closed")


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--self-test"]:
            self_test()
        else:
            parser = argparse.ArgumentParser(description="Attach only Lundu data services and Web to Flash networks")
            parser.add_argument("--file", required=True)
            parser.add_argument("--backup", required=True)
            args = parser.parse_args()
            apply_file(args.file, args.backup)
    except Exception as error:
        print(f"Lundu Flash Compose patch failed: {error}", file=sys.stderr)
        sys.exit(1)
