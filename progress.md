# Progress · 9 November 2026

Build a runnable SPECS workspace where a world-placed Windows view, Jarvis voice and Cursivis share one permission-aware companion. Success requires a real display update, real action, real contextual result, and repeatable Preview evidence.

- [x] Cloned the empty public destination with authenticated write access.
- [x] Retrieved and inspected actual source from the latest private Keyboard.wtf, public Cursivis and older public Keyboard.wtf in temporary read-only reference checkouts.
- [x] Read Devpost rules and official Snap setup/API guidance. Installed the CLAD plugin into Codex and the Devpost plan-lens skill pack into this project.
- [x] Located the official SPECS Base Template and copied its project to Spatial.esproj. The bundled Interaction Kit and UI Kit are present.
- [x] Opened the destination in Lens Studio 5.24.1. The official template compiled in SPECS 27 Interactive Preview. The destination MCP returned its scene and imported assets. It created the Spatial Display material and attached the Spatial script to the saved workspace.
- [x] Verified changing Windows content at the capture boundary using the synthetic demo document. A 614 × 334 capture contained the expected document background and changed after the document heading changed.
- [x] Verified the synthetic Windows document in SPECS Interactive Preview after the owner enabled Experimental API. An edit made in Windows appeared in Preview with the PC LIVE indicator. Evidence is in the local synthetic capture `.artifacts/spatial-live-mirror.png`.
- [x] Added the requested whole-desktop mode. A Windows smoke test captured the full 1920 × 1080 virtual desktop and encoded a 960 × 540 frame without saving desktop pixels. All five companion tests passed. The explicit crop remains available for recordings.
- [ ] Verify the full-desktop stream in Preview. The paired live Preview evidence covers a synthetic crop. Full-desktop polling was deferred after the Windows restart.
- [ ] Verify the wired world-space UI and action controls. The source includes the UI Kit frame and buttons, JPEG polling, ASR with typed fallback, Cursivis action menu, and settings.
- [x] Added a Jarvis popup beside the desktop texture and kept desktop polling active during a Jarvis turn. Review, Send, and Talk again use the protected Keyboard.wtf bridge. Added a Cursivis popup that renders the ranked read-only actions returned for the copied text and shows the selected result.
- [ ] Verify that speaking “open Chrome” in the Jarvis popup opens Chrome on Windows and that it becomes visible in the full-desktop mirror. The protected bridge returns an acceptance receipt. Voice replies remain on the Windows assistant.
- [x] Paired the open Preview through MCP. The first assisted attempt hit the experimental loopback HTTP gate. The updated Lens later logged workspace startup at 15:15:06 IST and a live Windows texture at 15:15:08 IST. Full-desktop mode is running. Visual confirmation of the full desktop is still pending.
- [x] Added a floating animated Jarvis orb and a typed fallback that explains the SPECS transcription sign-in error. The orb asset imported and the updated scripts initialized in Preview. The editor authorization interface reported signed out. The owner reported a red error immediately after requesting an email sign-in code, with the precise message and cause still unknown.
- [x] Added Windows Snipping Tool fallback for Cursivis when there is no fresh copied text. A separate manual snip action is available. The Lens waits for an explicitly copied image and displays context-specific Gemini suggestions and results through the existing Cursivis installation.
- [ ] Exercise Preview, LEAF and actual Windows outcomes. Record and publish an eligible demo.

Windows verification so far:

- The companion returned 325 × 175 JPEG frames on successive authorized requests and rejected missing authorization and a cross-origin request.
- The installed Keyboard.wtf settings service accepted the explicit typed turn “Open Calculator” through the protected Jarvis endpoint. A Calculator process was observed and the Jarvis session was then stopped through its own endpoint. This did not test SPECS ASR.
- Cursivis returned ranked actions through the adapter. A separate direct request to the installed analysis endpoint returned a real Gemini summary of synthetic irrigation text after increasing the timeout. A complete clipboard-to-Lens test remains pending.
- Four companion unit tests passed. They cover opt-in capture and JPEG encoding, route authorization, confirmation, and revision-bound analysis.
- The current suite passed six tests. Mocked provider responses produced distinct code and email actions and the bridge rejected unoffered actions. Lens Studio compiled the revised popup and action UI, then logged `SPATIAL workspace ready` at 14:53 IST. Live popup activation, voice and dynamically ranked results remain open in Preview.
- The revised suite passed seven tests, including rejecting stale clipboard content and passing a fresh image through suggestions and analysis. Windows launched Snipping Tool. A synthetic image fed into the clipboard adapter reached the real installed Gemini provider, which ranked Extract Table Data, OCR and Extract Key Details. The selected table action returned Monday 18 L, Tuesday 12 L and Wednesday 10 L. The actual Windows capture and gesture-to-popup path still need a joint Preview test.

Editor notes: both the template and the destination responded over authenticated MCP after startup. After fixing early Frame initialization, Lens Studio compiled the Spatial TypeScript and the Preview logged `SPATIAL workspace ready` twice after reset. The live workspace showed the desktop title, connection indicator, message and action dock. A paired request progressed from a native Request argument error to Snap's experimental HTTP gate after correcting the request options.

The Asset Library returned LEAF 4.0. Installation requested explicit trust for the official LEAF editor plugin. The imported package also references `InteractionKit.lspkg`, while the official 5.23 template ships `SpectaclesInteractionKit.lspkg`. After isolating those test dependencies, application compilation and Preview resumed. The official LEAF 2.0.2 package manifest declares `SpectaclesInteractionKit` 2.0.0. Installation and scenario execution for that compatible release are pending.

The repeated Cursivis run produced ranked actions, then received HTTP 503 from the installed provider. The Lens now surfaces the busy state and offers Retry without changing the text snapshot. A subsequent request through the companion adapter returned a real Gemini summary of the sensor and valve example.

## Milestones and next checks

- `dc6e082` pushed the official SPECS template, the MCP-created workspace and material, Lens scripts, Windows companion, tests and submission documents to `main`.
- `bridge/demo_document.py` supplies a safe, selectable Windows fixture for the recording.
- `1145701` adds the synthetic Windows fixture and provider busy/retry handling.
- `c96cb98` was compiled and rendered in the editor. The local evidence image `.artifacts/spatial-preview.png` shows the unpaired workspace with its full control labels. It also shows an uneven frame render across the Preview, which still needs visual QA.
- While testing the dock in Preview, Windows restarted and logged graphics-kernel bug check `0x00000113`. The exact cause has not been established. Reopened a single Lens Studio instance and confirmed it responded with `Spatial.esproj` open. The Lens now caps capture requests at two per second, and live streaming should be retested in short steps. Cursivis was unavailable immediately after reboot.
- Resolve the SPECS sign-in problem and test Jarvis voice in Preview. Test pinch input and a real synthetic Windows snip through the Cursivis popup before recording the integrated demo.

Submission readiness is pending. There is no recorded demo or verified Lens workflow yet.
