"""Loopback companion for keyboard.wtf SPATIAL."""

import argparse
import base64
import ctypes
import hmac
import io
import json
import math
import os
import re
import secrets
import subprocess
import threading
import time
import uuid
from collections import deque
from datetime import datetime, timezone
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib import error as url_error, request

from PIL import Image, ImageGrab


# These Cursivis text actions return content without executing Windows actions.
TEXT_ACTIONS = frozenset({
    "answer_question", "bullet_points", "debug_code", "draft_reply", "expand_text",
    "explain", "explain_code", "extract_insights", "extract_product_info", "improve_code",
    "optimize_code", "optimize_prompt", "polish_email", "rewrite", "rewrite_structured",
    "suggest_captions", "summarize", "translate",
})
IMAGE_ACTIONS = frozenset({
    "describe_image", "extract_dominant_colors", "extract_key_details", "extract_table_data",
    "generate_captions", "identify_objects", "ocr_extract_text",
})
CLIP_LIMIT = 20_000
CONFIG = Path(os.environ.get("LOCALAPPDATA", str(Path.home()))) / "keyboard.wtf SPATIAL" / "bridge.local.json"


class BridgeError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


@dataclass(frozen=True)
class SelectionSnapshot:
    revision: str
    selection: dict
    expires: float
    actions: tuple = ()


