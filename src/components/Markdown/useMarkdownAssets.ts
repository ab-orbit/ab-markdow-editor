import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarkdownAsset } from '@/lib/markdown/assets';

/** Own object URLs once; release them on document replacement and unmount. */
export function useMarkdownAssets() {
  const [assets, setAssets] = useState<MarkdownAsset[]>([]);
  const current = useRef<MarkdownAsset[]>([]);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; current.current.forEach(asset => URL.revokeObjectURL(asset.url)); }; }, []);
  const replace = useCallback((files: { path: string; file: File }[]) => {
    if (!mounted.current) return;
    const next = files.map(file => ({ ...file, url: URL.createObjectURL(file.file) }));
    current.current.forEach(asset => URL.revokeObjectURL(asset.url));
    current.current = next; setAssets(next);
  }, []);
  const append = useCallback((files: { path: string; file: File }[]) => {
    if (!mounted.current) return [];
    const added = files.map(file => ({ ...file, url: URL.createObjectURL(file.file) }));
    current.current = [...current.current, ...added]; setAssets(current.current); return added;
  }, []);
  return { assets, replace, append };
}
