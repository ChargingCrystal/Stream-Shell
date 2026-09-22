# Stream Shell 0.11.12

## Diagnostics Flight Recorder

- Added a 200-event session ringbuffer in `chrome.storage.session`, surviving MV3 service-worker restarts without becoming permanent history.
- Added an Event Timeline to Diagnostics; UI shows the recent subset while JSON export contains the full ringbuffer.
- Recorded provider open/close/activate, adapter/API start, SPA navigation, watch-context changes, video appear/disappear and the full resume chain.
- Recorded Prime resume control, Netflix MAIN-world bridge command/result/error, provider skip events, Settings changes and self-test transitions.
- Kept titles and URLs out of the recorder.
- Updated `TODO_RULED_OUT.txt` and Settings export version.

**Recovered SHA-256:** `1ae47a0e5358395843233e74ae8f74b9b7568cdcafa1d5eca490f1b9aafca465`

_Recovered from the original Stream Shell development chats / release messages._
