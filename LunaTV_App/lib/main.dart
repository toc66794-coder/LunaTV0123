import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'dart:io';
import 'package:shelf/shelf.dart' as shelf;
import 'package:shelf/shelf_io.dart' as shelf_io;
import 'package:shelf_router/shelf_router.dart' as shelf_router;
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'dart:async';

// --- 配置中心 ---
class AppConfig {
  // 請修改為您的 Vercel 部署網址，例如 https://lunatv0123.vercel.app
  static String baseUrl = 'https://lunatv0123.vercel.app'; 
  static int proxyPort = 0; 
}

// --- 本地代理伺服器 (解決去廣告與盜連問題) ---
class LocalProxy {
  static Future<int> start() async {
    final router = shelf_router.Router();

    router.get('/m3u8', (shelf.Request request) async {
      final url = request.url.queryParameters['url'];
      if (url == null) return shelf.Response.notFound('Missing url');

      try {
        final response = await http.get(Uri.parse(url));
        if (response.statusCode != 200) {
          return shelf.Response(response.statusCode, body: response.body);
        }

        // 過濾廣告
        String content = response.body;
        final filteredLines = content.split('\n')
            .where((line) => !line.contains('#EXT-X-DISCONTINUITY'))
            .toList();
        content = filteredLines.join('\n');

        return shelf.Response.ok(content, headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
        });
      } catch (e) {
        return shelf.Response.internalServerError(body: e.toString());
      }
    });

