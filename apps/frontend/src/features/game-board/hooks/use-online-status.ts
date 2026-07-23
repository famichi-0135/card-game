import { useEffect, useState } from "react";

function getOnlineStatus(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/** ブラウザのネットワーク到達性を、盤面操作を止めるためのヒントとして扱う。 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);

  useEffect(() => {
    const markOnline = () => setIsOnline(true);
    const markOffline = () => setIsOnline(false);

    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
    };
  }, []);

  return isOnline;
}
