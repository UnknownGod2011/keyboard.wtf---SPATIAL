# Progress · 9 November 2026

Build a runnable SPECS workspace where a world-placed Windows view, Jarvis voice and Cursivis share one permission-aware companion. Success requires a real display update, real action, real contextual result, and repeatable Preview evidence.

- [x] Cloned the empty public destination with authenticated write access.
- [x] Retrieved and inspected actual source from the latest private Keyboard.wtf, public Cursivis and older public Keyboard.wtf in temporary read-only reference checkouts.
- [x] Read Devpost rules and official Snap setup/API guidance. Installed the CLAD plugin into Codex and the Devpost plan-lens skill pack into this project.
- [x] Located the official SPECS Base Template and copied its project to Spatial.esproj. The bundled Interaction Kit and UI Kit are present.
- [x] Opened the destination in Lens Studio 5.24.1. The official template compiled in SPECS 27 Interactive Preview. The destination MCP returned its scene and imported assets. It created the Spatial Display material and attached the Spatial script to the saved workspace.
- [x] Verified changing Windows content at the capture boundary using the synthetic demo document. A 614 × 334 capture contained the expected document background and changed after the document heading changed.
- [ ] Verify that those changing pixels arrive as a texture in SPECS Interactive Preview.
- [ ] Verify the wired world-space UI and action controls. The source includes the UI Kit frame and buttons, JPEG polling, ASR with typed fallback, Cursivis action menu, and settings.
- [ ] Exercise Preview, LEAF and actual Windows outcomes. Record and publish an eligible demo.

Windows verification so far:

- The companion returned 325 × 175 JPEG frames on successive authorized requests and rejected missing authorization and a cross-origin request.
- The installed Keyboard.wtf settings service accepted the explicit typed turn “Open Calculator” through the protected Jarvis endpoint. A Calculator process was observed and the Jarvis session was then stopped through its own endpoint. This did not test SPECS ASR.
- Cursivis returned ranked actions through the adapter. A separate direct request to the installed analysis endpoint returned a real Gemini summary of synthetic irrigation text after increasing the timeout. A complete clipboard-to-Lens test remains pending.
- Four companion unit tests passed. They cover opt-in capture and JPEG encoding, route authorization, confirmation, and revision-bound analysis.

Editor notes: opening the template and then the destination initially took several minutes. Both subsequently responded over authenticated MCP. Lens Studio compiled the Spatial TypeScript, then Preview surfaced an early Frame initialization error. The patch moves the controls to the Frame's ready event. Its Preview acceptance remains pending.

The Asset Library returned LEAF 4.0. Installation requested explicit trust for the official LEAF editor plugin. The imported package also references `InteractionKit.lspkg`, while the official 5.23 template ships `SpectaclesInteractionKit.lspkg`. LEAF and its auto-installed dependencies are outside the public milestone. Use a compatible LEAF release or a coordinated kit upgrade in a test copy.

The repeated Cursivis run produced ranked actions, then received HTTP 503 from the installed provider. The Lens now surfaces the busy state and offers Retry without changing the text snapshot. A subsequent request through the companion adapter returned a real Gemini summary of the sensor and valve example.

## Milestones and next checks

- `dc6e082` pushed the official SPECS template, the MCP-created workspace and material, Lens scripts, Windows companion, tests and submission documents to `main`.
- `bridge/demo_document.py` supplies a safe, selectable Windows fixture for the recording.
- First verify the corrected frame in the clean validation copy, then test the local transport and actual pinch input. Capture a clip only after confirming the complete visible workflow.

Submission readiness is pending. There is no recorded demo or verified Lens workflow yet.
