import type { SavedDeckView } from "@disastar/contracts/deck";
import type { Faction } from "@disastar/game-engine/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { createAuthPath } from "../../app/return-to.ts";
import { useSession } from "../../app/session.ts";
import { LogoutButton } from "../auth/auth-routes.tsx";
import { AuthStatus } from "../auth/auth-layout.tsx";
import { DeckSelector } from "./components/deck-selector.tsx";
import { RoomJoinForm } from "./components/room-join-form.tsx";
import { createRoomPath } from "./match-id.ts";
import {
  createMatch,
  createStarterDeck,
  getMatchmakingErrorMessage,
} from "./matchmaking-api.ts";
import {
  savedDecksQueryKey,
  useSavedDecks,
} from "./hooks/use-matchmaking-data.ts";

export function MatchmakingHomeRoute() {
  const session = useSession();

  if (session.isPending) {
    return <LobbyLayout accountSlot={null} title="対戦準備" />;
  }
  if (session.isError) {
    return <GuestLobby authError />;
  }
  if (session.data === null) {
    return <GuestLobby />;
  }

  return <AuthenticatedLobby />;
}

function GuestLobby({ authError = false }: { authError?: boolean }) {
  const navigate = useNavigate();

  return (
    <LobbyLayout
      accountSlot={
        <div className="flex items-center gap-3">
          <Link
            className="rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/login"
          >
            ログイン
          </Link>
          <Link
            className="rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            to="/register"
          >
            登録
          </Link>
        </div>
      }
      title="対戦準備"
    >
      {authError ? (
        <AuthStatus tone="error">
          ログイン状態を確認できませんでした。ログインまたは登録の前にページを更新してください。
        </AuthStatus>
      ) : null}
      <section className="grid gap-4 border-b border-slate-300 pb-8">
        <div>
          <h1 className="text-2xl font-semibold">招待対戦</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            ログインしてデッキを選び、招待部屋を作成または参加します。
          </p>
        </div>
        <button
          className="w-fit rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          onClick={() => navigate(createAuthPath("/login", "/"))}
          type="button"
        >
          部屋を作成する
        </button>
      </section>
      <section
        className="grid max-w-xl gap-4 py-8"
        aria-labelledby="guest-join-title"
      >
        <div>
          <h2 className="text-lg font-semibold" id="guest-join-title">
            招待部屋に参加
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            部屋 ID または招待 URL
            を入力すると、ログイン後にその部屋へ戻ります。
          </p>
        </div>
        <RoomJoinForm
          onJoin={(matchId) =>
            navigate(createAuthPath("/login", createRoomPath(matchId)))
          }
        />
      </section>
    </LobbyLayout>
  );
}

function AuthenticatedLobby() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const decks = useSavedDecks();
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [isCreatingStarter, setIsCreatingStarter] = useState(false);
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (decks.data === undefined) {
      return;
    }
    if (
      selectedDeckId === null ||
      !decks.data.some((deck) => deck.id === selectedDeckId)
    ) {
      setSelectedDeckId(decks.data[0]?.id ?? null);
    }
  }, [decks.data, selectedDeckId]);

  async function handleCreateStarterDeck(faction: Faction) {
    setError(null);
    setIsCreatingStarter(true);
    try {
      const deck = await createStarterDeck(faction);
      queryClient.setQueryData<readonly SavedDeckView[]>(
        savedDecksQueryKey,
        (current) => [...(current ?? []), deck],
      );
      setSelectedDeckId(deck.id);
    } catch (requestError) {
      setError(
        getMatchmakingErrorMessage(
          requestError,
          "スターターデッキを作成できませんでした。もう一度お試しください。",
        ),
      );
    } finally {
      setIsCreatingStarter(false);
    }
  }

  async function handleCreateMatch() {
    if (selectedDeckId === null) {
      return;
    }

    setError(null);
    setIsCreatingMatch(true);
    try {
      const matchId = await createMatch(selectedDeckId);
      navigate(createRoomPath(matchId));
    } catch (requestError) {
      setError(
        getMatchmakingErrorMessage(
          requestError,
          "招待部屋を作成できませんでした。もう一度お試しください。",
        ),
      );
    } finally {
      setIsCreatingMatch(false);
    }
  }

  return (
    <LobbyLayout
      accountSlot={
        <LogoutButton className="rounded border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900" />
      }
      title="対戦準備"
    >
      <section className="grid gap-4 border-b border-slate-300 pb-8">
        <div>
          <h1 className="text-2xl font-semibold">招待対戦</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            使用する保存済みデッキを選んで、対戦相手へ招待 URL を送ります。
          </p>
        </div>
        {error === null ? null : <AuthStatus tone="error">{error}</AuthStatus>}
        {decks.isPending ? (
          <p className="text-sm text-slate-600">
            保存済みデッキを読み込んでいます。
          </p>
        ) : decks.isError || decks.data === undefined ? (
          <AuthStatus tone="error">
            保存済みデッキを取得できませんでした。ページを更新してください。
          </AuthStatus>
        ) : decks.data.length === 0 ? (
          <StarterDeckActions
            disabled={isCreatingStarter}
            onCreate={handleCreateStarterDeck}
          />
        ) : (
          <div className="grid max-w-xl gap-3">
            <DeckSelector
              decks={decks.data}
              disabled={isCreatingMatch}
              onSelect={setSelectedDeckId}
              selectedDeckId={selectedDeckId}
            />
            <button
              className="w-fit rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
              disabled={selectedDeckId === null || isCreatingMatch}
              onClick={() => void handleCreateMatch()}
              type="button"
            >
              {isCreatingMatch ? "部屋を作成しています" : "部屋を作成する"}
            </button>
          </div>
        )}
      </section>
      <section
        className="grid max-w-xl gap-4 py-8"
        aria-labelledby="member-join-title"
      >
        <div>
          <h2 className="text-lg font-semibold" id="member-join-title">
            招待部屋に参加
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            招待された部屋 ID または URL を入力してください。
          </p>
        </div>
        <RoomJoinForm onJoin={(matchId) => navigate(createRoomPath(matchId))} />
      </section>
    </LobbyLayout>
  );
}

function StarterDeckActions({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: (faction: Faction) => void;
}) {
  return (
    <div className="grid max-w-xl gap-3">
      <p className="text-sm leading-6 text-slate-600">
        保存済みデッキがありません。スターターデッキを作成してください。
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-100 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          disabled={disabled}
          onClick={() => void onCreate("disaster")}
          type="button"
        >
          災害側スターターデッキを作成
        </button>
        <button
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          disabled={disabled}
          onClick={() => void onCreate("countermeasure")}
          type="button"
        >
          対策側スターターデッキを作成
        </button>
      </div>
    </div>
  );
}

function LobbyLayout({
  accountSlot,
  title,
  children,
}: {
  accountSlot: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-slate-100 p-6 text-slate-950">
      <div className="mx-auto w-full max-w-5xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-300 py-4">
          <p className="text-sm font-semibold text-slate-700">
            DISASTAR CARD GAME
          </p>
          {accountSlot}
        </header>
        <div className="py-10" aria-label={title}>
          {children}
        </div>
      </div>
    </main>
  );
}
