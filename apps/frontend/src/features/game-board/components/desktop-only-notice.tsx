export function DesktopOnlyNotice() {
  return (
    <main className="hidden min-h-dvh items-center justify-center bg-slate-100 p-6 text-center max-[1179px]:flex max-[719px]:flex">
      <div className="rounded-md border border-slate-300 bg-white p-6">
        <p className="text-xs font-medium text-slate-500">DISASTAR CARD GAME</p>
        <h1 className="mt-2 text-xl font-semibold">
          PC 横画面で開いてください
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          対戦画面は幅 1180px、高さ 720px 以上に対応しています。
        </p>
      </div>
    </main>
  );
}
