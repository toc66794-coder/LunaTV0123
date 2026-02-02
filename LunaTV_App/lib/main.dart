import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'dart:io';
import 'package:shelf/shelf.dart';
import 'package:shelf/shelf_io.dart' as io;
import 'package:shelf_router/shelf_router.dart';
import 'package:http/http.dart' as http;

// --- 配置中心 ---
class AppConfig {
  static String baseUrl = 'http://10.0.2.2:3000'; 
  static int proxyPort = 0; 
}

// --- 本地代理伺服器 (解決去廣告與盜連問題) ---
class LocalProxy {
  static Future<int> start() async {
    final router = Router();

    router.get('/m3u8', (Request request) async {
      final url = request.url.queryParameters['url'];
      if (url == null) return Response.notFound('Missing url');

      try {
        final response = await http.get(Uri.parse(url));
        if (response.statusCode != 200) {
          return Response(response.statusCode, body: response.body);
        }

        // 過濾廣告
        String content = response.body;
        final filteredLines = content.split('\n')
            .where((line) => !line.contains('#EXT-X-DISCONTINUITY'))
            .toList();
        content = filteredLines.join('\n');

        return Response.ok(content, headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
        });
      } catch (e) {
        return Response.internalServerError(body: e.toString());
      }
    });

    // 啟動於隨機可用連接埠
    final server = await io.serve(router, InternetAddress.loopbackIPv4, 0);
    AppConfig.proxyPort = server.port;
    debugPrint('本地代理啟動於: http://localhost:${server.port}');
    return server.port;
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await LocalProxy.start();
  runApp(const LunaTVApp());
}

class LunaTVApp extends StatelessWidget {
  const LunaTVApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LunaTV Prototype',
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F0F0F),
        primaryColor: Colors.blueAccent,
        useMaterial3: true,
        textTheme: GoogleFonts.interTextTheme(
          ThemeData.dark().textTheme,
        ),
      ),
      home: const HomePage(),
    );
  }
}

// --- 首頁：影片列表 ---
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final Dio _dio = Dio();
  List<dynamic> _items = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchHotMovies();
  }

  Future<void> _fetchHotMovies() async {
    try {
      final url = '${AppConfig.baseUrl}/api/douban/categories?kind=movie&category=热门電影&type=movie&limit=20&start=0';
      final response = await _dio.get(url);

      if (response.statusCode == 200 && response.data['list'] != null) {
        setState(() {
          _items = response.data['list'];
          _isLoading = false;
        });
      } else {
        throw Exception('Failed to load data');
      }
    } catch (e) {
      debugPrint('Fetch Error: $e');
      setState(() {
        _error = '連線失敗，請檢查 $ {AppConfig.baseUrl} 是否正確且 Server 已啟動\n$e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('LunaTV 🔥'),
        backgroundColor: Colors.transparent,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () {
              _showSettingsDialog();
            },
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildErrorView()
              : GridView.builder(
                  padding: const EdgeInsets.all(16),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    childAspectRatio: 0.7,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: _items.length,
                  itemBuilder: (context, index) {
                    final item = _items[index];
                    return InkWell(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => DetailPage(item: item),
                          ),
                        );
                      },
                      child: _buildCard(item),
                    );
                  },
                ),
    );
  }

  void _showSettingsDialog() {
    final controller = TextEditingController(text: AppConfig.baseUrl);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('伺服器設定'),
        content: TextField(
          controller: controller,
          decoration: const InputDecoration(labelText: 'Backend Base URL'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() {
                AppConfig.baseUrl = controller.text;
                _isLoading = true;
              });
              Navigator.pop(context);
              _fetchHotMovies();
            },
            child: const Text('儲存並重新整理'),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            Text(_error!, textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                setState(() {
                  _isLoading = true;
                  _error = null;
                });
                _fetchHotMovies();
              },
              child: const Text('點擊重試'),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildCard(dynamic item) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.grey[900],
            ),
            clipBehavior: Clip.antiAlias,
            child: CachedNetworkImage(
              imageUrl: item['poster'],
              fit: BoxFit.cover,
              errorWidget: (context, url, error) => const Icon(Icons.broken_image),
            ),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          item['title'] ?? '',
          maxLines: 1,
          style: const TextStyle(fontSize: 12, overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }
}

