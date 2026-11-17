"""Translate display copy locally. No account, API key, or remote text service."""
import argparse
import hashlib
import json
import re
import urllib.request
import zipfile
from pathlib import Path

MODEL_URL = 'https://argos-net.com/v1/translate-en_zh-1_9.argosmodel'
MODEL_SHA = '433e7c4f034d87fbe2353161e05f18646d7999452f801a4e1f0378522b9850ab'
MODEL_VERSION = 'argos-en-zh-1.9'

def needs_translation(text):
    if not isinstance(text, str):
        return False
    latin = len(re.findall(r'[A-Za-z]', text))
    han = len(re.findall(r'[\u3400-\u9fff]', text))
    return latin >= 12 and han < max(3, latin * 0.12)

def text_key(text):
    return hashlib.sha256((MODEL_VERSION + '\n' + text).encode()).hexdigest()

def install_model(root):
    root.mkdir(parents=True, exist_ok=True)
    archive = root / 'en-zh.argosmodel'
    if not archive.exists() or hashlib.sha256(archive.read_bytes()).hexdigest() != MODEL_SHA:
        urllib.request.urlretrieve(MODEL_URL, archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != MODEL_SHA:
        raise ValueError('Translation model checksum mismatch')
    target = root / 'translate-en_zh-1_9'
    if not (target / 'model/model.bin').exists():
        with zipfile.ZipFile(archive) as package:
            for entry in package.infolist():
                path = (root / entry.filename).resolve()
                if not path.is_relative_to(root.resolve()):
                    raise ValueError('Unsafe model package path')
            package.extractall(root)
    return target

def localize(data, translate):
    cache = data.get('translationCache', {})
    pending, records = {}, []
    def walk(value):
        if isinstance(value, list):
            for child in value:
                walk(child)
        elif isinstance(value, dict):
            for field in ('title', 'excerpt', 'subtitle'):
                text = value.get(field)
                if needs_translation(text):
                    key = text_key(text)
                    records.append((value, field, text, key))
                    if key not in cache:
                        pending[key] = text
            for key, child in list(value.items()):
                if key not in ('translationCache', 'originalTitle', 'originalExcerpt'):
                    walk(child)
    walk(data)
    if pending:
        outputs = translate(list(pending.values()))
        if len(outputs) != len(pending):
            raise ValueError('Translation batch length mismatch')
        for key, output in zip(pending, outputs):
            if not output or not re.search(r'[\u3400-\u9fff]', output):
                raise ValueError('Translator did not produce Chinese')
            cache[key] = output
    for record, field, original, key in records:
        if field in ('title', 'excerpt'):
            record.setdefault('original' + field.title(), original)
        record[field] = cache[key]
        record['translation'] = {'language': 'zh-CN', 'method': MODEL_VERSION}
    data['translationCache'] = cache
    return len(pending), len(records)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', default='.artifacts/public-data/content-data.json')
    args = parser.parse_args()
    path = Path(args.input)
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    def translate(texts):
        import ctranslate2
        import sentencepiece
        model = install_model(Path('.tools/translation'))
        tokenizer = sentencepiece.SentencePieceProcessor(model_file=str(model / 'sentencepiece.model'))
        engine = ctranslate2.Translator(str(model / 'model'), device='cpu', compute_type='int8', inter_threads=1, intra_threads=2)
        results = []
        for offset in range(0, len(texts), 12):
            batch = texts[offset:offset+12]
            tokens = [tokenizer.encode(text, out_type=str) for text in batch]
            translated = engine.translate_batch(tokens, beam_size=4, max_decoding_length=384, repetition_penalty=1.1, no_repeat_ngram_size=4)
            results.extend(tokenizer.decode(row.hypotheses[0]).strip() for row in translated)
            print(f'Translated {min(offset+12,len(texts))}/{len(texts)} display strings', flush=True)
        return results
    new_count, total = localize(data, translate)
    # Commit only a complete localized payload. Failed translation keeps the existing site.
    temp = path.with_suffix('.localized.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    temp.replace(path)
    print(json.dumps({'translated': new_count, 'localizedFields': total, 'method': MODEL_VERSION}))

if __name__ == '__main__':
    main()