    // 啟動於隨機可用連接埠
    final server = await shelf_io.serve(router, InternetAddress.loopbackIPv4, 0);
    AppConfig.proxyPort = server.port;
    debugPrint('本地代理啟動於: http://localhost:${server.port}');
    return server.port;
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    // 嘗試啟動代理，若失敗仍進入主程式
    await LocalProxy.start().timeout(const Duration(seconds: 3));
  } catch (e) {
    debugPrint('LocalProxy Start Failed: $e');
  }
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
        _error = '連線失敗，請檢查 ${AppConfig.baseUrl} 是否正確且 Server 已啟動\n$e';
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
      final searchUrl = '${AppConfig.baseUrl}/api/search?q=${Uri.encodeComponent(title)}';
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
        SnackBar(content: Text('播放失敗: ${e.toString()}')),
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
                  Text('豆瓣評分: ${item['rate'] ?? "N/A"}', style: const TextStyle(color: Colors.amber)),
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
  
  // --- 狀態控制 ---
  bool _showControls = true;
  Timer? _hideTimer;
  bool _isLongPressing = false;
  double _lastSpeed = 1.0;
  String _noticeText = '';
  Timer? _noticeTimer;

  // --- 進度拖動狀態 ---
  bool _isDraggingHorizontal = false;
  Duration _dragSeekTarget = Duration.zero;
  Duration _dragSeekStart = Duration.zero;

  @override
  void initState() {
    super.initState();
    _initializePlayer();
    _startHideTimer();
  }

  void _startHideTimer() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _showControls = false);
    });
  }

  void _toggleControls() {
    setState(() {
      _showControls = !_showControls;
      if (_showControls) _startHideTimer();
    });
  }

  void _showNotice(String text) {
    _noticeTimer?.cancel();
    setState(() => _noticeText = text);
    _noticeTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _noticeText = '');
    });
  }

  Future<void> _initializePlayer() async {
    String videoUrl = widget.url;
    if (videoUrl.contains('.m3u8')) {
      videoUrl = 'http://localhost:${AppConfig.proxyPort}/m3u8?url=${Uri.encodeComponent(videoUrl)}';
    }

    _videoPlayerController = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
    await _videoPlayerController.initialize();

    _chewieController = ChewieController(
      videoPlayerController: _videoPlayerController,
      autoPlay: true,
      looping: false,
      showControls: false, // 我們使用自定義疊層
      aspectRatio: _videoPlayerController.value.aspectRatio,
    );
    setState(() {});
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    _noticeTimer?.cancel();
    _videoPlayerController.dispose();
    _chewieController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final String currentTime = DateFormat('HH:mm').format(DateTime.now());

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _toggleControls,
        onDoubleTap: () {
          if (_videoPlayerController.value.isPlaying) {
            _videoPlayerController.pause();
            _showNotice('⏸ 暫停');
          } else {
            _videoPlayerController.play();
            _showNotice('▶️ 播放');
          }
        },
        onLongPressStart: (_) {
          _lastSpeed = _videoPlayerController.value.playbackSpeed;
          _videoPlayerController.setPlaybackSpeed(3.0);
          setState(() => _isLongPressing = true);
          _showNotice('🚀 3x 速播放中');
        },
        onLongPressEnd: (_) {
          _videoPlayerController.setPlaybackSpeed(_lastSpeed);
          setState(() => _isLongPressing = false);
          _showNotice('恢復速度: ${_lastSpeed}x');
        },
        onVerticalDragUpdate: (details) {
          final screenWidth = MediaQuery.of(context).size.width;
          if (details.globalPosition.dx < screenWidth / 2) {
            // 左側：亮度 (暫時模擬或提示，原生需 plugin)
            _showNotice('☀️ 亮度調節 (開發中)');
          } else {
            // 右側：音量
            double newVolume = _videoPlayerController.value.volume - (details.delta.dy / 100);
            newVolume = newVolume.clamp(0.0, 1.0);
            _videoPlayerController.setVolume(newVolume);
            _showNotice('🔊 音量: ${(newVolume * 100).round()}%');
          }
        },
        onHorizontalDragStart: (details) {
          _dragSeekStart = _videoPlayerController.value.position;
          _dragSeekTarget = _dragSeekStart;
          setState(() => _isDraggingHorizontal = true);
        },
        onHorizontalDragUpdate: (details) {
          final screenWidth = MediaQuery.of(context).size.width;
          // 根據拖動位移計算秒數 (比例：全螢幕寬度對應 2 分鐘，或根據影片長度調整)
          final double seekSeconds = (details.primaryDelta! / screenWidth) * 120; // 120秒
          setState(() {
            _dragSeekTarget += Duration(milliseconds: (seekSeconds * 1000).toInt());
            if (_dragSeekTarget < Duration.zero) _dragSeekTarget = Duration.zero;
            if (_dragSeekTarget > _videoPlayerController.value.duration) {
              _dragSeekTarget = _videoPlayerController.value.duration;
            }
          });
        },
        onHorizontalDragEnd: (details) {
          _videoPlayerController.seekTo(_dragSeekTarget);
          setState(() => _isDraggingHorizontal = false);
          _showNotice('⏩ 跳轉至 ${_formatDuration(_dragSeekTarget)}');
        },
        child: Stack(
          children: [
            // 1. 播放器主體
            Center(
              child: _chewieController != null && _videoPlayerController.value.isInitialized
                  ? AspectRatio(
                      aspectRatio: _videoPlayerController.value.aspectRatio,
                      child: Chewie(controller: _chewieController!),
                    )
                  : const CircularProgressIndicator(),
            ),

            // 2. 頂部資訊欄 (左上角：片名 + 時間)
            if (_showControls || _isLongPressing)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Colors.black.withOpacity(0.8), Colors.transparent],
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              widget.title,
                              style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                              overflow: TextOverflow.ellipsis,
                            ),
                            const Text('正在播放', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          ],
                        ),
                      ),
                      Text(currentTime, style: const TextStyle(color: Colors.white, fontSize: 16)),
                    ],
                  ),
                ),
              ),

            // 3. 底部控制列 (倍速切換)
            if (_showControls)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [Colors.black.withOpacity(0.8), Colors.transparent],
                    ),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // 倍速按鈕列
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [0.5, 1.0, 1.25, 1.5, 2.0].map((speed) {
                          final isSelected = _videoPlayerController.value.playbackSpeed == speed;
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: ElevatedButton(
                              onPressed: () {
                                _videoPlayerController.setPlaybackSpeed(speed);
                                _showNotice('速度: ${speed}x');
                                setState(() {});
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isSelected ? Colors.blueAccent : Colors.grey[800],
                                foregroundColor: Colors.white,
                                minimumSize: const Size(60, 36),
                                padding: EdgeInsets.zero,
                              ),
                              child: Text('${speed}x', style: const TextStyle(fontSize: 12)),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 10),
                      // 這裡可以加入進度條 (由 Chewie 提供或自定義)
                    ],
                  ),
                ),
              ),

            // 4. 中央通知提示
            if (_noticeText.isNotEmpty)
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(30),
                  ),
                  child: Text(_noticeText, style: const TextStyle(color: Colors.white, fontSize: 16)),
                ),
              ),

            // 5. 水平拖動尋道提示
            if (_isDraggingHorizontal)
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.7),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _dragSeekTarget > _dragSeekStart ? Icons.fast_forward : Icons.fast_rewind,
                        color: Colors.white,
                        size: 40,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '${_formatDuration(_dragSeekTarget)} / ${_formatDuration(_videoPlayerController.value.duration)}',
                        style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ),
            
            // 返回按鈕
            if (_showControls)
              Positioned(
                top: 40,
                left: 10,
                child: IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatDuration(Duration duration) {
    String twoDigits(int n) => n.toString().padLeft(2, "0");
    String twoDigitMinutes = twoDigits(duration.inMinutes.remainder(60));
    String twoDigitSeconds = twoDigits(duration.inSeconds.remainder(60));
    if (duration.inHours > 0) {
      return "${twoDigits(duration.inHours)}:$twoDigitMinutes:$twoDigitSeconds";
    }
    return "$twoDigitMinutes:$twoDigitSeconds";
  }
}
