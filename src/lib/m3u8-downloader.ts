/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 解析 M3U8 内容并提取真正的数据流地址或片段地址
 */
async function resolveMediaPlaylist(
  m3u8Url: string
): Promise<{ url: string; content: string }> {
  const response = await fetch(m3u8Url);
  if (!response.ok) throw new Error('無法獲取 M3U8 列表');
  const text = await response.text();

  // 如果是 Master Playlist (包含不同的清晰度流)
  if (text.includes('#EXT-X-STREAM-INF')) {
    const lines = text.split('\n');
    let bestStreamUrl = '';
    let maxBandwidth = 0;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('#EXT-X-STREAM-INF')) {
        // 嘗試解析 BANDWIDTH
        const bandwidthMatch = lines[i].match(/BANDWIDTH=(\d+)/);
        const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;

        const nextLine = lines[i + 1]?.trim();
        if (nextLine && !nextLine.startsWith('#')) {
          if (bandwidth > maxBandwidth) {
            maxBandwidth = bandwidth;
            bestStreamUrl = nextLine;
          }
        }
      }
    }

    if (bestStreamUrl) {
      const absoluteUrl = bestStreamUrl.startsWith('http')
        ? bestStreamUrl
        : new URL(bestStreamUrl, m3u8Url).href;
      // eslint-disable-next-line no-console
      console.log('解析到 Master Playlist，選擇最高質量流:', absoluteUrl);
      return resolveMediaPlaylist(absoluteUrl); // 遞迴解析子列表
    }
  }

  return { url: m3u8Url, content: text };
}

/**
 * 提取片段 URL
 */
function parseSegments(content: string, baseUrl: string): string[] {
  const lines = content.split('\n');
  const tsUrls: string[] = [];
  const baseUrlObj = new URL(baseUrl);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      try {
        const url = new URL(trimmed, baseUrlObj.href);
        tsUrls.push(url.href);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('URL 解析失敗:', trimmed);
      }
    }
  }
  return tsUrls;
}

/**
 * 在瀏覽器中下載 M3U8 視頻
 */
export async function downloadM3U8InBrowser(
  m3u8Url: string,
  filename: string,
  onProgress?: (progress: number, current: number, total: number) => void
): Promise<{ success: boolean; error?: any }> {
  try {
    // 1. 解析出真正的 Media Playlist (處理 Master Playlist 嵌套)
    const { url: finalMediaUrl, content: mediaContent } =
      await resolveMediaPlaylist(m3u8Url);

    // 2. 提取所有 .ts 片段
    const tsUrls = parseSegments(mediaContent, finalMediaUrl);
    if (tsUrls.length === 0) throw new Error('未找到有效的視頻片段地址');

    // eslint-disable-next-line no-console
    console.log(`開始下載 ${tsUrls.length} 個片段...`);

    // 3. 併發/順序下載片段
    const segments: ArrayBuffer[] = [];
    let failedCount = 0;

    for (let i = 0; i < tsUrls.length; i++) {
      try {
        const res = await fetch(tsUrls[i]);
        if (!res.ok) throw new Error('下載失敗');
        const buf = await res.arrayBuffer();

        // 簡單校驗：如果下載的內容太小（例如小於 100 字節），且內容是文本，通常是錯誤頁面
        if (buf.byteLength < 500) {
          const decoder = new TextDecoder();
          const text = decoder.decode(buf);
          if (text.includes('#EXTM3U') || text.includes('<html>')) {
            throw new Error('下載到了錯誤的內容檔案');
          }
        }

        segments.push(buf);

        const progress = ((i + 1) / tsUrls.length) * 100;
        onProgress?.(progress, i + 1, tsUrls.length);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`片段 ${i} 下載失敗:`, err);
        failedCount++;
        // 如果失敗比例過高 (>20%)，中斷下載
        if (failedCount > tsUrls.length * 0.2 && tsUrls.length > 10) {
          throw new Error('多個視頻片段下載失敗，可能受 CORS 限制或網絡問題');
        }
      }
    }

    if (segments.length === 0) throw new Error('所有片段下載失敗');

    // 4. 合併片段
    const totalSize = segments.reduce((acc, b) => acc + b.byteLength, 0);
    const merged = new Uint8Array(totalSize);
    let offset = 0;
    for (const b of segments) {
      merged.set(new Uint8Array(b), offset);
      offset += b.byteLength;
    }

    // 5. 觸發下載 (雖然技術上是 MPEG-TS，但我們強制標記為 .mp4 增加兼容性)
    const blob = new Blob([merged], { type: 'video/mp4' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;

    // 移除檔名中可能存在的舊後綴，並強制添加 .mp4
    const cleanFilename = filename.replace(/\.(ts|mp4|mkv|mov|avi|wmv)$/i, '');
    a.download = `${cleanFilename}.mp4`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    return { success: true };
  } catch (error: any) {
    // eslint-disable-next-line no-console
    console.error('M3U8 下載核心錯誤:', error);
    return { success: false, error: error.message || '下載失敗' };
  }
}
