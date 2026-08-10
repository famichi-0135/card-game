const USER_FACING_ROUTE_ERRORS = new Set([
  "ゲームIDが指定されていません。",
  "招待部屋 ID が指定されていません。",
]);

export function getRouteErrorDescription(error: unknown): string {
  if (error instanceof Error && USER_FACING_ROUTE_ERRORS.has(error.message)) {
    return error.message;
  }

  return "ページを読み込めませんでした。通信状態を確認して、もう一度お試しください。";
}
