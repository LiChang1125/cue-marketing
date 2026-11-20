"""Translate monitor copy on the local machine using CUE's pinned Argos model."""
import importlib.util
import json
from pathlib import Path
import sqlite3
import sys

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("cue_localization", root / "scripts/localize-public-data.py")
cue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cue)
texts = json.load(sys.stdin)
reviewed = json.loads((root / "config/translations.zh-CN.json").read_text(encoding="utf-8-sig"))
with sqlite3.connect(sys.argv[1], timeout=20) as cache:
    cache.execute("CREATE TABLE IF NOT EXISTS strings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
    result, missing = {}, []
    for text in texts:
        row = cache.execute("SELECT value FROM strings WHERE key=?", (cue.text_key(text),)).fetchone()
        if text in reviewed:
            result[text] = reviewed[text]
        elif row:
            result[text] = row[0]
        else:
            missing.append(text)
    if missing:
        import ctranslate2
        import sentencepiece
        model = cue.install_model(root / ".tools/translation")
        tokenizer = sentencepiece.SentencePieceProcessor(model_proto=(model / "sentencepiece.model").read_bytes())
        engine = ctranslate2.Translator(str(model / "model"), device="cpu", compute_type="default", intra_threads=2)
        jp_dir = root / ".tools/translation/ja_en"
        japanese = {t for t in missing if any("\u3040" <= c <= "\u30ff" for c in t)}
        prepared = {text: text for text in missing if text not in japanese}
        if japanese and (jp_dir / "model/model.bin").is_file():
            jp_tokenizer = sentencepiece.SentencePieceProcessor(model_proto=(jp_dir / "sentencepiece.model").read_bytes())
            jp_engine = ctranslate2.Translator(str(jp_dir / "model"), device="cpu", compute_type="default", intra_threads=2)
            ordered = sorted(japanese)
            for offset in range(0, len(ordered), 12):
                part = ordered[offset:offset+12]
                translated = jp_engine.translate_batch([jp_tokenizer.encode(t, out_type=str) for t in part], beam_size=3, max_decoding_length=260)
                prepared.update({t: jp_tokenizer.decode(v.hypotheses[0]) for t, v in zip(part, translated)})
            del jp_engine
        ready = list(prepared)
        for offset in range(0, len(ready), 12):
            batch = ready[offset:offset+12]
            encoded = [tokenizer.encode(prepared[t], out_type=str) for t in batch]
            decoded = engine.translate_batch(encoded, beam_size=3, max_decoding_length=360, replace_unknowns=True)
            for text, translation in zip(batch, decoded):
                value = "".join(translation.hypotheses[0]).replace("▁", " ").strip()
                result[text] = value
                cache.execute("INSERT OR REPLACE INTO strings VALUES (?, ?)", (cue.text_key(text), value))
print(json.dumps(result, ensure_ascii=False))

