#!/usr/bin/env python3
import argparse
import os
import re
import secrets
import stat
import sys
import tempfile
from pathlib import Path


SECRET_NAMES = (
    "FLASH_AGENT_DB_PASSWORD",
    "FLASH_EISCORE_HARNESS_AUDIT_HASH_KEY",
    "FLASH_EISCORE_HARNESS_BRIDGE_SECRET",
    "FLASH_EISCORE_TOOL_PROXY_SECRET",
)
SECRET_MINIMUMS = {
    "FLASH_AGENT_DB_PASSWORD": 24,
    "FLASH_EISCORE_HARNESS_AUDIT_HASH_KEY": 32,
    "FLASH_EISCORE_HARNESS_BRIDGE_SECRET": 32,
    "FLASH_EISCORE_TOOL_PROXY_SECRET": 32,
}
KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]{24,512}$")
SECRET_PATTERN = re.compile(r"^[A-Za-z0-9_-]{24,512}$")
LINE_PATTERN = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def main():
    parser = argparse.ArgumentParser(description="Configure Lundu-only Flash Harness environment")
    parser.add_argument("--file", required=True)
    parser.add_argument("--harness-root", required=True)
    parser.add_argument("--flash-source", required=True)
    parser.add_argument("--workspace", required=True)
    args = parser.parse_args()

    target = Path(args.file)
    if target.is_symlink() or not target.is_file():
        raise ValueError("environment file must be an existing regular file")
    if not Path(args.harness_root).is_absolute() or not Path(args.flash_source).is_absolute() or not Path(args.workspace).is_absolute():
        raise ValueError("Harness, source, and workspace paths must be absolute")

    api_key = sys.stdin.readline().rstrip("\r\n")
    if not KEY_PATTERN.fullmatch(api_key):
        raise ValueError("Flash provider key format is invalid")

    original = target.read_text(encoding="utf-8")
    lines = original.splitlines()
    values = {}
    positions = {}
    for index, line in enumerate(lines):
        match = LINE_PATTERN.match(line)
        if not match:
            continue
        name = match.group(1)
        if name in positions:
            raise ValueError(f"duplicate environment key: {name}")
        positions[name] = index
        values[name] = match.group(2).strip().strip('"').strip("'")

    if values.get("DEEPSEEK_API_KEY") == api_key:
        raise ValueError("Flash provider key must be independent from the business Provider key")

    updates = {
        "DSH_PROVIDER": "deepseek-official",
        "DSH_MODEL": "deepseek-v4-flash",
        "FLASH_AGENT_DB_USER": "eiscore_flash_agent",
        "FLASH_DEEPSEEK_API_KEY": api_key,
        "LUNDU_HARNESS_ROOT": args.harness_root,
        "LUNDU_FLASH_SOURCE": args.flash_source,
        "LUNDU_FLASH_WORKSPACE": args.workspace,
    }
    existing_secrets = {values.get(name, "") for name in (
        "POSTGRES_PASSWORD", "POSTGREST_DB_PASSWORD", "AGENT_DB_PASSWORD", "PGRST_JWT_SECRET",
        "DEEPSEEK_API_KEY", "EISCORE_HARNESS_BRIDGE_SECRET", "EISCORE_TOOL_PROXY_SECRET",
    )}
    for name in SECRET_NAMES:
        value = values.get(name) or secrets.token_urlsafe(36)
        if (not SECRET_PATTERN.fullmatch(value)
                or len(value) < SECRET_MINIMUMS[name]
                or value in existing_secrets
                or value == api_key):
            raise ValueError(f"{name} is invalid or reuses another credential")
        updates[name] = value
        existing_secrets.add(value)

    for name, value in updates.items():
        line = f"{name}={value}"
        if name in positions:
            lines[positions[name]] = line
        else:
            lines.append(line)

    payload = "\n".join(lines) + "\n"
    descriptor, temporary = tempfile.mkstemp(prefix=".lundu-flash-env-", dir=target.parent)
    try:
        if hasattr(os, "fchmod"):
            os.fchmod(descriptor, stat.S_IRUSR | stat.S_IWUSR)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
        os.chmod(target, stat.S_IRUSR | stat.S_IWUSR)
    except Exception:
        try:
            os.unlink(temporary)
        except OSError:
            pass
        raise

    print("Lundu Flash environment configured; credential values redacted.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Lundu Flash environment configuration failed: {error}", file=sys.stderr)
        sys.exit(1)
