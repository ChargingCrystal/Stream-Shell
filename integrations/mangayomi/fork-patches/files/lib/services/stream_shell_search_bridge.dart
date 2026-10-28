// Optional Stream Shell integration. No change to Mangayomi's normal browsing.
// The bridge is OFF unless explicitly enabled by a local Windows user marker.
import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:mangayomi/eval/model/m_pages.dart';
import 'package:mangayomi/eval/model/m_manga.dart';
import 'package:mangayomi/models/manga.dart';
import 'package:mangayomi/models/source.dart';
import 'package:mangayomi/services/isolate_service.dart';

class StreamShellSearchBridge {
  HttpServer? _server;
  File? _discoveryFile;
  String? _secret;
  bool _busy = false;
  // Source-bound opaque IDs; never trust source IDs or arbitrary URLs supplied
  // by the native host. Tokens expire whenever a fresh search begins.
  final Map<String, (Source, MManga)> _recentHits = {};
  DateTime? _searchCompletedAt;


  Future<void> start({
    required List<Source> Function(ItemType) sourcesFor,
    required String proxyServer,
    required Future<void> Function(MManga, Source) onOpenResult,
  }) async {
    if (!Platform.isWindows || _server != null) return;
    final local = Platform.environment['LOCALAPPDATA'];
    if (local == null || local.isEmpty) return;
    final directory = Directory('$local${Platform.pathSeparator}StreamShell');
    final marker = File('${directory.path}${Platform.pathSeparator}mangayomi-bridge.enabled');
    // The opt-in is created only by the user-run installer/activation script.
    if (!await marker.exists()) return;
    final random = Random.secure();
    final secret = base64Url.encode(List<int>.generate(32, (_) => random.nextInt(256)));
    final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0, shared: false);
    _server = server;
    _secret = secret;
    await directory.create(recursive: true);
    final info = File('${directory.path}${Platform.pathSeparator}mangayomi-bridge.json');
    _discoveryFile = info;
    await info.writeAsString(jsonEncode({'version': 1, 'port': server.port,
      'token': secret, 'pid': pid}), flush: true);
    server.listen((request) => unawaited(_handle(request, sourcesFor, proxyServer, onOpenResult)));
  }

  Future<void> close() async {
    await _server?.close(force: true);
    _server = null;
    try { await _discoveryFile?.delete(); } catch (_) {}
    _discoveryFile = null;
    _secret = null;
    _recentHits.clear();
  }

  Future<void> _handle(HttpRequest request,
      List<Source> Function(ItemType) sourcesFor, String proxyServer,
      Future<void> Function(MManga, Source) onOpenResult) async {
    void respond(int status, Map<String, dynamic> body) {
      request.response.statusCode = status;
      request.response.headers.contentType = ContentType.json;
      request.response.write(jsonEncode(body));
    }
    try {
      // No permissive CORS or browser preflight. Opening is restricted to
      // search hits held server-side, never an arbitrary destination URL.
      if (request.method != 'POST' ||
          (request.uri.path != '/v1/search' && request.uri.path != '/v1/open')) {
        respond(HttpStatus.notFound, {'ok': false, 'error': 'not-found'});
        return;
      }
      if (request.headers.value(HttpHeaders.authorizationHeader) != 'Bearer $_secret') {
        respond(HttpStatus.unauthorized, {'ok': false, 'error': 'unauthorized'});
        return;
      }
      if (request.contentLength < 2 || request.contentLength > 4096) {
        respond(HttpStatus.requestEntityTooLarge, {'ok': false, 'error': 'invalid-size'});
        return;
      }
      if (_busy) {
        respond(HttpStatus.tooManyRequests, {'ok': false, 'error': 'busy'});
        return;
      }
      final body = jsonDecode(await utf8.decoder.bind(request).join());
      if (body is! Map<String, dynamic>) {
        respond(HttpStatus.badRequest, {'ok': false, 'error': 'invalid-json'});
        return;
      }
      if (request.uri.path == '/v1/open') {
        final resultId = body['resultId'];
        if (resultId is! String || !RegExp(r'^[A-Za-z0-9_-]{22,40}$').hasMatch(resultId)) {
          respond(HttpStatus.badRequest, {'ok': false, 'error': 'invalid-result-id'});
          return;
        }
        if (_searchCompletedAt == null ||
            DateTime.now().difference(_searchCompletedAt!) > const Duration(minutes: 15)) {
          _recentHits.clear();
          respond(HttpStatus.gone, {'ok': false, 'error': 'search-expired'});
          return;
        }
        final match = _recentHits[resultId];
        if (match == null) {
          respond(HttpStatus.notFound, {'ok': false, 'error': 'result-not-found'});
          return;
        }
        _busy = true;
        try {
          await onOpenResult(match.$2, match.$1);
          respond(HttpStatus.ok, {'ok': true, 'opened': true});
        } finally {
          _busy = false;
        }
        return;
      }
      final query = (body['query'] is String ? body['query'] as String : '').trim();
      final typeName = body['itemType'];
      final type = switch (typeName) {
        'anime' => ItemType.anime,
        'manga' => ItemType.manga,
        'novel' => ItemType.novel,
        _ => null,
      };
      if (type == null || query.isEmpty || query.length > 160 ||
          query.contains(RegExp(r'[\x00-\x1F\x7F]'))) {
        respond(HttpStatus.badRequest, {'ok': false, 'error': 'invalid-query'});
        return;
      }
      _busy = true;
      try {
        _recentHits.clear();
        _searchCompletedAt = null;
        // Honor the app's already-installed and user-filtered source list.
        final all = sourcesFor(type).where((s) => s.id != null &&
            s.isLocal != true && s.name != null).toList();
        const maxSources = 18;
        final selected = all.take(maxSources).toList();
        final responses = <Map<String, dynamic>>[];
        // Same bound as Mangayomi Global Search: no more than 3 evaluations in flight.
        for (int i = 0; i < selected.length; i += 3) {
          final batch = selected.skip(i).take(3);
          responses.addAll(await Future.wait(batch.map((source) =>
              _searchSource(source, query, proxyServer))));
        }
        _searchCompletedAt = DateTime.now();
        // Background-only lookup: do not navigate the Flutter UI.
        respond(HttpStatus.ok, {'ok': true, 'query': query, 'itemType': typeName,
          'sourceCount': all.length, 'scannedCount': selected.length,
          'truncatedSources': all.length > maxSources, 'sources': responses});
      } finally {
        _busy = false;
      }
    } catch (_) {
      // Never return extension stack traces, tokens or local filesystem paths.
      try { respond(HttpStatus.internalServerError,
          {'ok': false, 'error': 'internal-search-error'}); } catch (_) {}
    } finally {
      try { await request.response.close(); } catch (_) {}
    }
  }

  Future<Map<String, dynamic>> _searchSource(Source source, String query,
      String proxyServer) async {
    final id = source.id!;
    final name = (source.name ?? '').substring(0, min(100, source.name!.length));
    final common = <String, dynamic>{'sourceId': id, 'name': name,
      'lang': source.lang ?? '', 'baseUrl': source.baseUrl ?? ''};
    try {
      final page = await getIsolateService.get<MPages?>(
        query: query, page: 1, filterList: const [], source: source,
        proxyServer: proxyServer, serviceType: 'search',
      ).timeout(const Duration(seconds: 18));
      final hits = <Map<String, dynamic>>[];
      for (final m in (page?.list ?? []).take(12)) {
        final title = (m.name ?? '').trim();
        if (title.isEmpty) continue;
        final resultId = base64Url.encode(List<int>.generate(18,
            (_) => Random.secure().nextInt(256))).replaceAll('=', '');
        _recentHits[resultId] = (source, m);
        hits.add({
          'resultId': resultId,
          'title': title.substring(0, min(250, title.length)),
          'url': (m.link ?? '').substring(0, min(1024, (m.link ?? '').length)),
          'imageUrl': (m.imageUrl ?? '').substring(0, min(1024, (m.imageUrl ?? '').length)),
        });
      }
      return {...common, 'status': hits.isEmpty ? 'empty' : 'ok',
        'hits': hits, 'hasNextPage': page?.hasNextPage ?? false};
    } on TimeoutException {
      return {...common, 'status': 'timeout', 'hits': []};
    } catch (_) {
      return {...common, 'status': 'error', 'hits': []};
    }
  }
}
