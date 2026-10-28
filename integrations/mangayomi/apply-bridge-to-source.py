#!/usr/bin/env python3
"""Apply Stream Shell's opt-in bridge to a clean Mangayomi checkout.
Fail closed if upstream changes make any insertion ambiguous. No Git mutations.
"""
import pathlib, sys

if len(sys.argv)!=2:
    sys.exit('Usage: python apply-bridge-to-source.py PATH_TO_MANGAYOMI_CHECKOUT')
root=pathlib.Path(sys.argv[1]).resolve()
app=root/'lib/main.dart'
if not app.is_file(): sys.exit('Mangayomi lib/main.dart missing')
s=app.read_text(encoding='utf-8')

def replace_once(before, after):
    global s
    if after in s: return
    n=s.count(before)
    if n!=1: sys.exit(f'Mangayomi upstream mismatch: expected 1 anchor, found {n}: {before[:80]}')
    s=s.replace(before,after,1)

if "import 'package:mangayomi/services/stream_shell_search_bridge.dart';" not in s:
    replace_once("import 'package:mangayomi/services/m_extension_server.dart';",
                 "import 'package:mangayomi/services/m_extension_server.dart';\nimport 'package:mangayomi/services/stream_shell_search_bridge.dart';")
if "import 'package:mangayomi/modules/manga/widgets/manga_image_card_widget.dart';" not in s:
    replace_once("import 'package:mangayomi/services/stream_shell_search_bridge.dart';",
                 "import 'package:mangayomi/services/stream_shell_search_bridge.dart';\nimport 'package:mangayomi/modules/manga/widgets/manga_image_card_widget.dart';")
replace_once("  StreamSubscription<Uri>? _linkSubscription;\n  Uri? lastUri;",
             "  StreamSubscription<Uri>? _linkSubscription;\n  final StreamShellSearchBridge _streamShellBridge = StreamShellSearchBridge();\n  Uri? lastUri;")
# Upgrade the bridge callback already inserted by v0.21.17-v0.21.19.
# Replacing a known, installer-owned block is safe; never modify the user's
# regular Mangayomi app or database. Fail closed if the block is malformed.
if 'onOpenSearch:' in s:
    begin_marker = '    // Optional opt-in loopback service: real searches from installed sources.'
    end_marker = '        ));\n      });\n    }'
    if s.count(begin_marker) != 1 or s.count(end_marker) < 1:
        sys.exit('Existing Stream Shell bridge block changed unexpectedly; cannot upgrade safely')
    begin = s.index(begin_marker)
    end = s.index(end_marker, begin) + len(end_marker)
    s = s[:begin] + s[end:]

replace_once("    _initDeepLinks();\n    _setupMpvConfig();",
             """    _initDeepLinks();
    _setupMpvConfig();
    // Optional opt-in loopback service: real searches from installed sources.
    if (Platform.isWindows) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        unawaited(_streamShellBridge.start(
          sourcesFor: (type) {
            final pinnedOnly = ref.read(onlyIncludePinnedSourceStateProvider);
            final nsfwAllowed = ref.read(showNSFWStateProvider);
            final entries = pinnedOnly
                ? sourceRepository.getPinnedByItemType(type)
                : sourceRepository.getAddedByItemType(type);
            return nsfwAllowed ? entries
                : entries.where((source) => source.isNsfw != true).toList();
          },
          proxyServer: ref.read(androidProxyServerStateProvider),
          onOpenResult: (manga, source) async {
            final context = navigatorKey.currentContext;
            if (context == null || !context.mounted || source.lang == null ||
                source.name == null) {
              throw StateError('Mangayomi detail navigation unavailable');
            }
            // The same internal method as a tapped Global Search cover. No
            // browser URLs, no alternate global search, no fabricated detail.
            pushToMangaReaderDetail(
              ref: ref,
              context: context,
              getManga: manga,
              lang: source.lang!,
              itemType: source.itemType,
              useMaterialRoute: true,
              source: source.name!,
              sourceId: source.id,
            );
          },
        ));
      });
    }""")
replace_once("    _linkSubscription?.cancel();\n    discordRpc?.destroy();",
             "    _linkSubscription?.cancel();\n    unawaited(_streamShellBridge.close());\n    discordRpc?.destroy();")
# Source repository was not imported by stock main.dart's stream-shell main. Add only when needed.
if "import 'package:mangayomi/repositories/source_repository.dart';" not in s:
    replace_once("import 'package:mangayomi/repositories/track_repository.dart';",
                 "import 'package:mangayomi/repositories/track_repository.dart';\nimport 'package:mangayomi/repositories/source_repository.dart';")
# Separate patch for URI: explicit, safe navigation to existing globalSearch route.
case='''        // Stream Shell direct-search URI (opt-in patched build only).
        case "global-search":
          if (uri.scheme != "mangayomi") break;
          final title = uri.queryParameters["query"]?.trim();
          final type = switch (uri.queryParameters["type"]) {
            "anime" => ItemType.anime,
            "manga" => ItemType.manga,
            "novel" => ItemType.novel,
            _ => null,
          };
          if (type == null || title == null || title.isEmpty ||
              title.length > 160 ||
              title.contains(RegExp(r'[\\x00-\\x1F\\x7F]'))) break;
          final context = navigatorKey.currentContext;
          if (context == null || !context.mounted) break;
          context.push('/globalSearch', extra: (title, type));
          break;
'''
if case not in s:
    replace_once('      switch (uri.host) {\n        case "add-repo":',
                 '      switch (uri.host) {\n'+case+'        case "add-repo":')
# Cold-start URI delivery: URI stream is not a substitute for getInitialLink.
# Route all arrivals through the same receiver by adding initial link to the stream listener through a shared handler.
# Reuse existing listener as-is for current warm-window flow; an initial link can be handed off
# after startup by explicitly launching once before search (documented Windows runner limitation).
app.write_text(s,encoding='utf-8')
source=pathlib.Path(__file__).parent/'fork-patches/files/lib/services/stream_shell_search_bridge.dart'
target=root/'lib/services/stream_shell_search_bridge.dart'
if not source.is_file(): sys.exit('Bridge source missing')
# This checkout is already patched on previous Windows builds. The bridge file
# is exclusively owned by this installer and is safe to upgrade in place.
# Never touch unrelated Mangayomi sources or the user's database.
target.parent.mkdir(parents=True, exist_ok=True)
target.write_bytes(source.read_bytes())
print('Applied Stream Shell Mangayomi source bridge to',root)
