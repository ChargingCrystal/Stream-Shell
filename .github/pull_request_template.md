## Summary

<!-- What changed? Keep this concrete. -->

## Why

<!-- What problem or use case does this solve? -->

## Affected areas

- [ ] Shared shell / Dashboard / Landing
- [ ] YouTube
- [ ] Netflix
- [ ] Prime Video / Amazon
- [ ] Disney+
- [ ] Crunchyroll
- [ ] Twitch
- [ ] Discord integration
- [ ] Native titlebar/helper
- [ ] Volume / fullscreen bridge
- [ ] Display profile / layout
- [ ] Diagnostics / settings
- [ ] Documentation only

## Testing

<!-- What did you actually test? Include display profile/provider where relevant. -->

- [ ] Normal affected workflow tested
- [ ] SPA/navigation behavior tested where relevant
- [ ] Provider Safe Mode checked where relevant
- [ ] Native titlebar behavior checked where relevant
- [ ] No unrelated provider/layout regressions noticed

## Architecture notes

<!-- Mention shared-vs-provider logic, native ownership/trust changes, new permissions, or other non-obvious decisions. -->

## Release / migration impact

- [ ] No app version bump needed (documentation-only)
- [ ] Release note added/updated under `release-notes/`
- [ ] `manifest.json` version updated where appropriate
- [ ] Native helper reinstall is required and documented
- [ ] No native helper reinstall is required

## Final check

- [ ] I did not include credentials, tokens, private account data, or unrelated generated files.
- [ ] The change stays within Stream Shell's personal-project scope rather than expanding compatibility for completeness alone.
