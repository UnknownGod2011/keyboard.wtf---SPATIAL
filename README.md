# keyboard.wtf SPATIAL

A spatial Windows workspace for SPECS. See a live desktop in Lens Studio, send a reviewed turn to Jarvis, or pinch-drag a screen region and open the Cursivis result beside it.

## Requirements

- A local Windows desktop session with working graphics drivers and [Lens Studio](https://ar.snap.com/download). The project was built and exercised in Lens Studio **5.24.1**, using **SPECS 27 → Interactive Preview**.
- [Git](https://git-scm.com/install/windows), Git LFS, and [Python for Windows](https://www.python.org/downloads/windows/) with its `py` launcher. The commands below use the tested Python **3.10**. If you installed a newer Python 3 version, use `py -3` in the virtual environment command.
- Install Cursivis and Keyboard.wtf only for their respective features. The live mirror runs without either app or an AI provider key. The Lens includes the Spectacles Interaction Kit and UI Kit packages. CLAD and the Devpost Learn skill pack are authoring tools.

## Start with the live mirror

Run these commands in PowerShell.

```powershell
git lfs install
git clone https://github.com/UnknownGod2011/keyboard.wtf---SPATIAL.git
Set-Location keyboard.wtf---SPATIAL
git lfs pull
py -3.10 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r bridge\requirements.txt
.\.venv\Scripts\python.exe bridge\spatial.py --desktop
```

1. Keep the companion running. Open `Spatial.esproj` in Lens Studio and set Preview to **SPECS 27 → Interactive Preview**.
2. In **Project Settings**, enable **Allow Experimental API** for this local Preview session so it can use loopback HTTP.
3. Select **SPATIAL Workspace** in the hierarchy. Set the script's **Pairing Token** in the Inspector to the `token` value from `%LOCALAPPDATA%\keyboard.wtf SPATIAL\bridge.local.json`. Keep the paired scene and token local. The default endpoint is `http://127.0.0.1:48790`.
4. Wait for **PC • LIVE** and move a window or edit a document to verify the image changes. If the setting or token was cleared when the editor reopened, reapply it and restart Preview.

Full-desktop sharing includes open windows and notifications. Lens Studio itself can appear recursively when it is on a shared display. For a bounded share, use `--share LEFT TOP RIGHT BOTTOM` in place of `--desktop`, with coordinates in Windows desktop pixels. For a safe sample document, run `.\.venv\Scripts\python.exe bridge\demo_document.py` in a second terminal.

## Enable Cursivis and Jarvis

### Cursivis for contextual actions

1. Download and run `CursivisCompanionSetup_1_5_3.exe` from the [Cursivis Companion 1.5.3 release](https://github.com/UnknownGod2011/MX--Cursivis/releases/tag/v1.5.3). Complete its setup, open **Cursivis Settings**, and configure a Gemini provider with your own [Google AI Studio key](https://aistudio.google.com/apikey). Leave the companion running. SPATIAL uses its local AI backend directly, so Logitech hardware is optional.
2. Verify that the local AI service is up. A successful response verifies the service is listening. Run an action on sample content to verify your provider credentials.

```powershell
Invoke-RestMethod http://127.0.0.1:51880/health
```

### Keyboard.wtf for Jarvis

1. Download and run `keyboard-wtf-setup.exe` from the [keyboard.wtf 1.4.22 release](https://github.com/UnknownGod2011/keyboard.wtf/releases/tag/v1.4.22). Launch the app and open **Settings** from its Windows tray icon. Complete any account, provider, or Jarvis access setup required by that build. Check that Jarvis works in the Windows app before connecting it to SPATIAL.
2. Leave Keyboard.wtf running. The bridge uses the protected Jarvis endpoint on its local settings service. Check the address opened by **Settings**. The default is `http://localhost:8090/`. Use that hostname for the Keyboard.wtf check.

```powershell
(Invoke-WebRequest -UseBasicParsing http://localhost:8090/).StatusCode
```

### Restart the SPATIAL companion with the features you want

Stop the current companion with **Ctrl+C**, then run:

```powershell
.\.venv\Scripts\python.exe bridge\spatial.py --desktop --context --jarvis
```

Use `--context` for Cursivis and `--jarvis` for Keyboard.wtf. Omit either flag if you skipped its setup. Use `--cursivis-port` or `--jarvis-port` if a service uses a different port. Add `--microphone` to try SPECS voice transcription when the editor account and microphone permissions are available. Typed Jarvis turns use the same review and Windows action path.

The companion binds to loopback. It pairs with the Lens using the local token, and each external app manages its own provider credentials and permissions. Cursivis receives the text or screen region you share and sends it to its configured provider. Jarvis receives only the turn you review and send. Your Keyboard.wtf action policy still applies.

### Controls

- Drag the frame rail to reposition. Use **−** and **+** for size.
- Copy a text selection in Windows, then pinch **Cursivis**. With no fresh copied text, the Lens freezes the visible desktop for a snip. Pinch and drag a rectangle on the desktop, then release. The companion passes only that crop to Cursivis and the desktop resumes live updates. **×** cancels and **Snip screen** starts another selection.
- Choose a suggested action to see the result beside the desktop. The installed Cursivis backend uses its configured Gemini provider to rank actions for the shared text or image and run the one you choose. The companion automatically retries temporary provider errors with the same selection. If the provider stays busy, **Retry** is available while the selection is still valid. The Lens and companion do not need a copy of the Gemini key.
- Pinch the floating **Jarvis** orb to open its popup beside the live desktop. Speak or type a turn and review it before pressing **Send**. If SPECS transcription cannot sign in, use the typed field or speak to the installed Windows Jarvis directly. Keyboard.wtf handles voice replies and Windows actions through its existing assistant. **Talk again** opens another turn.
- **Settings** shows connection, streaming and permission status. **×** closes the current workflow or exits the workspace.

## Checks and troubleshooting

| Symptom | Check |
| --- | --- |
| **PC • OFFLINE** | Run `Invoke-RestMethod http://127.0.0.1:48790/health`. Check the Inspector token, endpoint and **Allow Experimental API** in Lens Studio. |
| **Cursivis is unavailable** | Check port 51880 and the provider configuration in Cursivis Settings. Use **Retry** if a temporary provider error persists. |
| **Jarvis is unavailable** | Open Keyboard.wtf from the tray. Check its settings address, provider, and Jarvis access. Try **Open Calculator** and follow any confirmation shown by the Windows app. |
| **Voice transcription is unavailable** | Use **Type instead** in the Jarvis popup. |
| **Lens Studio reports GDI Generic** | Check the display adapter in Windows Device Manager and repair its driver before reopening Lens Studio. |

Run the companion test suite with `.\.venv\Scripts\python.exe -m unittest discover -s bridge -v`. The documented live path targets Windows Interactive Preview. Physical SPECS networking and hand tracking remain unverified.

See the [architecture](docs/architecture.md), [Devpost brief](devpost/design-brief.md), [demo script](DEMO_SCRIPT.md), and [submission checklist](SUBMISSION.md).
