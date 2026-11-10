#!/usr/bin/env python3
import argparse
import hashlib
import os
import re
import shutil
import stat
import sys
import tempfile
from pathlib import Path


BEGIN = "  # BEGIN LUNDU FLASH HARNESS ROUTES"
END = "  # END LUNDU FLASH HARNESS ROUTES"
OLD_GENERIC_ROUTE = "location ~ ^/(ai|flash|twin|document-intake)/"
NEW_GENERIC_ROUTE = "location ~ ^/(ai|twin|document-intake)/"
FLASH_ROUTES = r'''  # BEGIN LUNDU FLASH HARNESS ROUTES
  location ~ ^/flash/ { proxy_pass http://flash-agent-runtime:8078; proxy_set_header Host $host; proxy_set_header Authorization $http_authorization; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
  location /harness-flash-embed/ {
    set $harness_flash_embed_allowed 0;
    if ($http_sec_fetch_dest = "iframe") { set $harness_flash_embed_allowed 1; }
    if ($http_referer ~ "^https://lundu\.eiscore\.top/") { set $harness_flash_embed_allowed 1; }
    if ($harness_flash_embed_allowed = 0) { return 403; }
    add_header Content-Security-Policy "frame-ancestors 'self'" always;
    add_header X-Frame-Options SAMEORIGIN always;
    proxy_pass http://deepseek-flash-web:3081/;
    proxy_redirect / /harness-flash-embed/;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $http_host;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Accept-Encoding "";
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_buffering off;
    proxy_read_timeout 1h;
    sub_filter_once off;
    sub_filter_types text/html application/javascript text/javascript;
    sub_filter '<base href="/">' '<base href="/harness-flash-embed/"><script>window.__EIS_HARNESS__=1;(()=>{const f=window.fetch;window.fetch=(i,o)=>{if(typeof i==="string"&&i.startsWith("/api/"))i="/harness-flash-embed-api/"+i.slice(5);else if(i instanceof URL&&i.pathname.startsWith("/api/"))i=new URL("/harness-flash-embed-api/"+i.pathname.slice(5)+i.search,i);return f(i,o)};const W=window.WebSocket;window.WebSocket=function(u,p){return new W(typeof u==="string"?u.replace("/api/","/harness-flash-embed-api/"):u,p)}})()</script>';
    sub_filter '"/plugins/' '"/harness-flash-embed-plugins/';
    sub_filter '"/assets/' '"/harness-flash-embed-assets/';
    sub_filter '"/plugins/events' '"/harness-flash-embed-plugins-events';
  }
  location /harness-flash-embed-plugins/ { proxy_pass http://deepseek-flash-web:3081/plugins/; proxy_set_header Host $host; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_buffering off; proxy_read_timeout 1h; }
  location /harness-flash-embed-assets/ { proxy_pass http://deepseek-flash-web:3081/assets/; proxy_set_header Host $host; }
  location /harness-flash-embed-plugins-events { proxy_pass http://deepseek-flash-web:3081/plugins/events; proxy_set_header Host $host; proxy_set_header Authorization $http_authorization; proxy_set_header Connection ""; proxy_buffering off; proxy_cache off; proxy_read_timeout 1h; }
  location /harness-flash-embed-api/ { proxy_pass http://deepseek-flash-web:3081/api/; proxy_set_header Host $host; proxy_set_header X-Forwarded-Proto https; proxy_set_header X-Forwarded-Host $host; proxy_set_header Authorization $http_authorization; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; proxy_buffering off; proxy_read_timeout 1h; }
  # END LUNDU FLASH HARNESS ROUTES'''


def patch_text(source):
    content = str(source)
    has_begin = BEGIN in content
    has_end = END in content
    if has_begin or has_end:
        if not (has_begin and has_end and OLD_GENERIC_ROUTE not in content):
            raise ValueError("partial or inconsistent Flash Nginx patch markers")
        for required in ("/harness-flash-embed/", "/harness-flash-embed-api/", "flash-agent-runtime:8078"):
            if required not in content:
                raise ValueError("existing Flash Nginx routes are incomplete")
        return content, False

    old_count = content.count(OLD_GENERIC_ROUTE)
    new_count = content.count(NEW_GENERIC_ROUTE)
    if old_count == 1:
        content = content.replace(OLD_GENERIC_ROUTE, NEW_GENERIC_ROUTE, 1)
    elif old_count != 0 or new_count != 1:
        raise ValueError("expected exactly one Lundu generic AI/twin route to separate Flash")

    stripped = content.rstrip()
    if not stripped.endswith("}") or stripped.count("server {") != 1:
        raise ValueError("expected one complete Nginx server block")
    closing = stripped.rfind("\n}")
    if closing < 0:
        raise ValueError("could not locate the Nginx server block terminator")
    result = f"{stripped[:closing]}\n{FLASH_ROUTES}\n}}\n"
    return result, True


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def apply_file(path, backup):
    target = Path(path)
    backup_path = Path(backup)
    if target.is_symlink() or not target.is_file():
        raise ValueError("Nginx config must be an existing regular file")
    original = target.read_text(encoding="utf-8")
    updated, changed = patch_text(original)
    before = hashlib.sha256(original.encode("utf-8")).hexdigest()
    if not changed:
        print(f"Lundu Flash Nginx routes already applied; sha256={before}")
        return
    if backup_path.exists():
        raise ValueError("backup path already exists")
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(target, backup_path)
    os.chmod(backup_path, stat.S_IRUSR | stat.S_IWUSR)
    descriptor, temporary = tempfile.mkstemp(prefix=".lundu-flash-nginx-", dir=target.parent)
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
    after = sha256(target)
    print(f"Lundu Flash Nginx routes applied; before={before}; after={after}; backup={backup_path}")


def self_test():
    fixture = '''server {
  location ~ ^/(ai|flash|twin|document-intake)/ { proxy_pass http://agent:8078; }
  location /harness-api/ { return 403; }
}
'''
    first, changed = patch_text(fixture)
    assert changed
    assert NEW_GENERIC_ROUTE in first and OLD_GENERIC_ROUTE not in first
    assert "/harness-flash-embed-api/" in first
    second, changed = patch_text(first)
    assert not changed and second == first
    try:
        patch_text(fixture.replace(OLD_GENERIC_ROUTE, "location ~ ^/other/"))
    except ValueError:
        pass
    else:
        raise AssertionError("unexpected Nginx input must fail closed")
    print("PASS: Lundu Flash Nginx patch is scoped, idempotent, and fails closed")


if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--self-test"]:
            self_test()
        else:
            parser = argparse.ArgumentParser(description="Add only the Lundu Flash Harness Nginx routes")
            parser.add_argument("--file", required=True)
            parser.add_argument("--backup", required=True)
            args = parser.parse_args()
            apply_file(args.file, args.backup)
    except Exception as error:
        print(f"Lundu Flash Nginx patch failed: {error}", file=sys.stderr)
        sys.exit(1)
