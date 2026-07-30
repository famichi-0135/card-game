import type { PublicMatchLobbySummary } from "@disastar/contracts/match";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const factionLabels = {
  disaster: "災害側",
  countermeasure: "対策側",
} as const;

export function PublicRoomList({
  error,
  isLoading,
  matches,
  onRefresh,
  onSelect,
}: {
  error: string | null;
  isLoading: boolean;
  matches: readonly PublicMatchLobbySummary[];
  onRefresh: () => void;
  onSelect: (matchId: string) => void;
}) {
  return (
    <section
      className="grid gap-4 py-8"
      aria-labelledby="public-room-list-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" id="public-room-list-title">
            募集中の対戦部屋
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            一覧から部屋を選び、ロールを確認して参加できます。
          </p>
        </div>
        <Button onClick={onRefresh} type="button" variant="outline">
          更新
        </Button>
      </div>
      {error === null ? null : (
        <p
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
          role="status"
        >
          {error}
        </p>
      )}
      {isLoading ? (
        <p className="text-sm text-slate-600" role="status">
          公開部屋を読み込んでいます。
        </p>
      ) : matches.length === 0 ? (
        <p className="rounded border border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
          現在参加できる公開部屋はありません。
        </p>
      ) : (
        <ul className="grid gap-3" aria-live="polite">
          {matches.map((match) => (
            <li key={match.matchId}>
              <Card
                className="border border-slate-300 bg-white shadow-none"
                size="sm"
              >
                <CardHeader>
                  <CardTitle>
                    {match.isOwner
                      ? "あなたが作成した部屋"
                      : `${factionLabels[match.ownerFaction]}が募集中`}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600">
                  {remainingMinutesLabel(match.expiresAt)}
                </CardContent>
                <CardFooter className="justify-end border-slate-200 bg-slate-50">
                  <Button
                    onClick={() => onSelect(match.matchId)}
                    type="button"
                    variant={match.isOwner ? "outline" : "default"}
                  >
                    {match.isOwner ? "待機部屋を開く" : "部屋を開く"}
                  </Button>
                </CardFooter>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function remainingMinutesLabel(expiresAt: number): string {
  const remainingMilliseconds = Math.max(0, expiresAt - Date.now());
  const minutes = Math.max(1, Math.ceil(remainingMilliseconds / 60_000));
  return `待機期限まで約${minutes}分`;
}
