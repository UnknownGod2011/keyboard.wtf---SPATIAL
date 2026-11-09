---
status: approved
---

# Design brief: keyboard.wtf SPATIAL

The project owner's mission brief supplies the product and interaction requirements and delegates implementation decisions. This brief uses the Devpost Learn plan-lens template.

## The one spatial moment

While working on Windows, the wearer sees the active document at their desk and pinches Cursivis beside it. A real explanation appears alongside the source material, in the same physical place, while Jarvis remains within reach for the next action.

## Why it belongs on glasses

- A window sits beside the user's physical workspace and stays there when they turn.
- Hands can stay off the keyboard for confirmed voice turns and choosing contextual actions.
- The source and its explanation are visible together without rearranging Windows.

## Product or overlay

- Overlay over a deliberately shared region of the owner's Windows computer.
- Sense the chosen region and explicitly copied text through a local companion.
- Preview uses the real Windows region and explicit copy handoff. Mouse clicks drive the standard simulated pinch. A typed turn uses the same Jarvis command path if microphone capture is unavailable.

## Where things live

- Main window in the room, 120 cm away and slightly below eye level (default).
- Desktop image 58 cm wide (default). Controls sit along its frame.
- Jarvis orb beside the bottom rail. Selection actions and the result open in a nearby card.

## Hands and input

- Pinch and drag the window rail. Pinch the size controls to adjust the screen.
- Copy text on Windows, then aim and pinch the Cursivis capture control. Aim and pinch one suggestion.
- Pinch the orb, speak, then review and confirm. An explicit typed turn is the Preview fallback.
- Pinch the separate Cancel or Close control to leave the current flow. Settings shows what the Windows companion has enabled.

## When things show

- The workspace appears at startup. The Windows image appears after pairing and opt-in.
- The context menu appears after capture and recedes on dismissal. Results remain until dismissed.
- Jarvis shows a microphone indicator while listening. Closing the turn clears its transcript.

## Done criteria

1. The world-placed display can be moved and resized in Interactive Preview.
2. Changing a shared Windows document visibly updates the floating display.
3. A confirmed Jarvis turn causes a verifiable action on Windows.
4. A copied Windows selection followed by a Cursivis pinch shows suggestions and the chosen action returns actual analysis.
5. Settings shows connection and consent. Cancel exits a workflow.

## Out of scope

- Hardware qualification and persistent room mapping across visits.
- General pointer injection during Preview. The simulator and Windows share the same physical mouse.

## Risks and open questions

- Local HTTP needs verification inside SPECS 27 Preview. TLS pairing and device testing are separate gates.
- Optical contrast and actual hand tracking need a physical device.
- Audio through Lens Preview and feedback from the installed Jarvis application need separate validation.


## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
