# YouTube visual blocklist

Settings → YouTube → Blocklist → Import JSON list. Each import adds an independent list and enables filtering. Each list can be disabled, deleted, or configured to Blur with a custom label (up to 200 characters), or Remove matching elements. Remove takes priority for overlaps; otherwise the first matching list supplies the blur label. Disabling filters restores marked images and hidden elements. Existing single-list imports migrate automatically to Blur with the original label. Up to 30 lists are supported. The original JSON file is not modified or bundled. Imports are a local snapshot: reimport after editing the file.

Schema: an object containing `channels: [{channelId: "UC…", handle: "@optional", name: "optional"}]`. channelId must be a 24-character YouTube channel ID. Additional top-level sections are ignored. No channel names are used for matching.

Internal extension API: `chrome.runtime.sendMessage({type: "youtube-blocklist-api", action: "get"})` returns `{ok, state}`. Settings may call `import` with `data`, `enable` with `enabled`, `update` with `listId` and `enabled`, `mode` or `text`, or `remove` with `listId` (omit to clear all). Mutations are restricted to the extension dashboard. YouTube content scripts have read-only access. Local storage key: `streamShellYoutubeBlocklistV1`. Open YouTube pages receive local storage changes without polling.

Matching covers supported recommendation, search, playlist, Shorts, owner/avatar, comment and channel-header renderers where channel identity is available. YouTube does not expose usable identity on every surface; unidentified cards remain untouched. Playback is not blocked. MAIN-world code reads only renderer identity and never receives the imported list.

Validation: `node --test background/tests/youtube-blocklist*.test.js`. Optional Chromium DOM test: `node providers/tests/youtube-blocklist.test.cjs` with Playwright installed and CHROMIUM_PATH pointing to Chromium if needed.

## Shorts identity fallback (0.22.31)
Unknown visible Shorts use a bounded direct YouTube request without credentials. Player videoDetails must match the requested video ID. Positive mappings are persisted seven days; negative results ten minutes, up to 500 entries. One shared sequential queue prevents parallel request bursts across windows. Disable the blocklist to stop queued work. No third-party resolver is used.
Research references: https://github.com/varshneydevansh/FilterTube/blob/master/docs/CHANNEL_BLOCKING_SYSTEM.md and https://github.com/iv-org/invidious/blob/master/src/invidious/yt_backend/extractors.cr .
