"""Read public community stories and discussions through the pinned last30days collectors."""
import datetime as dt
import json
import os
import re
import sys
import time
import sqlite3
from pathlib import Path
from urllib.parse import urlencode

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / ".tools/last30days/262391603f3c2807606bffa0170547273fc273e5/skills/last30days/scripts"))
from lib import hackernews, reddit_arctic as archive

def run(task):
    deadline = time.monotonic() + 19
    if task.get("post"):
        return archive.fetch_post_comments(task["post"], limit=4, deadline=deadline)
    now = dt.datetime.now(dt.timezone.utc)
    since = now - dt.timedelta(days=30)
    if task.get("hn"):
        term = task["hn"]
        result = hackernews.search_hackernews(term, since.date().isoformat(), now.date().isoformat(), "quick")
        return hackernews.parse_hackernews_response(result, term)
    cache_dir = Path(os.environ.get("CUE_TOPIC_DATA_DIR", root / ".artifacts/hot-monitor-preview"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache = sqlite3.connect(cache_dir / "reddit-archive.db", timeout=3)
    cache.execute("CREATE TABLE IF NOT EXISTS queries (key TEXT PRIMARY KEY, fetched REAL, rows TEXT)")
    cache.execute("DELETE FROM queries WHERE fetched < ?", (time.time()-86400,))
    cache.commit()
    entries, succeeded = {}, 0
    # Search titles inside the relevant communities to avoid filling the sample
    # with their most popular off-topic posts. Normalize through upstream.
    for sub, term in task["searches"][:5]:
        if time.monotonic() >= deadline-8:
            break
        key = json.dumps([sub, term], ensure_ascii=False)
        old = cache.execute("SELECT fetched,rows FROM queries WHERE key=?", (key,)).fetchone()
        if old:
            entries.update(json.loads(old[1]))
            if time.time()-old[0] < 1800:
                succeeded += 1
                continue
        params = urlencode(dict(subreddit=sub, title=term, after=int(since.timestamp()),
                                before=int(now.timestamp()), limit=35, sort="desc"))
        try:
            result = archive._search_once(archive.SEARCH_API + "?" + params, min(deadline-8,time.monotonic()+7), retry_422=False)
            if not isinstance(result.get("data"), list):
                continue
            succeeded += 1
            fresh = {}
            for raw in result["data"]:
                if raw.get("over_18") or raw.get("removed_by_category"):
                    continue
                row = archive._normalize_listing_row(raw)
                if re.fullmatch(r"[a-z0-9]+", str(raw.get("id",""))) and row.get("url","").startswith("https://www.reddit.com/r/"):
                    fresh[row["url"]] = dict(row, postId=raw["id"], score=raw.get("score"), num_comments=raw.get("num_comments"))
            entries.update(fresh)
            if fresh:
                with cache:
                    cache.execute("INSERT OR REPLACE INTO queries VALUES (?,?,?)",(key,time.time(),json.dumps(fresh)))
        except Exception:
            continue
    cache.close()
    if not entries:
        subs = list(dict.fromkeys(sub for sub, _ in task["searches"]))
        rows = archive.fetch_listings(subs, depth="quick", from_date=since.date().isoformat(),
                                      to_date=now.date().isoformat(), lane_deadline=deadline)
        for row in rows:
            if row.get("url","").startswith("https://www.reddit.com/r/"):
                entries[row["url"]] = dict(row,postId=row.get("metadata",{}).get("post_id"))
    return dict(ok=bool(succeeded or entries), rows=list(entries.values()))
print(json.dumps(run(json.load(sys.stdin)), ensure_ascii=False))

