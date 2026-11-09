# keyboard.wtf SPATIAL

A world-placed Windows workspace for SPECS with a live capture companion, a Jarvis voice surface, and Cursivis actions for text and screen regions the user explicitly shares.

## Run locally

1. Open `Spatial.esproj` in Lens Studio 5.24.1 with the SPECS 27 device and Interactive Preview. The project includes the standard Snap SPECS template dependencies. See [progress.md](progress.md) for the current verification status.
2. Install Python and run `python -m pip install -r bridge/requirements.txt`. Start with `python bridge/spatial.py`. The companion binds to Windows loopback on port 48790 and generates `%LOCALAPPDATA%\keyboard.wtf SPATIAL\bridge.local.json`.
3. In a **local project copy**, select **SPATIAL Workspace** and set **Pairing Token** to the value in that JSON file. Keep that scene edit and the token outside Git. In Project Settings, choose **Allow Experimental API** to connect to the local HTTP companion during Preview development.
4. Run `python bridge/spatial.py --desktop --context --jarvis --microphone` to share the entire Windows desktop and enable the two assistants. Use `--share LEFT TOP RIGHT BOTTOM` in place of `--desktop` for a recording with synthetic content. Full-desktop sharing includes open windows and notifications. Preview on a shared display will appear within its own mirror.
5. Use `python -m unittest discover -s bridge -v` to run the companion tests.

Keyboard.wtf and Cursivis are separately installed. The companion defaults to the Keyboard.wtf settings service at port 8090 and the Cursivis backend at port 51880. Use `--jarvis-port` and `--cursivis-port` if the owners are running on different local ports. Their apps manage provider preferences, credentials and action policies.

### Controls

- Drag the frame rail to reposition. Use **−** and **+** for size.
- Copy a text selection in Windows, then pinch **Cursivis**. With no fresh copied text, the Lens freezes the visible desktop for a snip. Pinch and drag a rectangle on the desktop, then release. The companion passes only that crop to Cursivis and the desktop resumes live updates. **×** cancels and **Snip screen** starts another selection.
- Choose a suggested action to see the result beside the desktop. The installed Cursivis backend uses its configured Gemini provider to rank actions for the shared text or image and run the one you choose. The companion automatically retries temporary provider errors with the same selection. If the provider stays busy, **Retry** is available while the selection is still valid. The Lens and companion do not need a copy of the Gemini key.
- Pinch the floating **Jarvis** orb to open its popup beside the live desktop. Speak or type a turn and review it before pressing **Send**. If SPECS transcription cannot sign in, use the typed field or speak to the installed Windows Jarvis directly. Keyboard.wtf handles voice replies and Windows actions through its existing assistant. **Talk again** opens another turn.
- **Settings** shows connection, streaming and permission status. **×** closes the current workflow or exits the workspace.

See the [architecture](docs/architecture.md), [Devpost brief](devpost/design-brief.md), [demo script](DEMO_SCRIPT.md), and [submission checklist](SUBMISSION.md).
