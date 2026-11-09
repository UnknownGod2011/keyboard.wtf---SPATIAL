# Progress · 9 November 2026

Build a runnable SPECS workspace where a world-placed Windows view, Jarvis voice and Cursivis share one permission-aware companion. Success requires a real display update, real action, real contextual result, and repeatable Preview evidence.

- [x] Cloned the empty public destination with authenticated write access.
- [x] Retrieved and inspected actual source from the latest private Keyboard.wtf, public Cursivis and older public Keyboard.wtf in temporary read-only reference checkouts.
- [x] Read Devpost rules and official Snap setup/API guidance. Installed the CLAD plugin into Codex and the Devpost plan-lens skill pack into this project.
- [x] Located the official SPECS Base Template and copied its project to Spatial.esproj. The bundled Interaction Kit and UI Kit are present.
- [x] Opened the destination in Lens Studio 5.24.1. The official template compiled in SPECS 27 Interactive Preview. The destination MCP returned its scene and imported assets. It created the Spatial Display material and attached the Spatial script to the saved workspace.
- [ ] Verify a real capture texture round trip in Preview and measure readability and update rate.
- [ ] Verify the wired world-space UI and action controls. The source includes the UI Kit frame and buttons, JPEG polling, ASR with typed fallback, Cursivis action menu, and settings.
- [ ] Exercise Preview, LEAF and actual Windows outcomes. Record and publish an eligible demo.

Windows verification so far:

- The companion returned 325 × 175 JPEG frames on successive authorized requests and rejected missing authorization and a cross-origin request.
- The installed Keyboard.wtf settings service accepted the explicit typed turn “Open Calculator” through the protected Jarvis endpoint. A Calculator process was observed and the Jarvis session was then stopped through its own endpoint. This did not test SPECS ASR.
- Cursivis returned ranked actions through the adapter. A separate direct request to the installed analysis endpoint returned a real Gemini summary of synthetic irrigation text after increasing the timeout. A complete clipboard-to-Lens test remains pending.
- Four companion unit tests passed. They cover opt-in capture and JPEG encoding, route authorization, confirmation, and revision-bound analysis.

Editor notes: opening the template and then the destination initially took several minutes. Both subsequently responded over the authenticated MCP connection. The SPECS developer account is signed out in the editor. The local editor tools and base Preview worked in that state. Online package installation and any publishing remain to be checked.

Submission readiness is pending. There is no recorded demo or verified Lens workflow yet.
