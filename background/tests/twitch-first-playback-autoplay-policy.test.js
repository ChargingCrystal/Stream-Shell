/* v0.20.39: accepted cold-start player mute, NO autoplay/audio workaround.
 * Kept under prior test filename to support unzip-overwrite PATCH upgrades. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const utility=fs.readFileSync(path.join(root,'providers/player/twitch-utility.js'),'utf8');
const workspace=fs.readFileSync(path.join(root,'background/src/05aa-twitch-workspace-v2.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const playerUtility=utility.toLowerCase();
assert.doesNotMatch(utility,/getAutoplayPolicy|userActivation|video-muted|playerAudio|twitchAudioRepair|player-mute-unmute-button/, 'player-side audit/recovery must be fully rolled back');
assert.doesNotMatch(utility,/\.muted\s*=|\.volume\s*=/, 'no Twitch HTMLMediaElement audio mutation');
assert.doesNotMatch(utility,/\.click\(\s*\).*\s*;[\s\S]*?player.*mute/i, 'no auto-Twitch-mute click');
assert.ok(!playerUtility.includes('unmute'), 'rolled-back Twitch early utility should not contain Unmute logic');
assert.match(workspace,/audioMuted\s*!==\s*false/, 'tab-mute state remains stored per-slot');
assert.match(workspace,/chrome\.tabs\.update\(tab\.id,\s*\{\s*muted:\s*desired/, 'tab mute remains owned by the window workspace');
assert.ok((manifest.content_scripts||[]).some(c=>(c.js||[]).includes('providers/player/twitch-utility.js')), 'early Twitch utility remains registered');
console.log('Twitch autoplay policy rollback / tab-mute isolation: PASS');
