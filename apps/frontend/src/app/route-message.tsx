import { Link } from "react-router";

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
    <main className="grid min-h-dvh place-items-center bg-slate-100 p-6 text-slate-950">
      <section className="w-full max-w-md rounded-md border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">
          DISASTAR CARD GAME
        </p>
        <h1 className="mt-4 text-xl font-semibold" role={status}>
          {title}
        </h1>
        {description === undefined ? null : (
          <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        )}
        <Link
          className="mt-6 inline-flex rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          to="/"
        >
          対戦画面の入口へ戻る
        </Link>
      </section>
    </main>
  );
}
