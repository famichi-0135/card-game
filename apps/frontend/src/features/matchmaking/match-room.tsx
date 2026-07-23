import type { Faction } from "@disastar/game-engine/contracts";
import { type ReactNode, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { AuthStatus } from "../auth/auth-layout.tsx";
import { createRoomPath } from "./match-id.ts";
import {
  acceptMatch,
  cancelMatch,
  createStarterDeck,
  getMatchmakingErrorMessage,
} from "./matchmaking-api.ts";
import { useMatchLobby } from "./hooks/use-matchmaking-data.ts";

const factionLabels = {
  disaster: "災害側",
  countermeasure: "対策側",
} as const;

export function MatchRoom({
  matchId,
  playerId,
}: {
  matchId: string;
  playerId: string;
}) {
  const navigate = useNavigate();
  const lobby = useMatchLobby(matchId);
  const match = lobby.data;
  const isOwner = match?.ownerPlayerId === playerId;
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  if (lobby.isPending) {
    return <RoomLayout title="招待部屋を読み込んでいます" />;
  }
  if (lobby.isError || match === undefined) {
    return (
      <RoomLayout title="招待部屋を表示できませんでした">
        <AuthStatus tone="error">
          {getMatchmakingErrorMessage(
            lobby.error,
            "招待部屋を取得できませんでした。部屋 ID または招待 URL を確認してください。",
          )}
        </AuthStatus>
        <Link className={primaryButtonClassName} to="/">
          対戦準備へ戻る
        </Link>
      </RoomLayout>
    );
  }
  if (match.status === "started" && match.gameId !== null) {
    return (
      <Navigate replace to={`/games/${encodeURIComponent(match.gameId)}`} />
    );
  }

  const invitationURL = createInvitationURL(matchId);

  async function handleAccept() {
    if (match === undefined) {
      return;
    }

    setError(null);
    setIsAccepting(true);
    try {
      const deck = await createStarterDeck(
        getOpposingFaction(match.ownerFaction),
      );
      const gameId = await acceptMatch(matchId, deck.id);
      navigate(`/games/${encodeURIComponent(gameId)}`, { replace: true });
    } catch (requestError) {
      setError(
        getMatchmakingErrorMessage(
          requestError,
          "招待部屋に参加できませんでした。最新の状態を確認してください。",
        ),
      );
      void lobby.refetch();
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleCancel() {
    setError(null);
    setIsCancelling(true);
    try {
      await cancelMatch(matchId);
      await lobby.refetch();
    } catch (requestError) {
      setError(
        getMatchmakingErrorMessage(
          requestError,
          "招待部屋を取り消せませんでした。もう一度お試しください。",
        ),
      );
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleCopyInvitation() {
    try {
      await navigator.clipboard.writeText(invitationURL);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  if (match.status === "cancelled") {
    return (
      <RoomLayout title="招待部屋は取り消されました">
        <p className="text-sm leading-6 text-slate-600">
          この招待部屋では対戦を開始できません。
        </p>
        <Link className={primaryButtonClassName} to="/">
          対戦準備へ戻る
        </Link>
      </RoomLayout>
    );
  }

  if (match.status === "starting" || match.status === "started") {
    return (
      <RoomLayout title="対戦を開始しています">
        <p className="text-sm leading-6 text-slate-600">
          対戦の準備が完了すると、対戦画面へ自動的に移動します。
        </p>
      </RoomLayout>
    );
  }

  return (
    <RoomLayout title="招待部屋">
      <section className="grid gap-5 border-b border-slate-300 pb-8">
        <div>
          <p className="text-sm text-slate-600">作成者の陣営</p>
          <h1 className="mt-1 text-2xl font-semibold">
            {factionLabels[match.ownerFaction]}
          </h1>
        </div>
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        <InvitationDetails
          copyStatus={copyStatus}
          invitationURL={invitationURL}
          matchId={matchId}
          onCopy={() => void handleCopyInvitation()}
        />
      </section>
      {isOwner ? (
        <OwnerWaitingState
          isCancelling={isCancelling}
          onCancel={() => void handleCancel()}
        />
      ) : (
        <OpponentJoinState
          faction={getOpposingFaction(match.ownerFaction)}
          isAccepting={isAccepting}
          onAccept={() => void handleAccept()}
        />
      )}
    </RoomLayout>
  );
}

function InvitationDetails({
  copyStatus,
  invitationURL,
  matchId,
  onCopy,
}: {
  copyStatus: "idle" | "copied" | "failed";
  invitationURL: string;
  matchId: string;
  onCopy: () => void;
}) {
  return (
    <div className="grid max-w-2xl gap-3">
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">
        <span>部屋 ID</span>
        <input
          className="h-10 rounded border border-slate-300 bg-slate-50 px-3 font-mono text-sm text-slate-800"
          readOnly
          value={matchId}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-slate-800">
        <span>招待 URL</span>
        <input
          className="h-10 rounded border border-slate-300 bg-slate-50 px-3 text-sm text-slate-800"
          readOnly
          value={invitationURL}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={secondaryButtonClassName}
          onClick={onCopy}
          type="button"
        >
          招待 URL をコピー
        </button>
        {copyStatus === "copied" ? (
          <span className="text-sm text-emerald-700" role="status">
            コピーしました。
          </span>
        ) : copyStatus === "failed" ? (
          <span className="text-sm text-slate-600" role="status">
            コピーできませんでした。入力欄からコピーしてください。
          </span>
        ) : null}
      </div>
    </div>
  );
}

function OwnerWaitingState({
  isCancelling,
  onCancel,
}: {
  isCancelling: boolean;
  onCancel: () => void;
}) {
  return (
    <section className="grid gap-4 py-8">
      <div>
        <h2 className="text-lg font-semibold">対戦相手を待っています</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          招待 URL
          を相手に共有してください。相手が反対ロールで参加すると対戦を開始します。
        </p>
      </div>
      <button
        className="w-fit rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        disabled={isCancelling}
        onClick={onCancel}
        type="button"
      >
        {isCancelling ? "取り消しています" : "招待部屋を取り消す"}
      </button>
    </section>
  );
}

function OpponentJoinState({
  faction,
  isAccepting,
  onAccept,
}: {
  faction: Faction;
  isAccepting: boolean;
  onAccept: () => void;
}) {
  return (
    <section className="grid max-w-xl gap-4 py-8">
      <div>
        <h2 className="text-lg font-semibold">ロールを確認</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          {factionLabels[faction]}の固定スターターデッキで参加します。
        </p>
      </div>
      <button
        className={`${primaryButtonClassName} w-fit`}
        disabled={isAccepting}
        onClick={onAccept}
        type="button"
      >
        {isAccepting ? "参加しています" : `${factionLabels[faction]}で参加する`}
      </button>
    </section>
  );
}

function RoomLayout({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto grid w-full max-w-3xl gap-6 py-10">
        <header className="border-b border-slate-300 pb-4">
          <p className="text-sm font-semibold text-slate-700">
            DISASTAR CARD GAME
          </p>
          <p className="mt-2 text-sm text-slate-600">{title}</p>
        </header>
        {children}
      </div>
    </main>
  );
}

function createInvitationURL(matchId: string): string {
  return new URL(createRoomPath(matchId), window.location.origin).toString();
}

function getOpposingFaction(faction: Faction): Faction {
  return faction === "disaster" ? "countermeasure" : "disaster";
}

const primaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded border border-slate-800 bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";

const secondaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded border border-slate-300 px-4 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900";
