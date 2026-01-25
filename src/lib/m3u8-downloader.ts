/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 解析 M3U8 播放列表,提取所有 .ts 片段 URL
 */
function parseM3U8(content: string, baseUrl: string): string[] {
  const lines = content.split('\n');
  const tsUrls: string[] = [];
  const baseUrlObj = new URL(baseUrl);

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳過註釋和空行
    if (trimmed && !trimmed.startsWith('#')) {
      try {
        // 處理絕對路徑和相對路徑
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          tsUrls.push(trimmed);
        } else {
          const url = new URL(trimmed, baseUrlObj.href);
          tsUrls.push(url.href);
        }
      } catch (error) {
        console.warn('無法解析 URL:', trimmed, error);
      }
    }
  }

  return tsUrls;
}

/**
 * 在瀏覽器中下載 M3U8 視頻
 * 注意: 此功能為實驗性,可能受 CORS 限制
 */
export async function downloadM3U8InBrowser(
  m3u8Url: string,
  filename: string,
  onProgress?: (progress: number, current: number, total: number) => void
): Promise<{ success: boolean; error?: any }> {
  try {
    // 1. 獲取 m3u8 播放列表
    const m3u8Response = await fetch(m3u8Url);
    if (!m3u8Response.ok) {
      throw new Error(`無法獲取 M3U8: ${m3u8Response.statusText}`);
    }
    const m3u8Text = await m3u8Response.text();

    // 2. 解析出所有 .ts 片段 URL
    const tsUrls = parseM3U8(m3u8Text, m3u8Url);
    if (tsUrls.length === 0) {
      throw new Error('未找到視頻片段');
    }

    console.log(`找到 ${tsUrls.length} 個視頻片段`);

    // 3. 下載所有片段
    const segments: ArrayBuffer[] = [];
    for (let i = 0; i < tsUrls.length; i++) {
      try {
        const response = await fetch(tsUrls[i]);
        if (!response.ok) {
          console.warn(`片段 ${i + 1} 下載失敗,跳過`);
          continue;
        }
        const buffer = await response.arrayBuffer();
        segments.push(buffer);

        // 更新進度
        const progress = ((i + 1) / tsUrls.length) * 100;
        onProgress?.(progress, i + 1, tsUrls.length);
      } catch (error) {
        console.warn(`片段 ${i + 1} 下載失敗:`, error);
      }
    }

    if (segments.length === 0) {
      throw new Error('所有片段下載失敗');
    }

    // 4. 合併所有片段
    const totalLength = segments.reduce((sum, seg) => sum + seg.byteLength, 0);
    const merged = new Uint8Array(totalLength);
    let offset = 0;
    for (const segment of segments) {
      merged.set(new Uint8Array(segment), offset);
      offset += segment.byteLength;
    }

    // 5. 創建 Blob 並觸發下載
    const blob = new Blob([merged], { type: 'video/mp2t' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.ts`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 清理
    setTimeout(() => URL.revokeObjectURL(url), 100);

    return { success: true };
  } catch (error) {
    console.error('下載失敗:', error);
    return { success: false, error };
  }
}
