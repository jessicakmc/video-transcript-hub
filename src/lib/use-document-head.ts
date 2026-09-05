import { useEffect } from "react";

type Meta = {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
};

type Head = { readonly title?: string; readonly meta?: readonly Meta[] };

/**
 * Client-side replacement for TanStack Start's per-route `head()`.
 * Sets document.title and upserts <meta> tags on mount, restoring the
 * document defaults from index.html when the route unmounts.
 */
export function useDocumentHead(head: Head) {
  const serialized = JSON.stringify(head);

  useEffect(() => {
    const parsed = JSON.parse(serialized) as Head;
    const entries: readonly Meta[] = parsed.meta ?? [];
    // TanStack Start expressed the document title as a `{ title }` entry inside
    // the meta array; accept both that shape and a top-level `title`.
    const title = parsed.title ?? entries.find((e) => e.title)?.title;
    const meta = entries.filter((e) => !e.title);

    const previousTitle = document.title;
    if (title) document.title = title;

    const restore: Array<() => void> = [];

    for (const entry of meta) {
      const attr = entry.name ? "name" : "property";
      const key = entry.name ?? entry.property;
      if (!key || entry.content === undefined) continue;

      const selector = `meta[${attr}="${key}"]`;
      const existing = document.head.querySelector<HTMLMetaElement>(selector);

      if (existing) {
        const previousContent = existing.getAttribute("content");
        existing.setAttribute("content", entry.content);
        restore.push(() => {
          if (previousContent === null) existing.removeAttribute("content");
          else existing.setAttribute("content", previousContent);
        });
      } else {
        const created = document.createElement("meta");
        created.setAttribute(attr, key);
        created.setAttribute("content", entry.content);
        document.head.appendChild(created);
        restore.push(() => created.remove());
      }
    }

    return () => {
      document.title = previousTitle;
      for (const undo of restore) undo();
    };
  }, [serialized]);
}