// --- 詳情頁：影片資訊與搜尋播放源 ---
class DetailPage extends StatefulWidget {
  final dynamic item;
  const DetailPage({super.key, required this.item});

  @override
  State<DetailPage> createState() => _DetailPageState();
}

class _DetailPageState extends State<DetailPage> {
  final Dio _dio = Dio();
  bool _isSearching = false;

  Future<void> _handleStartPlay() async {
    setState(() => _isSearching = true);
    
    try {
      final title = widget.item['title'];
      debugPrint('正在搜尋：$title');
      
      // 1. 搜尋源
      final searchUrl = '${AppConfig.baseUrl}/api/search?q=$ {Uri.encodeComponent(title)}';
      final searchRes = await _dio.get(searchUrl);
      
      final List results = searchRes.data['results'] ?? [];
      if (results.isEmpty) throw Exception('找不到播放源');
      
      // 2. 獲取第一個匹配的詳情 (簡化邏輯)
      final bestMatch = results.first;
      final detailUrl = '${AppConfig.baseUrl}/api/detail?source=${bestMatch['source']}&id=${bestMatch['id']}';
      final detailRes = await _dio.get(detailUrl);
      
      final episodes = detailRes.data['episodes'] as List?;
      if (episodes == null || episodes.isEmpty) throw Exception('該源無可播放集數');
      
      final String playUrl = episodes.first;
      debugPrint('獲取播放地址：$playUrl');
      
      if (!mounted) return;
      
      // 3. 進入播放器
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => VideoPlayerPage(
            title: title,
            url: playUrl,
          ),
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('播放失敗: $ {e.toString()}')),
      );
    } finally {
      if (mounted) setState(() => _isSearching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 400,
            flexibleSpace: FlexibleSpaceBar(
              background: CachedNetworkImage(
                imageUrl: item['poster'],
                fit: BoxFit.cover,
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item['title'] ?? '', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  Text('豆瓣評分: $ {item['rate'] ?? "N/A"}', style: const TextStyle(color: Colors.amber)),
                  const SizedBox(height: 30),
                  SizedBox(
                    width: double.infinity,
                    height: 50,
                    child: ElevatedButton.icon(
                      onPressed: _isSearching ? null : _handleStartPlay,
                      icon: _isSearching 
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Icon(Icons.play_arrow),
                      label: Text(_isSearching ? '正在搜尋播放源...' : '立即播放 (原生 HLS)'),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.blueAccent),
                    ),
                  ),
                ],
              ),
            ),
          )
        ],
      ),
    );
  }
}

// --- 播放頁面：原生播放器 (HLS 支援) ---
class VideoPlayerPage extends StatefulWidget {
  final String title;
  final String url;
  const VideoPlayerPage({super.key, required this.title, required this.url});

  @override
  State<VideoPlayerPage> createState() => _VideoPlayerPageState();
}

class _VideoPlayerPageState extends State<VideoPlayerPage> {
  late VideoPlayerController _videoPlayerController;
  ChewieController? _chewieController;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  Future<void> _initializePlayer() async {
    String videoUrl = widget.url;
    
    // 如果是 m3u8，則使用本地代理進行去廣告過濾
    if (videoUrl.contains('.m3u8')) {
      videoUrl = 'http://localhost:${AppConfig.proxyPort}/m3u8?url=${Uri.encodeComponent(videoUrl)}';
      debugPrint('使用代理播放: $videoUrl');
    }

    _videoPlayerController = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
    await _videoPlayerController.initialize();

    _chewieController = ChewieController(
      videoPlayerController: _videoPlayerController,
      autoPlay: true,
      looping: false,
      aspectRatio: _videoPlayerController.value.aspectRatio,
      optionsTranslation: OptionsTranslation(
        playbackSpeedButtonText: '速度',
        subtitlesButtonText: '字幕',
        cancelButtonText: '取消',
      ),
    );
    setState(() {});
  }

  @override
  void dispose() {
    _videoPlayerController.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      backgroundColor: Colors.black,
      body: Center(
        child: _chewieController != null && _chewieController!.videoPlayerController.value.isInitialized
            ? Chewie(controller: _chewieController!)
            : const Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 20),
                  Text('正在緩衝 HLS 串流...'),
                ],
              ),
      ),
    );
  }
}
