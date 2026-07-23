import { useEffect, useState } from "react";

/** ページ非表示中はリアルタイム接続を休止するための可視状態。 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(
    () => typeof document === "undefined" || !document.hidden,
  );

  useEffect(() => {
    const updateVisibility = () => setIsVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () =>
      document.removeEventListener("visibilitychange", updateVisibility);
  }, []);

  return isVisible;
}
