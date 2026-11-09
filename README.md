# keyboard.wtf SPATIAL

A world-placed Windows workspace for SPECS with a live capture companion, a Jarvis voice surface, and Cursivis actions for text the user explicitly shares.

## Run locally

1. Open `Spatial.esproj` in Lens Studio 5.24.1 with the SPECS 27 device and Interactive Preview. The project includes the standard Snap SPECS template dependencies. See [progress.md](progress.md) for the current verification status.
2. Install Python and run `python -m pip install -r bridge/requirements.txt`. Start with `python bridge/spatial.py`. The companion binds to Windows loopback on port 48790 and generates `%LOCALAPPDATA%\keyboard.wtf SPATIAL\bridge.local.json`.
3. In a **local project copy**, select **SPATIAL Workspace** and set **Pairing Token** to the value in that JSON file. Keep that scene edit and the token outside Git. Snap documents local HTTP as an Experimental API. This connection is for local Preview development.
4. Restart the companion with `--share LEFT TOP RIGHT BOTTOM` to share one Windows desktop rectangle. Keep that rectangle over a demo document or on a secondary display. `--context` enables explicit clipboard handoff to the local Cursivis backend. `--jarvis` enables confirmed turns to the installed Keyboard.wtf tray app. `--microphone` additionally opts into SPECS speech recognition.
5. Use `python -m unittest discover -s bridge -v` to run the companion tests.

Keyboard.wtf and Cursivis are separately installed. The companion defaults to the Keyboard.wtf settings service at port 8090 and the Cursivis backend at port 51880. Use `--jarvis-port` and `--cursivis-port` if the owners are running on different local ports. Their apps manage provider preferences, credentials and action policies.

### Controls

- Drag the frame rail to reposition. Use **−** and **+** for size.
- Copy a selection in Windows. Pinch **Cursivis**, then choose a read-only action.
- Pinch **Jarvis**, speak or type a turn, and review before pressing **Send**. The Windows overlay reports the outcome and retains its normal controls.
- **Settings** shows connection, streaming and permission status. **×** closes the current workflow or exits the workspace.

See the [architecture](docs/architecture.md), [Devpost brief](devpost/design-brief.md), [demo script](DEMO_SCRIPT.md), and [submission checklist](SUBMISSION.md).
