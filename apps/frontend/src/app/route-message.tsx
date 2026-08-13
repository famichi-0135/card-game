import { Link } from "react-router";
import {
  AppEmptyState,
  AppShell,
  appButtonClassName,
} from "../components/application-ui.tsx";

export function RouteMessage({
  title,
  description,
  status,
}: {
  title: string;
  description?: string;
  status?: "status";
}) {
  return (
    <AppShell
      contentClassName="flex min-h-[calc(100dvh-76px)] items-center justify-center py-12"
      includeAccountMenu={false}
    >
      <div role={status}>
        <AppEmptyState
          action={
            <Link className={appButtonClassName.secondary} to="/">
              対戦画面の入口へ戻る
            </Link>
          }
          description={description ?? "別の画面からもう一度お試しください。"}
          title={title}
        />
      </div>
    </AppShell>
  );
}
