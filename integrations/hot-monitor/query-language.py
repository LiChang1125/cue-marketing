"""Translate an arbitrary search subject locally. Only labels are returned, never news content."""
import json
import re
import sys
from pathlib import Path

import ctranslate2
import sentencepiece

ROOT = Path(__file__).resolve().parents[2] / ".tools/translation"


def translate(text, pair):
    folder = ROOT / pair
    if not (folder / "model/model.bin").is_file():
        return ""
    sp = sentencepiece.SentencePieceProcessor(model_proto=(folder / "sentencepiece.model").read_bytes())
    engine = ctranslate2.Translator(str(folder / "model"), device="cpu", compute_type="int8", intra_threads=2)
    result = engine.translate_batch([sp.encode(text, out_type=str)], beam_size=4, max_decoding_length=40, replace_unknowns=True)[0]
    label = "".join(result.hypotheses[0]).replace("▁", " ").strip(" \t\r\n。.!?！？「」“”\"'")
    return label if 1 < len(label) < 80 and not re.search(r"https?://|<unk>|[{}]", label) else ""


def labels(text):
    ja = re.search(r"[\u3040-\u30ff]", text)
    en = translate(text, "ja_en" if ja else "zh_en") if re.search(r"[\u3040-\u9fff]", text) else text
    out = {"en": en} if en else {}
    target = text if ja else translate(en, "en_ja") if en else ""
    if target:
        out["ja"] = target
    return out


if __name__ == "__main__":
    print(json.dumps(labels(sys.stdin.buffer.read().decode("utf-8-sig").strip()[:120]), ensure_ascii=True))