def clipboard_sequence():
    return ctypes.windll.user32.GetClipboardSequenceNumber()


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
        self.frames = deque(maxlen=4)
        self.clipboard_baseline = clipboard_sequence() if options.context else 0
        self.last_frame = 0

    def status(self):
        return {
            "connected": True,
            "stream": self.options.desktop or self.options.share is not None,
            "context": self.options.context,
            "jarvis": self.options.jarvis,
            "microphone": self.options.microphone,
            "confirmation": "Explicit turn confirmation + Keyboard.wtf policy",
        }

    def capture(self):
        if not self.options.desktop and self.options.share is None:
            raise BridgeError("Start the companion with --desktop or choose a sharing region.", 403)
        now = time.monotonic()
        with self.lock:
            if now - self.last_frame < 0.18:
                raise BridgeError("Frame rate limited.", 429)
            self.last_frame = now
        frame = ImageGrab.grab(bbox=self.options.share, all_screens=True).convert("RGB")
        frame.thumbnail((960, 540))
        buffer = io.BytesIO()
        frame.save(buffer, format="JPEG", quality=72)
        jpeg = buffer.getvalue()
        sequence = time.monotonic_ns() // 1_000_000
        if self.options.context:
            with self.lock:
                self.frames.append((sequence, time.monotonic() + 60, jpeg))
        return {
            "width": frame.width, "height": frame.height,
            "sequence": sequence,
            "jpeg": base64.b64encode(jpeg).decode("ascii"),
        }

    def read_selection(self):
        if not self.options.context:
            raise BridgeError("Enable contextual actions on Windows.", 403)
        sequence = clipboard_sequence()
        with self.lock:
            fresh = sequence != self.clipboard_baseline
        if not fresh:
            return {"needsRegion": True}
        try:
            text = clipboard_text()
        except BridgeError:
            return {"needsRegion": True}
        if clipboard_sequence() != sequence:
            raise BridgeError("The clipboard changed during capture. Try again.", 409)
        return self.store_selection({"kind": "text", "text": text}, sequence, text[:135])

    def store_selection(self, selection, sequence, excerpt):
        revision = secrets.token_urlsafe(18)
        with self.lock:
            self.snapshot = SelectionSnapshot(revision, selection, time.monotonic() + 120)
            if sequence is not None:
                self.clipboard_baseline = sequence
        return {"revision": revision, "characters": len(selection.get("text", "")), "excerpt": excerpt}

    def capture_region(self, payload):
        if not self.options.context:
            raise BridgeError("Enable contextual actions on Windows.", 403)
        bounds = [payload.get(key) for key in ("left", "top", "right", "bottom")]
        if any(type(value) not in (float, int) or not 0 <= value <= 1 for value in bounds):
            raise BridgeError("Select a rectangle within the mirrored desktop.")
        left, top, right, bottom = bounds
        sequence = payload.get("sequence")
        if type(sequence) is not int:
            raise BridgeError("Select a region on a live desktop frame.")
        with self.lock:
            now = time.monotonic()
            frame = next((jpeg for ident, expires, jpeg in self.frames if ident == sequence and expires > now), None)
        if frame is None:
            raise BridgeError("This frame expired. Draw the region again on the live desktop.", 409)
        buffer = io.BytesIO()
        with Image.open(io.BytesIO(frame)) as image:
            if (right - left) * image.width < 8 or (bottom - top) * image.height < 8:
                raise BridgeError("Draw a larger rectangle on the desktop.")
            box = (math.floor(left * image.width), math.floor(top * image.height),
                   math.ceil(right * image.width), math.ceil(bottom * image.height))
            image.crop(box).save(buffer, format="PNG")
        selection = {
            "kind": "image",
            "imageBase64": base64.b64encode(buffer.getvalue()).decode("ascii"),
            "imageMimeType": "image/png",
        }
        return self.store_selection(selection, None, "Desktop region captured")

    def context(self, payload, suggestions):
        if not self.options.context:
            raise BridgeError("Enable contextual actions on Windows.", 403)
        with self.lock:
            current = self.snapshot
        if current is None or current.revision != payload.get("revision") or current.expires < time.monotonic():
            raise BridgeError("Capture the selection again.", 409)
        action = payload.get("action")
        if not suggestions and action not in current.actions:
            raise BridgeError("Choose one of the actions offered for this selection.")
        data = {
            "protocolVersion": "1.0.0", "requestId": str(uuid.uuid4()), "mode": "guided",
            "selection": current.selection,
            "context": {"cursorX": 0, "cursorY": 0},
            "timestampUtc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        if not suggestions:
            data["actionHint"] = action
        try:
            path = "/suggest-actions" if suggestions else "/analyze"
            try:
                raw = local_request(self.options.cursivis_port, path, data, timeout=65)
            except url_error.HTTPError as error:
                if error.code != 503 or error.headers and error.headers.get("Retry-After"):
                    raise
                error.close()
                time.sleep(1)
                raw = local_request(self.options.cursivis_port, path, data, timeout=65)
            result = json.loads(raw)
        except url_error.HTTPError as error:
            if error.code in (429, 503):
                raise BridgeError("Cursivis provider is busy. Try the action again shortly.", 503) from error
            raise BridgeError("Cursivis rejected the request. Check its provider in Windows.", 502) from error
        except (OSError, ValueError) as error:
            raise BridgeError("Cursivis could not complete this request. Check its local service and provider.", 502) from error
        if suggestions:
            ranked = [result.get("recommendedAction")]
            for key in ("alternatives", "extendedAlternatives"):
                values = result.get(key)
                if isinstance(values, list):
                    ranked.extend(values)
            allowed = IMAGE_ACTIONS if current.selection["kind"] == "image" else TEXT_ACTIONS
            actions = tuple(dict.fromkeys(
                item for item in ranked if isinstance(item, str) and item in allowed
            ))[:3]
            if not actions:
                raise BridgeError("Cursivis offered no supported actions for this selection.", 502)
            with self.lock:
                if self.snapshot is not current or current.expires < time.monotonic():
                    raise BridgeError("Capture the selection again.", 409)
                self.snapshot = SelectionSnapshot(current.revision, current.selection, current.expires, actions)
            return {"actions": actions}
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
            if self.path == "/region":
                return app.capture_region(payload)
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
    capture = parser.add_mutually_exclusive_group()
    capture.add_argument("--desktop", action="store_true", help="Share the entire Windows desktop across displays")
    capture.add_argument("--share", nargs=4, type=int, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
    parser.add_argument("--context", action="store_true", help="Allow explicit text and desktop region capture for Cursivis")
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
