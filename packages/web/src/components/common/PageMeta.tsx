import { useEffect } from 'react';

export function PageMeta({ title, description }: { title: string; description?: string }) {
  useEffect(() => {
    document.title = title ? `${title} · SCIEHub` : 'SCIEHub';
    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }
  }, [title, description]);
  return null;
}
