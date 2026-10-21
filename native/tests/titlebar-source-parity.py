#!/usr/bin/env python3
"""Portable source-integrity/contract check for post-v0.20.13 native host.

This deliberately does NOT claim Windows compilation or runtime coverage. It
checks that the PowerShell concatenation input contains all modules and none
of the previously exported functions disappeared during native code cleanup.
"""
from pathlib import Path
import json
import re

base = Path(__file__).resolve().parents[1]
core = (base / 'StreamShellTitlebarHost.cs').read_text(encoding='utf-8')
parts = sorted((base / 'titlebar-src').glob('*.cs'))
assert len(parts) == 19, f'Expected 19 C# source modules, found {len(parts)}'
marker = 'internal static partial class StreamShellTitlebarHost\n{\n'
assert core.count(marker) == 1, 'Core class missing/duplicated'
assert core.endswith('}\n'), 'Core closing brace missing'
source = core
for part in parts:
    text = part.read_text(encoding='utf-8')
    assert text.count(marker) == 1, f'Invalid partial declaration: {part.name}'
    assert text.endswith('}\n'), f'Invalid closing brace: {part.name}'
    source += '\n' + text[text.index(marker):]

names = set(re.findall(
    r'\b(?:public|private|internal)\s+(?:static\s+)?(?:extern\s+)?(?:\w+(?:<[^>]*>)?)\s+([A-Za-z_]\w*)\s*\(',
    source,
))
contract = json.loads((base / 'tests/titlebar-api-contract.json').read_text())['methods']
missing = sorted(set(contract) - names)
assert not missing, f'Lost original v0.20.13 methods: {missing}'
assert source.count('public static int Main(string[] args)') == 1
assert 'SendMessage(hWnd' not in source, 'Unbounded Opera Win32 messaging reintroduced'
assert 'SetWindowText(hWnd' not in source, 'Unbounded Opera caption IPC reintroduced'
for identifier in (
    'SendMessageTimeoutW',
    'SafeSyncOverlays()',
    'WindowProcCore(',
    'IsForeignFullscreenCoveringShell()',
    'LogNativeFailure("native-message", ex)',
    'case "raise-twitch-cluster":',
    'case "provider-buttons":',
    'case "claim":',
    'case "state":',
    'case "heartbeat":',
    '"fullscreenIdleSkips"',
):
    # escaped JSON string in C# may be present instead of literal; guard below
    if identifier == '"fullscreenIdleSkips"':
        assert 'fullscreenIdleSkips' in source
    else:
        assert identifier in source, f'Missing resilience guard: {identifier}'

print(f'PASS native source contract: {len(contract)} original methods retained; 1 core + {len(parts)} modules')
print('PASS bounded cross-process Opera messaging, exception boundaries, fullscreen idle gate')
