import type { Faction } from "@disastar/game-engine/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import {
  AppPanel,
  AppShell,
  PageHeader,
  appButtonClassName,
  appInputClassName,
} from "../../components/application-ui.tsx";
import { toast } from "../../components/ui/toast.tsx";
import { AuthStatus } from "../auth/auth-layout.tsx";
import { createRoomPath } from "./match-id.ts";
import {
  acceptMatch,
  cancelMatch,
  cancelMatchOnPageExit,
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
  useCancelMatchOnLeave({
    enabled:
      isOwner && (match?.status === "waiting" || match?.status === "starting"),
    matchId,
  });
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
        <Link className={appButtonClassName.secondary} to="/">
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

    setIsAccepting(true);
    try {
      const deck = await createStarterDeck(
        getOpposingFaction(match.ownerFaction),
      );
      const gameId = await acceptMatch(matchId, deck.id);
      navigate(`/games/${encodeURIComponent(gameId)}`, { replace: true });
    } catch (requestError) {
      toast.add({
        description: getMatchmakingErrorMessage(
          requestError,
          "招待部屋に参加できませんでした。最新の状態を確認してください。",
        ),
        title: "招待部屋に参加できません",
        type: "error",
      });
      void lobby.refetch();
    } finally {
      setIsAccepting(false);
    }
  }

  async function handleCancel() {
    setIsCancelling(true);
    try {
      await cancelMatch(matchId);
      await lobby.refetch();
    } catch (requestError) {
      toast.add({
        description: getMatchmakingErrorMessage(
          requestError,
          "招待部屋を取り消せませんでした。もう一度お試しください。",
        ),
        title: "招待部屋を取り消せません",
        type: "error",
      });
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
        <p className="text-sm leading-6 text-[#91a5b4]">
          この招待部屋では対戦を開始できません。
        </p>
        <Link className={appButtonClassName.secondary} to="/">
          対戦準備へ戻る
        </Link>
      </RoomLayout>
    );
  }

  if (match.status === "starting") {
    return (
      <RoomLayout title="対戦を開始しています">
        <p className="text-sm leading-6 text-[#91a5b4]">
          開始結果を確認できませんでした。同じ対戦情報で再試行するか、作成者が部屋を取り消してください。
        </p>
        <StartingMatchRecoveryActions
          isPending={isOwner ? isCancelling : isAccepting}
          onAction={() => void (isOwner ? handleCancel() : handleAccept())}
          role={isOwner ? "owner" : "opponent"}
        />
      </RoomLayout>
    );
  }

  if (match.status === "started") {
    return (
      <RoomLayout title="対戦を開始しています">
        <p className="text-sm leading-6 text-[#91a5b4]">
          対戦画面の情報を確認しています。しばらくしてから再読み込みしてください。
        </p>
      </RoomLayout>
    );
  }

  return (
    <RoomLayout title="招待部屋">
      <section className="grid gap-5">
        <div>
          <p className="text-[11px] font-medium tracking-[.18em] text-[#5798c9]">
            OWNER FACTION
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-[#edf3f7]">
            {factionLabels[match.ownerFaction]}
          </h1>
        </div>
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
    <div className="grid max-w-2xl gap-4">
      <label className="grid gap-1.5 text-sm font-medium text-[#c9d8e0]">
        <span>部屋 ID</span>
        <input
          className={`${appInputClassName} font-mono text-sm`}
          readOnly
          value={matchId}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-[#c9d8e0]">
        <span>招待 URL</span>
        <input
          className={`${appInputClassName} text-sm`}
          readOnly
          value={invitationURL}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={appButtonClassName.secondary}
          onClick={onCopy}
          type="button"
        >
          招待 URL をコピー
        </button>
        {copyStatus === "copied" ? (
          <span className="text-sm text-[#9cddb0]" role="status">
            コピーしました。
          </span>
        ) : copyStatus === "failed" ? (
          <span className="text-sm text-[#b5c5ce]" role="status">
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
    <AppPanel className="mt-7" label="WAITING ROOM">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#e7eff4]">
            対戦相手を待っています
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#91a5b4]">
            招待 URL
            を相手に共有してください。相手が反対ロールで参加すると対戦を開始します。
          </p>
        </div>
        <button
          className={`w-fit ${appButtonClassName.tertiary}`}
          disabled={isCancelling}
          onClick={onCancel}
          type="button"
        >
          {isCancelling ? "取り消しています" : "招待部屋を取り消す"}
        </button>
      </section>
    </AppPanel>
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
    <AppPanel className="mt-7 max-w-xl" label="JOIN MATCH">
      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#e7eff4]">ロールを確認</h2>
          <p className="mt-1 text-sm leading-6 text-[#91a5b4]">
            {factionLabels[faction]}の固定スターターデッキで参加します。
          </p>
        </div>
        <button
          className={`${appButtonClassName.primary} w-fit`}
          disabled={isAccepting}
          onClick={onAccept}
          type="button"
        >
          {isAccepting
            ? "参加しています"
            : `${factionLabels[faction]}で参加する`}
        </button>
      </section>
    </AppPanel>
  );
}

export function StartingMatchRecoveryActions({
  isPending,
  onAction,
  role,
}: {
  isPending: boolean;
  onAction: () => void;
  role: "owner" | "opponent";
}) {
  const isOwner = role === "owner";

  return (
    <button
      className={`${isOwner ? secondaryButtonClassName : appButtonClassName.primary} w-fit`}
      disabled={isPending}
      onClick={onAction}
      type="button"
    >
      {isPending
        ? isOwner
          ? "取り消しています"
          : "再試行しています"
        : isOwner
          ? "招待部屋を取り消す"
          : "対戦開始を再試行する"}
    </button>
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
    <AppShell contentClassName="max-w-3xl">
      <PageHeader eyebrow="MATCH LOBBY" title={title} />
      <div className="mt-7 grid gap-6">{children}</div>
    </AppShell>
  );
}

function createInvitationURL(matchId: string): string {
  return new URL(createRoomPath(matchId), window.location.origin).toString();
}

function getOpposingFaction(faction: Faction): Faction {
  return faction === "disaster" ? "countermeasure" : "disaster";
}

function useCancelMatchOnLeave({
  enabled,
  matchId,
}: {
  enabled: boolean;
  matchId: string;
}) {
  const enabledRef = useRef(enabled);
  const cancellationSentRef = useRef(false);
  const pendingCancellationRef = useRef<number | null>(null);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (pendingCancellationRef.current !== null) {
      window.clearTimeout(pendingCancellationRef.current);
      pendingCancellationRef.current = null;
    }

    function cancelOnLeave() {
      if (!enabledRef.current || cancellationSentRef.current) {
        return;
      }
      cancellationSentRef.current = true;
      cancelMatchOnPageExit(matchId);
    }

    window.addEventListener("pagehide", cancelOnLeave);
    return () => {
      window.removeEventListener("pagehide", cancelOnLeave);
      // Strict Modeの検証用再実行では、直後のeffectがこの送信を取り消す。
      pendingCancellationRef.current = window.setTimeout(cancelOnLeave, 0);
    };
  }, [enabled, matchId]);
}

const secondaryButtonClassName = appButtonClassName.tertiary;
