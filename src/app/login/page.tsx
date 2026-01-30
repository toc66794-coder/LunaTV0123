/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import {
  AlertCircle,
  CheckCircle,
  Keyboard as KeyboardIcon,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CURRENT_VERSION } from '@/lib/version';
import { checkForUpdates, UpdateStatus } from '@/lib/version_check';

import { useSite } from '@/components/SiteProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { TVFocusProvider } from '@/components/tv/TVFocusProvider';
import { VirtualKeyboard } from '@/components/VirtualKeyboard';

// 版本显示组件
function VersionDisplay() {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const status = await checkForUpdates();
        setUpdateStatus(status);
      } catch (_) {
        // do nothing
      } finally {
        setIsChecking(false);
      }
    };

    checkUpdate();
  }, []);

  return (
    <button
      onClick={() =>
        window.open('https://github.com/MoonTechLab/LunaTV', '_blank')
      }
      className='absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 transition-colors cursor-pointer'
    >
      <span className='font-mono'>v{CURRENT_VERSION}</span>
      {!isChecking && updateStatus !== UpdateStatus.FETCH_FAILED && (
        <div
          className={`flex items-center gap-1.5 ${
            updateStatus === UpdateStatus.HAS_UPDATE
              ? 'text-yellow-600 dark:text-yellow-400'
              : updateStatus === UpdateStatus.NO_UPDATE
              ? 'text-green-600 dark:text-green-400'
              : ''
          }`}
        >
          {updateStatus === UpdateStatus.HAS_UPDATE && (
            <>
              <AlertCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>有新版本</span>
            </>
          )}
          {updateStatus === UpdateStatus.NO_UPDATE && (
            <>
              <CheckCircle className='w-3.5 h-3.5' />
              <span className='font-semibold text-xs'>已是最新</span>
            </>
          )}
        </div>
      )}
    </button>
  );
}

function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shouldAskUsername, setShouldAskUsername] = useState(false);

  // 虚拟键盘状态
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [activeField, setActiveField] = useState<'username' | 'password'>(
    'password'
  );

  const { siteName } = useSite();

  // 在客户端挂载后设置配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storageType = (window as any).RUNTIME_CONFIG?.STORAGE_TYPE;
      const askUser = storageType && storageType !== 'localstorage';
      setShouldAskUsername(askUser);
      if (askUser) {
        setActiveField('username');
      }

      // Auto focus the first input for TV navigation
      setTimeout(() => {
        const firstInput = document.querySelector(
          'input[data-tv-focusable="true"]'
        ) as HTMLElement;
        if (firstInput) {
          firstInput.focus();
        }
      }, 100);
    }
  }, []);

  const handleKeyboardInput = (char: string) => {
    if (activeField === 'username') {
      setUsername((prev) => prev + char);
    } else {
      setPassword((prev) => prev + char);
    }
  };

  const handleKeyboardDelete = () => {
    if (activeField === 'username') {
      setUsername((prev) => prev.slice(0, -1));
    } else {
      setPassword((prev) => prev.slice(0, -1));
    }
  };

  // 处理输入框按键，允许使用方向键跳出输入框 (TV模式下)
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      (e.target as HTMLElement).blur();
    }
  };

  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    setError(null);

    if (!password || (shouldAskUsername && !username)) return;

    try {
      setLoading(true);
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password,
          ...(shouldAskUsername ? { username } : {}),
        }),
      });

      if (res.ok) {
        const redirect = searchParams.get('redirect') || '/';
        router.replace(redirect);
      } else if (res.status === 401) {
        setError('密码错误');
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? '服务器错误');
      }
    } catch (error) {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <TVFocusProvider className='relative min-h-screen flex items-center justify-center px-4 overflow-hidden'>
      <div className='absolute top-4 right-4'>
        <ThemeToggle />
      </div>
      <div className='relative z-10 w-full max-w-md rounded-3xl bg-gradient-to-b from-white/90 via-white/70 to-white/40 dark:from-zinc-900/90 dark:via-zinc-900/70 dark:to-zinc-900/40 backdrop-blur-xl shadow-2xl p-10 dark:border dark:border-zinc-800 my-8'>
        <h1 className='text-green-600 tracking-tight text-center text-3xl font-extrabold mb-8 bg-clip-text drop-shadow-sm'>
          {siteName}
        </h1>
        <form onSubmit={handleSubmit} className='space-y-6'>
          {shouldAskUsername && (
            <div>
              <label htmlFor='username' className='sr-only'>
                用户名
              </label>
              <input
                id='username'
                type='text'
                autoComplete='username'
                data-tv-focusable='true'
                onFocus={() => setActiveField('username')}
                onKeyDown={handleInputKeyDown}
                className={`block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur ${
                  activeField === 'username' && showKeyboard
                    ? 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-900/20'
                    : 'focus:ring-2 focus:ring-green-500'
                }`}
                placeholder='输入用户名'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor='password' className='sr-only'>
              密码
            </label>
            <input
              id='password'
              type='password'
              autoComplete='current-password'
              data-tv-focusable='true'
              onFocus={() => setActiveField('password')}
              onKeyDown={handleInputKeyDown}
              className={`block w-full rounded-lg border-0 py-3 px-4 text-gray-900 dark:text-gray-100 shadow-sm ring-1 ring-white/60 dark:ring-white/20 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none sm:text-base bg-white/60 dark:bg-zinc-800/60 backdrop-blur ${
                activeField === 'password' && showKeyboard
                  ? 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-900/20'
                  : 'focus:ring-2 focus:ring-green-500'
              }`}
              placeholder='输入访问密码'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
          )}

          {/* 键盘切换按钮 */}
          <button
            type='button'
            data-tv-focusable='true'
            onClick={() => setShowKeyboard(!showKeyboard)}
            className={`flex items-center gap-2 text-sm font-medium transition-colors ${
              showKeyboard
                ? 'text-green-600 dark:text-green-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            <KeyboardIcon size={16} />
            {showKeyboard ? '隐藏虚拟键盘' : '显示虚拟键盘'}
          </button>

          {/* 虚拟键盘 */}
          {showKeyboard && (
            <VirtualKeyboard
              onInput={handleKeyboardInput}
              onDelete={handleKeyboardDelete}
              onEnter={() => handleSubmit()}
              className='mt-2'
            />
          )}

          {/* 登录按钮 */}
          <button
            type='submit'
            data-tv-focusable='true'
            disabled={!password || loading || (shouldAskUsername && !username)}
            className='inline-flex w-full justify-center rounded-lg bg-green-600 py-3 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:from-green-600 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50 focus:ring-4 focus:ring-green-500/50 focus:outline-none'
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>

      {/* 版本信息显示 */}
      <VersionDisplay />
    </TVFocusProvider>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginPageClient />
    </Suspense>
  );
}
