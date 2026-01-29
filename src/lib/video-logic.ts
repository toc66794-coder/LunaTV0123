import { SearchResult } from '@/lib/types';
import { getVideoResolutionFromM3u8 } from '@/lib/utils';

/**
 * 計算播放源綜合評分
 */
export const calculateSourceScore = (
  testResult: {
    quality: string;
    loadSpeed: string;
    pingTime: number;
  },
  maxSpeed: number,
  minPing: number,
  maxPing: number
): number => {
  let score = 0;

  // 1. 分辨率評分 (40% 權重)
  const qualityScore = (() => {
    const q = testResult.quality.toLowerCase();
    if (q.includes('4k')) return 100;
    if (q.includes('2k')) return 85;
    if (q.includes('1080p') || q.includes('bd') || q.includes('藍光'))
      return 75;
    if (q.includes('720p')) return 60;
    if (q.includes('480p')) return 40;
    if (q.includes('sd')) return 20;
    return 0;
  })();
  score += qualityScore * 0.4;

  // 2. 下載速度評分 (40% 權重) - 基於最大速度線性映射
  const speedScore = (() => {
    const speedStr = testResult.loadSpeed;
    if (speedStr === '未知' || speedStr === '測量中...') return 30;

    const match = speedStr.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
    if (!match) return 30;

    const value = parseFloat(match[1]);
    const unit = match[2];
    const speedKBps = unit === 'MB/s' ? value * 1024 : value;

    const speedRatio = speedKBps / maxSpeed;
    return Math.min(100, Math.max(0, speedRatio * 100));
  })();
  score += speedScore * 0.4;

  // 3. 網路延遲評分 (20% 權重) - 基於延遲範圍線性映射
  const pingScore = (() => {
    const ping = testResult.pingTime;
    if (ping <= 0) return 0;
    if (maxPing === minPing) return 100;

    const pingRatio = (maxPing - ping) / (maxPing - minPing);
    return Math.min(100, Math.max(0, pingRatio * 100));
  })();
  score += pingScore * 0.2;

  return Math.round(score * 100) / 100;
};

/**
 * 針對一組播放源進行測速並選出最佳者
 */
export const preferBestSource = async (
  sources: SearchResult[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onProgress?: (info: Map<string, any>) => void
): Promise<SearchResult> => {
  if (sources.length === 1) return sources[0];

  const results: Array<{
    source: SearchResult;
    testResult: { quality: string; loadSpeed: string; pingTime: number };
  }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const videoInfoMap = new Map<string, any>();

  // 限制測速範圍（前 5 個），避免對伺服器造成過大壓力
  const candidates = sources.slice(0, 5);

  await Promise.all(
    candidates.map(async (source) => {
      try {
        if (!source.episodes || source.episodes.length === 0) return;

        const episodeUrl =
          source.episodes.length > 1 ? source.episodes[1] : source.episodes[0];

        const testResult = await getVideoResolutionFromM3u8(episodeUrl);
        results.push({ source, testResult });

        const sourceKey = `${source.source}-${source.id}`;
        videoInfoMap.set(sourceKey, testResult);
      } catch (error) {
        // ignore error for single source
      }
    })
  );

  if (onProgress) onProgress(videoInfoMap);

  if (results.length === 0) return sources[0];

  // 計算全體極大/極小值用於歸一化
  const validSpeeds = results
    .map((r) => {
      const match = r.testResult.loadSpeed.match(/^([\d.]+)\s*(KB\/s|MB\/s)$/);
      if (!match) return 0;
      return match[2] === 'MB/s'
        ? parseFloat(match[1]) * 1024
        : parseFloat(match[1]);
    })
    .filter((s) => s > 0);

  const maxSpeed = validSpeeds.length > 0 ? Math.max(...validSpeeds) : 1024;

  const validPings = results
    .map((r) => r.testResult.pingTime)
    .filter((p) => p > 0);
  const minPing = validPings.length > 0 ? Math.min(...validPings) : 50;
  const maxPing = validPings.length > 0 ? Math.max(...validPings) : 1000;

  const resultsWithScore = results.map((r) => ({
    ...r,
    score: calculateSourceScore(r.testResult, maxSpeed, minPing, maxPing),
  }));

  resultsWithScore.sort((a, b) => b.score - a.score);
  return resultsWithScore[0].source;
};
