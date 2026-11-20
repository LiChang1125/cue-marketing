"""Install the pinned Japanese–English model used before CUE's local Chinese translator."""
import hashlib
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / ".tools/translation"
URL = "https://argos-net.com/v1/translate-ja_en-1_1.argosmodel"
DIGEST = "623e3477959a815eb0a5ef53e09079ae8f1f9d3bbcd230473baf28c03fb83335"
FILES = ["sentencepiece.model", "model/model.bin", "model/shared_vocabulary.txt", "metadata.json", "README.md"]


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    target = ROOT / "ja_en"
    if all((target / name).is_file() for name in FILES):
        return
    with tempfile.TemporaryDirectory(dir=ROOT) as directory:
        stage = Path(directory)
        archive = Path(sys.argv[1]) if len(sys.argv) > 1 else stage / "ja-en.zip"
        if len(sys.argv) == 1:
            with urllib.request.urlopen(URL, timeout=120) as response, archive.open("wb") as output:
                shutil.copyfileobj(response, output)
        with archive.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != DIGEST:
                raise ValueError("Japanese translation package checksum mismatch")
        with zipfile.ZipFile(archive) as package:
            for name in FILES:
                member = "ja_en/" + name
                dest = stage / member
                dest.parent.mkdir(parents=True, exist_ok=True)
                with package.open(member) as source, dest.open("wb") as output:
                    shutil.copyfileobj(source, output)
        (stage / "ja_en").rename(target)


if __name__ == "__main__":
    main()

