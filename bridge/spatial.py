"""Loopback companion for keyboard.wtf SPATIAL."""

import argparse
import base64
import hmac
import io
import json
import os
import re
import secrets
import subprocess
import threading
import time
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import error as url_error, request

from PIL import ImageGrab


ACTIONS = ("summarize", "explain", "rewrite")
CLIP_LIMIT = 20_000
CONFIG = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "keyboard.wtf SPATIAL" / "bridge.local.json"


class BridgeError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def local_request(port, path, data=None, headers=None, timeout=20):
    endpoint = f"http://localhost:{port}{path}"
    head = dict(headers or {})
    body = None
    if data is not None:
        head["Content-Type"] = "application/json"
        body = json.dumps(data).encode("utf-8")
    # Loopback requests may not follow a redirect to another origin.
    class NoRedirect(request.HTTPRedirectHandler):
        def redirect_request(self, *args, **kwargs):
            return None

    opener = request.build_opener(NoRedirect, request.ProxyHandler({}))
    with opener.open(request.Request(endpoint, data=body, headers=head), timeout=timeout) as response:
        return response.read(2 * 1024 * 1024)


def clipboard_text():
    command = "[Console]::OutputEncoding=[Text.UTF8Encoding]::new(); Get-Clipboard -Raw"
    result = subprocess.run(
        ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", command],
        capture_output=True, encoding="utf-8", timeout=4, check=True,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    text = result.stdout.strip()
    if not text or len(text) > CLIP_LIMIT:
        raise BridgeError(f"Copy between 1 and {CLIP_LIMIT:,} characters on Windows first.")
    return text


class Spatial:
    def __init__(self, options):
        self.options = options
        self.lock = threading.Lock()
        self.snapshot = None
        self.last_frame = 0

    def status(self):
        return {
            "connected": True,
            "stream": self.options.share is not None,
            "context": self.options.context,
            "jarvis": self.options.jarvis,
            "microphone": self.options.microphone,
            "confirmation": "Explicit turn confirmation + Keyboard.wtf policy",
        }

    def capture(self):
        if self.options.share is None:
            raise BridgeError("Enable capture on Windows and choose a sharing region.", 403)
        now = time.monotonic()
        with self.lock:
            if now - self.last_frame < 0.18:
                raise BridgeError("Frame rate limited.", 429)
            self.last_frame = now
        frame = ImageGrab.grab(bbox=self.options.share, all_screens=True).convert("RGB")
        frame.thumbnail((960, 540))
        buffer = io.BytesIO()
        frame.save(buffer, format="JPEG", quality=72)
        return {
            "width": frame.width, "height": frame.height,
            "sequence": time.monotonic_ns() // 1_000_000,
            "jpeg": base64.b64encode(buffer.getvalue()).decode("ascii"),
        }

    def read_selection(self):
        if not self.options.context:
            raise BridgeError("Enable contextual actions on Windows.", 403)
        text = clipboard_text()
        with self.lock:
            revision = secrets.token_urlsafe(18)
            self.snapshot = (revision, text, time.monotonic() + 120)
        return {"revision": revision, "characters": len(text), "excerpt": text[:135], "actions": ACTIONS}

    def context(self, payload, suggestions):
        if not self.options.context:
            raise BridgeError("Enable contextual actions on Windows.", 403)
        with self.lock:
            current = self.snapshot
        if current is None or current[0] != payload.get("revision") or current[2] < time.monotonic():
            raise BridgeError("Capture the selection again.", 409)
        action = payload.get("action")
        if not suggestions and action not in ACTIONS:
            raise BridgeError("Choose Summarize, Explain or Rewrite.")
        data = {
            "protocolVersion": "1.0.0", "requestId": str(uuid.uuid4()), "mode": "guided",
            "selection": {"kind": "text", "text": current[1]},
            "context": {"cursorX": 0, "cursorY": 0},
            "timestampUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        if not suggestions:
            data["actionHint"] = action
        try:
            path = "/suggest-actions" if suggestions else "/analyze"
            result = json.loads(local_request(self.options.cursivis_port, path, data, timeout=65))
        except url_error.HTTPError as error:
            if error.code in (429, 503):
                raise BridgeError("Cursivis provider is busy. Try the action again shortly.", 503) from error
            raise BridgeError("Cursivis rejected the request. Check its provider in Windows.", 502) from error
        except (OSError, ValueError) as error:
            raise BridgeError("Cursivis could not complete this request. Check its local service and provider.", 502) from error
        if suggestions:
            ranked = [result.get("recommendedAction"), *result.get("alternatives", []), *ACTIONS]
            return {"actions": list(dict.fromkeys(item for item in ranked if item in ACTIONS))}
        answer = result.get("result")
        if not isinstance(answer, str) or not answer.strip():
            raise BridgeError("Cursivis returned an empty result.", 502)
        return {"result": answer[:4000], "action": result.get("action", action), "model": result.get("model", "")}

    def jarvis(self, payload):
        if not self.options.jarvis:
            raise BridgeError("Enable Jarvis on Windows.", 403)
        text = payload.get("text")
        if payload.get("confirmed") is not True or not isinstance(text, str) or not 1 <= len(text.strip()) <= 400:
            raise BridgeError("Review and confirm a command of up to 400 characters.")
        if payload.get("input") == "voice" and not self.options.microphone:
            raise BridgeError("Enable microphone turns on Windows.", 403)
        try:
            html = local_request(self.options.jarvis_port, "/", timeout=4).decode("utf-8")
            match = re.search(r'const actionToken = "([A-Za-z0-9_-]{43})";', html)
            if not match or "X-Keyboard-Wtf-Settings-Action" not in html:
                raise BridgeError("This Keyboard.wtf build does not offer the protected Jarvis settings endpoint.", 502)
            result = json.loads(local_request(
                self.options.jarvis_port, "/api/jarvis/text-turn", {"text": text.strip()},
                {"X-Keyboard-Wtf-Settings-Action": match.group(1)},
            ))
        except (OSError, ValueError) as error:
            raise BridgeError("Jarvis is unavailable. Check the Keyboard.wtf tray app and its provider.", 502) from error
        if result.get("ok") is not True or result.get("accepted") is not True:
            raise BridgeError("Jarvis declined the turn. Check its Windows overlay.", 502)
        return {"accepted": True, "message": "Sent to Jarvis. Check the Windows overlay for the outcome."}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        self.handle_api()

    def do_POST(self):
        self.handle_api()

    def handle_api(self):
        try:
            result = self.route()
            status = 200
        except BridgeError as error:
            result, status = {"error": str(error)}, error.status
        except (ValueError, subprocess.SubprocessError, OSError):
            result, status = {"error": "The Windows companion could not finish this request."}, 500
        body = json.dumps(result, ensure_ascii=False).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def route(self):
        app = self.server.app
        valid_hosts = (f"localhost:{self.server.server_port}", f"127.0.0.1:{self.server.server_port}")
        if self.headers.get("Host") not in valid_hosts or self.headers.get("Origin"):
            raise BridgeError("Loopback companion requests only.", 403)
        if self.command == "GET" and self.path == "/health":
            return {"service": "keyboard.wtf SPATIAL", "version": 1}
        auth = self.headers.get("Authorization", "").encode("utf-8")
        expected = f"Bearer {app.options.token}".encode("utf-8")
        if not hmac.compare_digest(auth, expected):
            raise BridgeError("Pair with the Windows companion.", 401)
        if self.command == "GET":
            if self.path == "/status":
                return app.status()
            if self.path == "/frame":
                return app.capture()
        if self.command == "POST":
            size = int(self.headers.get("Content-Length", "0"))
            if not 2 <= size <= 4096 or self.headers.get_content_type() != "application/json":
                raise BridgeError("A small JSON object is required.")
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                raise BridgeError("A JSON object is required.")
            if self.path == "/selection":
                return app.read_selection()
            if self.path == "/suggest":
                return app.context(payload, suggestions=True)
            if self.path == "/analyze":
                return app.context(payload, suggestions=False)
            if self.path == "/jarvis":
                return app.jarvis(payload)
            if self.path == "/clear":
                with app.lock:
                    app.snapshot = None
                return {"cleared": True}
        raise BridgeError("Unknown companion route.", 404)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=48790)
    parser.add_argument("--share", nargs=4, type=int, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
    parser.add_argument("--context", action="store_true", help="Allow explicit clipboard capture and Cursivis analysis")
    parser.add_argument("--jarvis", action="store_true", help="Allow confirmed turns to Keyboard.wtf")
    parser.add_argument("--microphone", action="store_true", help="Allow SPECS ASR during Jarvis turns")
    parser.add_argument("--jarvis-port", type=int, default=8090)
    parser.add_argument("--cursivis-port", type=int, default=51880)
    options = parser.parse_args()
    if options.share and not (0 < options.share[2] - options.share[0] <= 7680 and
                              0 < options.share[3] - options.share[1] <= 4320):
        parser.error("--share must name a valid desktop rectangle")
    if CONFIG.exists():
        options.token = json.loads(CONFIG.read_text(encoding="utf-8"))["token"]
    else:
        options.token = secrets.token_urlsafe(32)
        CONFIG.parent.mkdir(parents=True, exist_ok=True)
        with CONFIG.open("x", encoding="utf-8") as file:
            json.dump({"token": options.token}, file)
    with ThreadingHTTPServer(("127.0.0.1", options.port), Handler) as server:
        server.app = Spatial(options)
        print(f"SPATIAL Windows companion on 127.0.0.1:{options.port}", flush=True)
        print(f"Pairing configuration is in {CONFIG}. Ctrl+C stops the companion.", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
