import argparse
import base64
import io
import json
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from PIL import Image

from spatial import BridgeError, Handler, Spatial, ThreadingHTTPServer, local_request


class CompanionTests(unittest.TestCase):
    def setUp(self):
        sequence = patch("spatial.clipboard_sequence", return_value=10)
        self.clipboard_sequence = sequence.start()
        self.addCleanup(sequence.stop)
        self.app = Spatial(argparse.Namespace(
            share=None, desktop=False, context=True, jarvis=True, microphone=False,
            token="test-only", cursivis_port=51880, jarvis_port=8090,
        ))
        self.clipboard_sequence.return_value = 11

    def test_capture_is_opt_in_and_jpeg_contains_captured_pixels(self):
        with self.assertRaisesRegex(BridgeError, "Start the companion"):
            self.app.capture()
        self.app.options.share = (0, 0, 40, 30)
        with patch("spatial.ImageGrab.grab", return_value=Image.new("RGB", (40, 30), (90, 180, 225))) as grab:
            frame = self.app.capture()
        grab.assert_called_once_with(bbox=(0, 0, 40, 30), all_screens=True)
        with Image.open(io.BytesIO(base64.b64decode(frame["jpeg"]))) as image:
            self.assertEqual(image.size, (40, 30))
            self.assertTrue(all(abs(got - want) <= 4 for got, want in zip(image.getpixel((20, 15)), (90, 180, 225))))

    def test_full_desktop_captures_all_displays_without_a_crop(self):
        self.app.options.desktop = True
        with patch("spatial.ImageGrab.grab", return_value=Image.new("RGB", (1920, 1080))) as grab:
            frame = self.app.capture()
        grab.assert_called_once_with(bbox=None, all_screens=True)
        self.assertTrue(self.app.status()["stream"])
        self.assertEqual((frame["width"], frame["height"]), (960, 540))

    def test_revision_bound_analysis_uses_actual_snapshot_and_only_safe_actions(self):
        with patch("spatial.clipboard_text", return_value="A valve opens when the soil dries."):
            selection = self.app.read_selection()
        with self.assertRaisesRegex(BridgeError, "Capture the selection again"):
            self.app.context({"revision": "stale", "action": "summarize"}, suggestions=False)
        with self.assertRaisesRegex(BridgeError, "Choose one"):
            self.app.context({"revision": selection["revision"], "action": "execute"}, suggestions=False)
        with patch("spatial.local_request", return_value=b'{"recommendedAction":"summarize","alternatives":["bullet_points"]}'):
            self.app.context(selection, suggestions=True)
        with patch("spatial.local_request", return_value=b'{"result":"Dry soil opens the valve.","model":"test"}') as upstream:
            result = self.app.context({**selection, "action": "summarize"}, suggestions=False)
        port, path, data = upstream.call_args.args
        self.assertEqual((port, path), (51880, "/analyze"))
        self.assertEqual(data["selection"]["text"], "A valve opens when the soil dries.")
        self.assertEqual(result["result"], "Dry soil opens the valve.")

    def test_suggestions_vary_and_only_offered_text_actions_can_run(self):
        cases = [
            ("def total(items): return sum(items)", "debug_code", "explain_code"),
            ("Hi, can you confirm Friday's meeting?", "draft_reply", "polish_email"),
        ]
        for selected, recommended, alternative in cases:
            with self.subTest(recommended=recommended):
                self.clipboard_sequence.return_value += 1
                with patch("spatial.clipboard_text", return_value=selected):
                    selection = self.app.read_selection()
                offer = json.dumps({
                    "recommendedAction": recommended,
                    "alternatives": ["execute", alternative, recommended],
                    "extendedAlternatives": ["translate"],
                }).encode()
                with patch("spatial.local_request", return_value=offer):
                    result = self.app.context(selection, suggestions=True)
                self.assertEqual(result["actions"], (recommended, alternative, "translate"))
                with self.assertRaisesRegex(BridgeError, "Choose one"):
                    self.app.context({**selection, "action": "summarize"}, suggestions=False)
                with patch("spatial.local_request", return_value=b'{"result":"A real provider result would appear here."}') as upstream:
                    self.app.context({**selection, "action": recommended}, suggestions=False)
                self.assertEqual(upstream.call_args.args[2]["actionHint"], recommended)

    def test_chosen_action_retries_busy_responses_with_the_same_request(self):
        with patch("spatial.clipboard_text", return_value="A valve opens when soil dries."):
            selection = self.app.read_selection()
        with patch("spatial.local_request", return_value=b'{"recommendedAction":"summarize"}'):
            self.app.context(selection, suggestions=True)

        responses = [
            HTTPError("http://localhost", 503, "busy", {"Retry-After": "3"}, None),
            HTTPError("http://localhost", 429, "throttled", {}, None),
            b'{"result":"Dry soil opens the valve."}',
        ]
        with patch("spatial.local_request", side_effect=responses) as upstream, patch("spatial.time.sleep") as sleep:
            result = self.app.context({**selection, "action": "summarize"}, suggestions=False)
        self.assertEqual(result["result"], "Dry soil opens the valve.")
        self.assertEqual([call.args[0] for call in sleep.call_args_list], [3, 4])
        requests = [call.args[1:] for call in upstream.call_args_list]
        self.assertEqual(requests, [requests[0]] * 3)
        self.assertEqual(requests[0][0], "/analyze")
        self.assertEqual(requests[0][1]["actionHint"], "summarize")

    def test_provider_cooldown_and_cleared_selection_stop_retries(self):
        with patch("spatial.clipboard_text", return_value="Selected text."):
            selection = self.app.read_selection()
        busy = HTTPError("http://localhost", 429, "throttled", {"Retry-After": "120"}, None)
        with patch("spatial.local_request", side_effect=busy) as upstream, patch("spatial.time.sleep") as sleep:
            with self.assertRaisesRegex(BridgeError, "provider is busy"):
                self.app.context(selection, suggestions=True)
        upstream.assert_called_once()
        sleep.assert_not_called()

        busy = HTTPError("http://localhost", 503, "busy", {}, None)
        with patch("spatial.local_request", side_effect=busy) as upstream, \
                patch("spatial.time.sleep", side_effect=lambda delay: setattr(self.app, "snapshot", None)):
            with self.assertRaisesRegex(BridgeError, "Capture the selection again"):
                self.app.context(selection, suggestions=True)
        upstream.assert_called_once()

    def test_unchanged_clipboard_uses_region_from_the_exact_displayed_frame(self):
        self.clipboard_sequence.return_value = 10
        with patch("spatial.clipboard_text") as read_text:
            self.assertEqual(self.app.read_selection(), {"needsRegion": True})
        read_text.assert_not_called()

        self.app.options.desktop = True
        original = Image.new("RGB", (80, 40), (20, 110, 200))
        original.paste((200, 40, 20), (0, 0, 40, 40))
        with patch("spatial.ImageGrab.grab", side_effect=[original, Image.new("RGB", (80, 40))]) as grab, \
                patch("spatial.time.monotonic_ns", side_effect=[1_000_000, 2_000_000]):
            frame = self.app.capture()
            self.app.last_frame = 0
            self.app.capture()
            bounds = {"left": 0.625, "top": 0.25, "right": 0.875, "bottom": 0.75}
            selection = self.app.capture_region({**bounds, "sequence": frame["sequence"]})
        self.assertEqual(grab.call_count, 2)
        with self.assertRaisesRegex(BridgeError, "expired"):
            self.app.capture_region({**bounds, "sequence": frame["sequence"] - 100})
        with self.assertRaisesRegex(BridgeError, "within the mirrored"):
            self.app.capture_region({**bounds, "sequence": frame["sequence"], "left": -0.01})
        response = b'{"recommendedAction":"ocr_extract_text","alternatives":["execute","describe_image","summarize"]}'
        busy = HTTPError("http://localhost", 503, "busy", {}, None)
        with patch("spatial.local_request", side_effect=[busy, response]) as upstream, patch("spatial.time.sleep"):
            offered = self.app.context(selection, suggestions=True)
        self.assertEqual(upstream.call_count, 2)
        self.assertEqual(offered["actions"], ("ocr_extract_text", "describe_image"))
        image = upstream.call_args.args[2]["selection"]
        self.assertEqual((image["kind"], image["imageMimeType"]), ("image", "image/png"))
        with Image.open(io.BytesIO(base64.b64decode(image["imageBase64"]))) as decoded:
            self.assertEqual(decoded.size, (20, 20))
            self.assertTrue(all(abs(got - want) <= 4 for got, want in zip(decoded.getpixel((10, 10)), (20, 110, 200))))

    def test_jarvis_requires_confirmation_and_preserves_upstream_token(self):
        with patch("spatial.local_request") as upstream:
            with self.assertRaisesRegex(BridgeError, "confirm"):
                self.app.jarvis({"text": "Open Calculator."})
            with self.assertRaisesRegex(BridgeError, "Enable microphone"):
                self.app.jarvis({"text": "Open Calculator.", "confirmed": True, "input": "voice"})
            upstream.assert_not_called()
        token = "t" * 43
        html = ('const actionToken = "' + token + '"; X-Keyboard-Wtf-Settings-Action').encode()
        with patch("spatial.local_request", side_effect=[html, b'{"ok":true,"accepted":true}']) as upstream:
            result = self.app.jarvis({"text": "Open Calculator.", "confirmed": True, "input": "typed"})
        self.assertTrue(result["accepted"])
        self.assertEqual(upstream.call_args.args, (
            8090, "/api/jarvis/text-turn", {"text": "Open Calculator."},
            {"X-Keyboard-Wtf-Settings-Action": token},
        ))

    def test_http_rejects_unauthenticated_and_browser_origin(self):
        with ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
            server.app = self.app
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                with self.assertRaises(HTTPError) as error:
                    local_request(server.server_port, "/status")
                self.assertEqual(error.exception.code, 401)
                with self.assertRaises(HTTPError) as error:
                    local_request(server.server_port, "/status", headers={
                        "Authorization": "Bearer test-only", "Origin": "https://example.org",
                    })
                self.assertEqual(error.exception.code, 403)
                response = local_request(server.server_port, "/status", headers={"Authorization": "Bearer test-only"})
                self.assertFalse(json.loads(response)["stream"])
            finally:
                server.shutdown()
                worker.join()


if __name__ == "__main__":
    unittest.main()
