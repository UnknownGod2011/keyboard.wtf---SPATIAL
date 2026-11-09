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
        self.app = Spatial(argparse.Namespace(
            share=None, context=True, jarvis=True, microphone=False,
            token="test-only", cursivis_port=51880, jarvis_port=8090,
        ))

    def test_capture_is_opt_in_and_jpeg_contains_captured_pixels(self):
        with self.assertRaisesRegex(BridgeError, "Enable capture"):
            self.app.capture()
        self.app.options.share = (0, 0, 40, 30)
        with patch("spatial.ImageGrab.grab", return_value=Image.new("RGB", (40, 30), (90, 180, 225))) as grab:
            frame = self.app.capture()
        grab.assert_called_once_with(bbox=(0, 0, 40, 30), all_screens=True)
        with Image.open(io.BytesIO(base64.b64decode(frame["jpeg"]))) as image:
            self.assertEqual(image.size, (40, 30))
            self.assertTrue(all(abs(got - want) <= 4 for got, want in zip(image.getpixel((20, 15)), (90, 180, 225))))

    def test_revision_bound_analysis_uses_actual_snapshot_and_only_safe_actions(self):
        with patch("spatial.clipboard_text", return_value="A valve opens when the soil dries."):
            selection = self.app.read_selection()
        with self.assertRaisesRegex(BridgeError, "Capture the selection again"):
            self.app.context({"revision": "stale", "action": "summarize"}, suggestions=False)
        with self.assertRaisesRegex(BridgeError, "Choose Summarize"):
            self.app.context({"revision": selection["revision"], "action": "execute"}, suggestions=False)
        with patch("spatial.local_request", return_value=b'{"result":"Dry soil opens the valve.","model":"test"}') as upstream:
            result = self.app.context({**selection, "action": "summarize"}, suggestions=False)
        port, path, data = upstream.call_args.args
        self.assertEqual((port, path), (51880, "/analyze"))
        self.assertEqual(data["selection"]["text"], "A valve opens when the soil dries.")
        self.assertEqual(result["result"], "Dry soil opens the valve.")

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
