#!/usr/bin/env python
"""Heuristic paragraph-level AIGC risk scanner for Chinese thesis drafts.

This tool uses open-source detector models from:
https://huggingface.co/yuchuantian/AIGC_detector_zhv3
https://huggingface.co/yuchuantian/AIGC_detector_zhv3short

It is intended for local self-check only. The reported scores do not
represent any school's official AI-detection result.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import torch
from docx import Document
from huggingface_hub import snapshot_download
from transformers import AutoModelForSequenceClassification, AutoTokenizer


DEFAULT_RUNTIME_ROOT = Path.home() / ".aigc-scan"
DEFAULT_MODEL_ROOT = DEFAULT_RUNTIME_ROOT / "models"
LONG_MODEL_NAME = "yuchuantian/AIGC_detector_zhv3"
SHORT_MODEL_NAME = "yuchuantian/AIGC_detector_zhv3short"
LONG_MODEL_DIR = DEFAULT_MODEL_ROOT / "zhv3"
SHORT_MODEL_DIR = DEFAULT_MODEL_ROOT / "zhv3short"
SHORT_THRESHOLD = 220
MAX_CHARS_PER_CHUNK = 800


@dataclass
class ScanRow:
    index: int
    chars: int
    risk_level: str
    ai_risk_score: float
    human_score: float
    raw_label_0: float
    raw_label_1: float
    model_used: str
    preview: str
    text: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scan thesis paragraphs and output heuristic AIGC risk scores."
    )
    parser.add_argument("input", help="Input file path. Supports .md, .txt, .docx.")
    parser.add_argument(
        "-o",
        "--output-dir",
        help="Directory for generated reports. Defaults to input sibling folder scan-output.",
    )
    parser.add_argument(
        "--max-chars-per-chunk",
        type=int,
        default=MAX_CHARS_PER_CHUNK,
        help="Split long paragraphs into chunks of approximately this size.",
    )
    parser.add_argument(
        "--short-threshold",
        type=int,
        default=SHORT_THRESHOLD,
        help="Paragraphs shorter than or equal to this value use the short model.",
    )
    return parser.parse_args()


def ensure_model(local_dir: Path, repo_id: str) -> Path:
    if local_dir.exists() and any(local_dir.iterdir()):
        return local_dir
    local_dir.parent.mkdir(parents=True, exist_ok=True)
    snapshot_download(repo_id, local_dir=str(local_dir))
    return local_dir


def read_text(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".md", ".txt"}:
        return path.read_text(encoding="utf-8")
    if suffix == ".docx":
        document = Document(str(path))
        lines = [p.text.strip() for p in document.paragraphs]
        return "\n".join(line for line in lines if line)
    raise ValueError(f"Unsupported file type: {path.suffix}")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_markdown_or_text(text: str) -> List[str]:
    paragraphs = []
    for block in re.split(r"\n\s*\n", text):
        block = block.strip()
        if not block:
            continue
        if re.fullmatch(r"#{1,6}\s+.*", block):
            continue
        if re.fullmatch(r"[-*]\s+.*", block):
            continue
        if re.fullmatch(r"\d+\.\s+.*", block):
            continue
        paragraphs.append(block)
    return paragraphs


def split_sentences(text: str) -> List[str]:
    parts = re.split(r"(?<=[。！？!?；;])", text)
    sentences = [part.strip() for part in parts if part.strip()]
    return sentences or [text]


def chunk_paragraph(paragraph: str, max_chars: int) -> List[str]:
    paragraph = paragraph.strip()
    if len(paragraph) <= max_chars:
        return [paragraph]
    chunks: List[str] = []
    current = ""
    for sentence in split_sentences(paragraph):
        if not current:
            current = sentence
            continue
        if len(current) + len(sentence) <= max_chars:
            current += sentence
        else:
            chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)
    return chunks


def extract_paragraphs(path: Path, max_chars: int) -> List[str]:
    text = normalize_text(read_text(path))
    paragraphs = split_markdown_or_text(text)
    expanded: List[str] = []
    for paragraph in paragraphs:
        expanded.extend(chunk_paragraph(paragraph, max_chars))
    return expanded


class DetectorPool:
    def __init__(self, short_threshold: int) -> None:
        self.short_threshold = short_threshold
        self.cache: Dict[str, Tuple[AutoTokenizer, AutoModelForSequenceClassification]] = {}

    def get(self, kind: str) -> Tuple[AutoTokenizer, AutoModelForSequenceClassification, str]:
        if kind == "short":
            local_dir = ensure_model(SHORT_MODEL_DIR, SHORT_MODEL_NAME)
            key = "short"
        else:
            local_dir = ensure_model(LONG_MODEL_DIR, LONG_MODEL_NAME)
            key = "long"
        if key not in self.cache:
            tokenizer = AutoTokenizer.from_pretrained(str(local_dir))
            model = AutoModelForSequenceClassification.from_pretrained(str(local_dir))
            model.eval()
            self.cache[key] = (tokenizer, model)
        tokenizer, model = self.cache[key]
        return tokenizer, model, local_dir.name

    def score(self, text: str) -> Tuple[float, float, float, float, str]:
        kind = "short" if len(text) <= self.short_threshold else "long"
        tokenizer, model, model_name = self.get(kind)
        encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with torch.no_grad():
            logits = model(**encoded).logits
            probs = torch.softmax(logits, dim=-1)[0].tolist()

        label_0 = float(probs[0])
        label_1 = float(probs[1])
        # Empirical interpretation for local self-check:
        # LABEL_0 behaves closer to AI-like generic paragraphs,
        # LABEL_1 behaves closer to human-like specific paragraphs.
        ai_risk = label_0
        human_score = label_1
        return ai_risk, human_score, label_0, label_1, model_name


def classify_risk(score: float) -> str:
    if score >= 0.70:
        return "high"
    if score >= 0.45:
        return "medium"
    return "low"


def build_rows(paragraphs: Sequence[str], detector: DetectorPool) -> List[ScanRow]:
    rows: List[ScanRow] = []
    for index, paragraph in enumerate(paragraphs, start=1):
        ai_risk, human_score, label_0, label_1, model_name = detector.score(paragraph)
        rows.append(
            ScanRow(
                index=index,
                chars=len(paragraph),
                risk_level=classify_risk(ai_risk),
                ai_risk_score=round(ai_risk, 6),
                human_score=round(human_score, 6),
                raw_label_0=round(label_0, 6),
                raw_label_1=round(label_1, 6),
                model_used=model_name,
                preview=paragraph[:80],
                text=paragraph,
            )
        )
    return rows


def write_csv(path: Path, rows: Sequence[ScanRow]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(asdict(rows[0]).keys()))
        writer.writeheader()
        for row in rows:
            writer.writerow(asdict(row))


def write_json(path: Path, rows: Sequence[ScanRow]) -> None:
    path.write_text(
        json.dumps([asdict(row) for row in rows], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_markdown(path: Path, input_path: Path, rows: Sequence[ScanRow]) -> None:
    total = len(rows)
    avg_ai = sum(row.ai_risk_score for row in rows) / total if total else 0.0
    high = sum(1 for row in rows if row.risk_level == "high")
    medium = sum(1 for row in rows if row.risk_level == "medium")
    low = sum(1 for row in rows if row.risk_level == "low")
    top_rows = sorted(rows, key=lambda item: item.ai_risk_score, reverse=True)[:10]

    lines = [
        "# 本地 AIGC 启发式扫描报告",
        "",
        f"- 输入文件：`{input_path}`",
        f"- 段落数：`{total}`",
        f"- 平均 AI 风险分：`{avg_ai:.4f}`",
        f"- 高风险段落：`{high}`",
        f"- 中风险段落：`{medium}`",
        f"- 低风险段落：`{low}`",
        "",
        "> 说明：这是基于开源模型的启发式扫描，不等于学校系统的 AIGC 检测结果。",
        "",
        "## Top 10 风险段落",
        "",
        "| 段落 | 风险级别 | AI 风险分 | 字数 | 模型 | 预览 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for row in top_rows:
        preview = row.preview.replace("|", "\\|")
        lines.append(
            f"| {row.index} | {row.risk_level} | {row.ai_risk_score:.4f} | "
            f"{row.chars} | {row.model_used} | {preview} |"
        )
    lines.extend(
        [
            "",
            "## 使用建议",
            "",
            "- 多个工具或多次扫描都指向的高风险段落，优先回到项目事实重写。",
            "- 不要机械同义词替换，优先补充真实模块、真实表名、真实测试过程。",
            "- 结合截图、图表、表结构和测试用例一起收口，比盯着单个分数更稳。",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        print(f"Input not found: {input_path}", file=sys.stderr)
        return 1

    output_dir = (
        Path(args.output_dir).expanduser().resolve()
        if args.output_dir
        else input_path.parent / "scan-output"
    )
    output_dir.mkdir(parents=True, exist_ok=True)

    paragraphs = extract_paragraphs(input_path, args.max_chars_per_chunk)
    if not paragraphs:
        print("No paragraphs extracted from input.", file=sys.stderr)
        return 1

    detector = DetectorPool(short_threshold=args.short_threshold)
    rows = build_rows(paragraphs, detector)

    stem = input_path.stem
    csv_path = output_dir / f"{stem}_aigc_scan.csv"
    json_path = output_dir / f"{stem}_aigc_scan.json"
    md_path = output_dir / f"{stem}_aigc_scan.md"

    write_csv(csv_path, rows)
    write_json(json_path, rows)
    write_markdown(md_path, input_path, rows)

    top_rows = sorted(rows, key=lambda item: item.ai_risk_score, reverse=True)[:5]
    print(f"Scan finished for: {input_path}")
    print(f"Paragraphs: {len(rows)}")
    print(f"CSV: {csv_path}")
    print(f"JSON: {json_path}")
    print(f"Markdown report: {md_path}")
    print("")
    print("Top 5 risk paragraphs:")
    for row in top_rows:
        print(
            f"- #{row.index} [{row.risk_level}] "
            f"ai_risk={row.ai_risk_score:.4f} chars={row.chars} preview={row.preview}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
