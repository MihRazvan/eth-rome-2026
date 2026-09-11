#!/usr/bin/env python3
"""Read-only publication metadata check; no credentials or full source retention."""
import concurrent.futures, datetime, html, json, re, urllib.request
from pathlib import Path
PAPERS = ["2608.15888", "2608.23858", "2608.21230", "2608.30091", "2608.10509", "2607.29167", "2608.19937", "2608.30177"]
URLS = ["https://arxiv.org/abs/" + p for p in PAPERS] + [
 "https://api.github.com/repos/openclaw/openclaw/pulls/119389",
 "https://api.github.com/repos/TencentCloud/TencentDB-Agent-Memory/releases/tags/v2.0.0"]
def check(url):
    out = {"url": url}
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "EXIT-read-only-research/1.0"})
        with urllib.request.urlopen(req, timeout=25) as response:
            body = response.read(2000000).decode()
            out["status"] = response.status
        if "api.github.com" in url:
            obj = json.loads(body)
            for key in ["html_url", "title", "name", "created_at", "published_at", "merged_at", "merge_commit_sha"]:
                if key in obj: out[key] = obj[key]
        else:
            for key in ["citation_title", "citation_date"]:
                match = re.search(r'<meta name="' + key + r'" content="([^"]+)"', body)
                out[key] = html.unescape(match.group(1)) if match else None
            match = re.search(r'\[Submitted on ([^<]+)', body)
            out["submission_banner"] = match.group(1)[:100] if match else None
    except Exception as exc:
        out["error"] = type(exc).__name__ + ": " + str(exc)[:180]
    return out
if __name__ == "__main__":
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        result = {"observed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(), "scope": "Publication metadata only; papers and application behavior not reproduced", "results": list(pool.map(check, URLS))}
    Path(__file__).with_name("date-observations.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps(result, indent=2))
