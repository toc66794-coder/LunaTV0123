import { TVFocusProvider } from '@/components/tv/TVFocusProvider';

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return <TVFocusProvider>{children}</TVFocusProvider>;
}
