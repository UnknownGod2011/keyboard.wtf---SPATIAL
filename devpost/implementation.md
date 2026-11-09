# SPATIAL implementation and validation

This supplement records decisions made after the original [plan-lens design brief](design-brief.md). The [official skill pack](https://github.com/challengepost/learn-specs) defines the brief format. The [setup guide](../README.md) is the runnable starting point.

## Design intent

SPATIAL gives someone working at a desk a live Windows surface they can place in their field of view. The reference moment begins with a document on the mirror. The user marks the relevant passage or visual region, chooses an action, and reads the result beside the source. Jarvis has a separate, recognizable orb so the user can deliberately switch from reading to sending a command. The user can close either workflow to return to the desktop.

The source and result share a position in the workspace. This lets the user compare an explanation or extracted table against the original without covering the desktop or switching Windows applications. The rail moves the whole workspace, while resizing changes the display footprint. Placement, scale, and contrast are design targets that still need checks on physical glasses.

## Interaction and state

| Surface | Entry and action | Completion and recovery |
| --- | --- | --- |
| Desktop | Pair the bridge, then drag the rail or use the size controls. | PC LIVE indicates that the Lens has received a frame. If offline, check the bridge, Inspector token and Experimental API. |
| Cursivis | Pinch its dock control. Fresh copied text is used directly. Otherwise pinch, drag and release on the frozen mirror to select a region. | Suggestions appear beside the mirror. Choosing one sends a read-only action for that selection. Retry reuses a valid selection. The close control exits the workflow. |
| Jarvis | Pinch the orb. Use transcription where available or select Type instead. Review the turn before sending. | The Lens shows the submission outcome. Verify completion on Windows and follow the Windows assistant's action policy. Talk again starts another turn. |
| Settings | Open from the dock to inspect connection and opt-in status. | Provider credentials and action policy are configured in the Windows apps. |

## How the build evolved

1. **Prove the transport.** A local Windows companion sent a synthetic document crop to Interactive Preview. Editing the document changed the displayed pixels. Experimental API was required for loopback HTTP.
2. **Keep the source in view.** The full desktop became an opt-in capture mode. The Jarvis popup and Cursivis cards sit alongside the mirror, which resumes live updates after region selection.
3. **Move selection into the Lens.** The early Windows Snipping Tool handoff required leaving Preview. The Lens now freezes the displayed frame and draws an outline as the user drags. The bridge crops that exact retained frame using normalized bounds. That prevents a later desktop frame from changing the selected content.
4. **Handle busy providers.** Cursivis suggestions are ranked for each selection. The companion retries temporary 429 and 503 responses with bounded backoff and honors provider cooldowns. A manual Retry remains available while the selection is valid.
5. **Keep the recording path separate.** The built-in recorder attempt ended when Preview failed to allocate an image under Windows memory pressure. The cause of the memory growth is unresolved. The external window-capture path captures the visible editor workflow without using the built-in recorder.

## Verification by acceptance criterion

| Criterion | Reproduction check | Evidence and limits |
| --- | --- | --- |
| Move and resize | In SPECS 27 Interactive Preview, drag the rail, then pinch the size controls. Check the dock remains aligned. | The controls are implemented. Physical placement, optics and hand tracking remain unverified. |
| Live desktop | Start the bridge, pair Preview, and edit the synthetic document. | Preview received live Windows frames and displayed a document edit. A fresh public clone produced an authenticated 960 × 540 frame. |
| Reviewed Jarvis turn | Select Type instead, enter Open Calculator, review, send and observe Windows. | A typed bridge turn opened Calculator. SPECS transcription was blocked by editor sign-in and remains unverified. |
| Contextual result | Snip a region or copy sample text, choose a suggestion and compare the answer with the source. | The owner confirmed the Preview snip workflow. A synthetic table crop passed through real Gemini ranking and returned the expected values. The test suite also checks selection identity, bounds and transient retries. |
| Status and cancellation | Inspect Settings with the bridge running. Enter a workflow and use the close control to return. | Connection and opt-in states are exposed. Automated Preview coverage remains incomplete. |

Run `python -m unittest discover -s bridge -v` from the project root with the bridge dependencies installed. The automated Preview attempt imported test packages whose Interaction Kit and UI Kit dependencies did not match the template. Those packages were isolated to restore compilation. The manual Preview evidence and bridge tests are separate from LEAF, and no LEAF pass is claimed.

## Ownership, privacy and scope

The new work includes the Lens, spatial UI and snip interaction, Python bridge, tests and setup documentation. The official SPECS template and interaction packages supply the Lens foundation. Keyboard.wtf and Cursivis are existing, separately installed Windows apps. Keyboard.wtf owns Jarvis, speech and Windows permissions. Cursivis owns provider credentials, ranking and analysis.

The bridge listens on Windows loopback and requires a local pairing token for private requests. Desktop sharing is explicit. A full desktop share can reveal other windows and notifications. For a narrow recording or check, share a region containing the included synthetic document. A Cursivis action sends only the chosen text or crop to its configured provider. A Jarvis action sends the reviewed turn. Credentials, local pairing and private companion source stay outside the public project.

The supported reproduction target is Lens Studio 5.24.1 on Windows in SPECS 27 Interactive Preview. A physical-device path would require a secure transport, device pairing, and separate checks of comfort, legibility and input.
