"""Download a byte-identical pinned Argos package from available distribution mirrors."""
import hashlib
import shutil
import urllib.request

MIRRORS = (
    "https://argos-net.com/v1/",
    "https://data.argosopentech.com/argospm/v1/",
    "https://huggingface.co/TiberiuCristianLeon/Argostranslate/resolve/52632ee42da594912409d9a2ccc601984385de4d/",
)


def download(filename, archive, digest):
    for base in MIRRORS:
        try:
            request = urllib.request.Request(base + filename, headers={"User-Agent": "CUE-Model-Installer/1.0"})
            with urllib.request.urlopen(request, timeout=120) as source, archive.open("wb") as out:
                shutil.copyfileobj(source, out)
            with archive.open("rb") as stream:
                if hashlib.file_digest(stream, "sha256").hexdigest() == digest:
                    return
        except OSError:
            continue
    raise RuntimeError("No mirror returned the verified model: " + filename)

