Stream Shell - Custom provider artwork (v0.20.0)
================================================

Set a Local artwork key in General > Providers (for example: paramount).
Place optional files relative to the unpacked extension root:

  assets/providers/custom/custom_paramount_icon.svg
  assets/providers/custom/custom_paramount_wordmark.svg
  native/titlebar-icons/custom/custom_paramount.png
  assets/backgrounds/custom_paramount_wide.png
  assets/backgrounds/custom_paramount_compact.png

The Dashboard icon and Landing/Dashboard wordmark are SVG-only.
The native titlebar PRIMARY is PNG-only. If it is unavailable, Stream Shell
tries the provider icon SVG (automatically monochrome), then text initials.
Titlebar accent color affects the chrome / active / hover background, not
icon pixels.

The Wide panoramic PNG is shared across the left Landing and right Dashboard.
Compact uses the separate Compact PNG. Missing assets fall back gracefully.
The artwork key must match the file names exactly. Reload the extension after
copying or replacing local files.

All of these image files are user-maintained and omitted from release ZIPs.
Keep local backups when updating or moving to another PC.
For native image details see native/titlebar-icons/custom/README.txt.
