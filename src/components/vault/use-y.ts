import { useEffect, useReducer } from "react";
import type * as Y from "yjs";

/** Re-render whenever a Yjs type (or anything inside it) changes. */
export function useY(t: Y.AbstractType<any> | undefined | null) {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!t) return;
    const h = () => bump();
    t.observeDeep(h);
    return () => t.unobserveDeep(h);
  }, [t]);
}
