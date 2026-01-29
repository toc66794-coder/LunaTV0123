import { TVFocusProvider } from '@/components/tv/TVFocusProvider';

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta name='referrer' content='no-referrer' />
      <TVFocusProvider>{children}</TVFocusProvider>
    </>
  );
}
