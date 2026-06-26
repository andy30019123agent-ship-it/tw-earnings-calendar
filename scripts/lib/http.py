"""雙路徑 HTTP 工具：先試 urllib，失敗改用系統 curl。"""
import subprocess
import urllib.request

UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
)


def get_text(url, *, data=None, headers=None, tries=3):
    """先試 urllib，失敗改用系統 curl；皆失敗回 None。data 為 bytes 表 POST。"""
    hdr = {"User-Agent": UA, **(headers or {})}
    for _ in range(tries):
        try:
            req = urllib.request.Request(
                url, data=data, headers=hdr,
                method="POST" if data else "GET",
            )
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:
            pass
        try:
            cmd = ["curl", "-s", "-m", "25", "-A", UA]
            for k, v in (headers or {}).items():
                cmd += ["-H", f"{k}: {v}"]
            if data:
                cmd += ["--data-binary", data.decode("utf-8", "replace")]
            cmd.append(url)
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            if out.returncode == 0 and out.stdout:
                return out.stdout
        except Exception:
            pass
    return None
