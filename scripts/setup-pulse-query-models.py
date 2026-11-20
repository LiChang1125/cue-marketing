"""Install the two query translation models used to search publishers in their own language."""
import hashlib
import os
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / ".tools/translation"
PACKAGES = {
    "zh_en": ("1_9", "62e7af5a3a48b530e47b7b3e5c78c2de79073ecd815750d2bf3ab35b4a67da2d"),
    "en_ja": ("1_1", "16300cc4eaa85320520cabcf433b63d01be40ef6966251de72043a083408f716"),
}
FILES = {"metadata.json", "README.md", "sentencepiece.model", "model/model.bin", "model/config.json",
         "model/shared_vocabulary.json", "model/shared_vocabulary.txt", "model/source_vocabulary.txt", "model/target_vocabulary.txt"}


def install(pair, archive=None):
    version, digest = PACKAGES[pair]
    target = ROOT / pair
    if (target / "model/model.bin").is_file() and (target / "sentencepiece.model").is_file():
        return
    ROOT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=ROOT) as temp:
        working = Path(temp)
        if archive is None:
            archive = working / "package.zip"
            with urllib.request.urlopen(f"https://argos-net.com/v1/translate-{pair}-{version}.argosmodel", timeout=180) as response, archive.open("wb") as out:
                shutil.copyfileobj(response, out)
        with Path(archive).open("rb") as src:
            if hashlib.file_digest(src, "sha256").hexdigest() != digest:
                raise ValueError(f"Invalid checksum for {pair}")
        unpacked = working / pair
        with zipfile.ZipFile(archive) as package:
            for entry in package.namelist():
                relative = entry.partition("/")[2]
                if relative not in FILES:
                    continue
                path = unpacked / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                with package.open(entry) as src, path.open("wb") as out:
                    shutil.copyfileobj(src, out)
        if not all((unpacked / name).is_file() for name in ["sentencepiece.model", "model/model.bin"]):
            raise ValueError(f"Incomplete {pair} model")
        os.replace(unpacked, target)


if __name__ == "__main__":
    if len(sys.argv) == 3:
        install(sys.argv[1], sys.argv[2])
    else:
        for pair in PACKAGES:
            install(pair)

