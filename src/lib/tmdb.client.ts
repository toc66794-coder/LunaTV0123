/**
 * TMDb API 客戶端
 * 支援 v3 (API Key) 和 v4 (Access Token) 兩種認證方式
 */

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_ACCESS_TOKEN = process.env.TMDB_ACCESS_TOKEN;
const TMDB_BASE_URL_V3 = 'https://api.themoviedb.org/3';
const TMDB_BASE_URL_V4 = 'https://api.themoviedb.org/4';

// 圖片 CDN 基礎 URL
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * 通用的 TMDb 請求函數（自動選擇認證方式）
 */
async function fetchTMDb<T = unknown>(
  endpoint: string,
  useV4 = false
): Promise<T> {
  const baseUrl = useV4
    ? TMDB_ACCESS_TOKEN
      ? TMDB_BASE_URL_V4
      : TMDB_BASE_URL_V3
    : TMDB_BASE_URL_V3;

  // 優先使用 API Key (v3)
  if (!useV4 && TMDB_API_KEY) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${baseUrl}${endpoint}${separator}api_key=${TMDB_API_KEY}&language=zh-TW`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `TMDb API Error: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as Promise<T>;
  }

  // 使用 Access Token (v4)
  if (TMDB_ACCESS_TOKEN) {
    const url = `${baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TMDB_ACCESS_TOKEN}`,
        'Content-Type': 'application/json;charset=utf-8',
      },
    });

    if (!response.ok) {
      throw new Error(
        `TMDb API Error: ${response.status} ${response.statusText}`
      );
    }
    return response.json() as Promise<T>;
  }

  throw new Error('TMDb API Key 或 Access Token 未設定');
}

// ==================== 介面定義 ====================

export interface TMDbMovie {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
}

export interface TMDbTVShow {
  id: number;
  name: string;
  original_name: string;
  first_air_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
}

export interface TMDbCast {
  id: number;
  name: string;
  original_name: string;
  character: string;
  profile_path: string | null;
  order: number;
  gender: number; // 1: 女性, 2: 男性
  known_for_department: string;
}

export interface TMDbCrew {
  id: number;
  name: string;
  original_name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDbPerson {
  id: number;
  name: string;
  profile_path: string | null;
  known_for_department: string;
  known_for: Array<TMDbMovie | TMDbTVShow>;
}

// ==================== API 函數 ====================

/**
 * 搜尋電影
 */
export async function searchMovies(
  query: string,
  page = 1
): Promise<{
  results: TMDbMovie[];
  total_results: number;
  total_pages: number;
}> {
  return fetchTMDb(
    `/search/movie?query=${encodeURIComponent(query)}&page=${page}`
  );
}

/**
 * 搜尋電視劇
 */
export async function searchTVShows(
  query: string,
  page = 1
): Promise<{
  results: TMDbTVShow[];
  total_results: number;
  total_pages: number;
}> {
  return fetchTMDb(
    `/search/tv?query=${encodeURIComponent(query)}&page=${page}`
  );
}

/**
 * 搜尋演員
 * @param name 演員名字
 * @param page 頁碼
 * @param language 語言代碼（zh-TW, zh-CN, en）
 */
export async function searchPerson(
  name: string,
  page = 1,
  language: 'zh-TW' | 'zh-CN' | 'en' = 'zh-TW'
): Promise<{
  results: TMDbPerson[];
  total_results: number;
  total_pages: number;
}> {
  // 覆寫語言參數
  const endpoint = `/search/person?query=${encodeURIComponent(
    name
  )}&page=${page}&language=${language}`;
  return fetchTMDb(endpoint);
}

/**
 * 獲取電影詳情
 */
export async function getMovieDetail(movieId: number) {
  return fetchTMDb(`/movie/${movieId}`);
}

/**
 * 獲取電視劇詳情
 */
export async function getTVShowDetail(tvId: number) {
  return fetchTMDb(`/tv/${tvId}`);
}

/**
 * 獲取電影演員陣容
 */
export async function getMovieCredits(movieId: number): Promise<{
  cast: TMDbCast[];
  crew: TMDbCrew[];
}> {
  return fetchTMDb(`/movie/${movieId}/credits`);
}

/**
 * 獲取電視劇演員陣容
 */
export async function getTVShowCredits(tvId: number): Promise<{
  cast: TMDbCast[];
  crew: TMDbCrew[];
}> {
  return fetchTMDb(`/tv/${tvId}/credits`);
}

/**
 * 獲取演員詳情
 */
export async function getPersonDetail(personId: number) {
  return fetchTMDb(`/person/${personId}`);
}

/**
 * 獲取演員的作品列表
 */
export async function getPersonCredits(personId: number): Promise<{
  cast: Array<TMDbMovie | TMDbTVShow>;
  crew: Array<TMDbMovie | TMDbTVShow>;
}> {
  return fetchTMDb(`/person/${personId}/combined_credits`);
}

/**
 * 獲取熱門電影
 */
export async function getTrendingMovies(timeWindow: 'day' | 'week' = 'week') {
  return fetchTMDb(`/trending/movie/${timeWindow}`);
}

/**
 * 獲取熱門電視劇
 */
export async function getTrendingTVShows(timeWindow: 'day' | 'week' = 'week') {
  return fetchTMDb(`/trending/tv/${timeWindow}`);
}

// ==================== 工具函數 ====================

/**
 * 獲取圖片完整 URL
 * @param path - 圖片路徑（例如：/abc123.jpg）
 * @param size - 圖片尺寸（w92, w154, w185, w342, w500, w780, original）
 */
export function getImageUrl(
  path: string | null,
  size: 'w92' | 'w154' | 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * 獲取演員頭像 URL
 */
export function getProfileUrl(
  path: string | null,
  size: 'w45' | 'w185' | 'h632' | 'original' = 'w185'
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

/**
 * 從電影/電視劇標題搜尋並獲取演員資訊（一站式函數）
 */
export async function getActorsByTitle(
  title: string,
  type: 'movie' | 'tv' = 'movie'
): Promise<TMDbCast[] | null> {
  try {
    // Step 1: 搜尋影片
    const searchResults =
      type === 'movie' ? await searchMovies(title) : await searchTVShows(title);

    if (searchResults.results.length === 0) {
      return null;
    }

    // Step 2: 取得第一個結果的演員資訊
    const firstResult = searchResults.results[0];
    const credits =
      type === 'movie'
        ? await getMovieCredits(firstResult.id)
        : await getTVShowCredits(firstResult.id);

    return credits.cast;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('獲取演員資訊失敗:', error);
    return null;
  }
}
