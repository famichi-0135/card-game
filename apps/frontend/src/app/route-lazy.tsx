import { lazy, Suspense, type ComponentType } from "react";
import { RouteMessage } from "./route-message.tsx";

type RouteModule = Record<string, unknown>;

export async function resolveNamedRoute(
  loader: () => Promise<RouteModule>,
  exportName: string,
): Promise<{ default: ComponentType }> {
  const routeModule = await loader();
  const routeComponent = routeModule[exportName];

  if (typeof routeComponent !== "function") {
    throw new Error(`Route module does not export ${exportName}.`);
  }

  return { default: routeComponent as ComponentType };
}

export function createLazyRoute(
  loader: () => Promise<RouteModule>,
  exportName: string,
): ComponentType {
  const LazyRoute = lazy(() => resolveNamedRoute(loader, exportName));

  function RouteWithLoadingBoundary() {
    return (
      <Suspense fallback={<RouteLoadingFallback />}>
        <LazyRoute />
      </Suspense>
    );
  }

  RouteWithLoadingBoundary.displayName = `LazyRoute(${exportName})`;
  return RouteWithLoadingBoundary;
}

export function RouteLoadingFallback() {
  return <RouteMessage status="status" title="ページを読み込んでいます" />;
}
