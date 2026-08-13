import { useQueryClient } from "@tanstack/react-query";
import type { Faction } from "@disastar/game-engine/contracts";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Crosshair,
  Gamepad2,
  Swords,
} from "lucide-react";
import { useSession } from "../../app/session.ts";
import {
  AppHeader,
  appPageFrameClassName,
} from "../../components/app-header.tsx";
import { getBoardBackgroundImage } from "../game-board/components/game-board-background.ts";
import { AuthApiError, signInAnonymously } from "../auth/auth-api.ts";
import { authSessionQueryKey } from "../auth/auth-routes.tsx";
import { AccountMenu } from "../account/account-menu.tsx";
import { RoomJoinForm } from "./components/room-join-form.tsx";
import { PublicRoomList } from "./components/public-room-list.tsx";
import { notifyMatchmakingError } from "./components/error-notifications.ts";
import { usePublicMatchLobbies } from "./hooks/use-matchmaking-data.ts";
import { createRoomPath } from "./match-id.ts";
import {
  createMatch,
  createStarterDeck,
  getMatchmakingErrorMessage,
} from "./matchmaking-api.ts";

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
  const queryClient = useQueryClient();
  const [isStartingGuestSession, setIsStartingGuestSession] = useState(false);
  const hasNotifiedAuthError = useRef(false);

  useEffect(() => {
    if (!authError || hasNotifiedAuthError.current) {
      return;
    }

    hasNotifiedAuthError.current = true;

    notifyMatchmakingError({
      description:
        "ログイン状態を確認できませんでした。ページを更新して、もう一度お試しください。",
      title: "認証状態を確認できません",
    });
  }, [authError]);

  async function startGuestSession(returnTo: string) {
    setIsStartingGuestSession(true);
    try {
      await signInAnonymously();
      await queryClient.invalidateQueries({ queryKey: authSessionQueryKey });
      navigate(returnTo);
    } catch (requestError) {
      notifyMatchmakingError({
        description: getGuestSignInErrorMessage(requestError),
        title: "ゲストとして開始できません",
      });
    } finally {
      setIsStartingGuestSession(false);
    }
  }

  return (
    <LobbyLayout
      accountSlot={
        <div className="flex items-center gap-3">
          <Link
            className="inline-flex h-10 items-center border border-[#30597b] bg-[linear-gradient(180deg,rgba(19,46,67,.94),rgba(7,20,30,.96))] px-4 text-sm font-medium tracking-[.04em] text-[#d9efff] shadow-[inset_0_1px_0_rgba(201,233,255,.12),0_0_16px_rgba(45,139,205,.08)] transition hover:border-[#65a9d6] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#75bced]"
            to="/login"
          >
            Googleでログイン
          </Link>
        </div>
      }
      title="対戦準備"
    >
      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,.92fr)] lg:items-center">
        <div className="max-w-2xl py-3 lg:py-7">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-medium tracking-[.2em] text-[#5798c9]">
            <Crosshair aria-hidden="true" className="size-3.5" />
            STRATEGIC CARD GAME
          </p>
          <h1 className="max-w-xl text-[clamp(2.3rem,5vw,4.6rem)] font-semibold leading-[1.14] tracking-[-.045em] text-[#edf3f7] [text-shadow:0_2px_16px_rgba(0,0,0,.8)]">
            災害に備え、
            <br />
            今を守るための対戦へ。
          </h1>
          <span className="mt-7 block h-px w-12 bg-[#caa65e]" />
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#9aabb8]">
            招待された対戦部屋に参加し、災害側または対策側として戦略カードゲームを始められます。
          </p>
          <button
            className="mt-8 inline-flex h-14 items-center border border-[#b98d3f] bg-[radial-gradient(circle_at_20%_0%,rgba(255,224,137,.22),transparent_48%),linear-gradient(180deg,rgba(101,74,30,.95),rgba(47,34,17,.98))] px-6 text-[15px] font-semibold tracking-[.08em] text-[#fff0c9] shadow-[inset_0_1px_0_rgba(255,242,202,.3),inset_0_0_0_1px_rgba(39,25,10,.85),0_0_26px_rgba(203,152,56,.13)] transition hover:border-[#f3c968] hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#eac46c]"
            disabled={isStartingGuestSession}
            onClick={() => void startGuestSession("/")}
            type="button"
          >
            <Gamepad2 aria-hidden="true" className="mr-3 size-5" />
            {isStartingGuestSession ? "準備しています" : "ゲストとして始める"}
          </button>
        </div>
        <TacticalPanel
          className="min-h-[340px] p-6 sm:p-7"
          label="QUICK ACCESS"
        >
          <p className="text-[11px] font-medium tracking-[.18em] text-[#65a5d4]">
            INVITATION MATCH
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-[-.03em] text-[#e9f1f5]">
            招待部屋に参加
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#91a5b4]">
            部屋 ID または招待 URL を入力して、ゲストとして参加できます。
          </p>
          <div className="mt-6 border-t border-[#31424f]/70 pt-5">
            <RoomJoinForm
              disabled={isStartingGuestSession}
              onJoin={(matchId) =>
                void startGuestSession(createRoomPath(matchId))
              }
            />
          </div>
        </TacticalPanel>
      </section>
      <HomeFeatureLinks />
    </LobbyLayout>
  );
}

function AuthenticatedLobby() {
  const navigate = useNavigate();
  const publicLobbies = usePublicMatchLobbies();
  const [isCreatingMatch, setIsCreatingMatch] = useState(false);

  async function handleCreateMatch(
    faction: Faction,
    visibility: "invite" | "public",
  ) {
    setIsCreatingMatch(true);
    try {
      const deck = await createStarterDeck(faction);
      const matchId = await createMatch(deck.id, visibility);
      navigate(createRoomPath(matchId));
    } catch (requestError) {
      notifyMatchmakingError({
        description: getMatchmakingErrorMessage(
          requestError,
          "招待部屋を作成できませんでした。もう一度お試しください。",
        ),
        title: "対戦部屋を作成できません",
      });
    } finally {
      setIsCreatingMatch(false);
    }
  }

  return (
    <LobbyLayout accountSlot={<AccountMenu />} title="対戦準備">
      <section className="grid gap-7 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,.92fr)] lg:items-start">
        <div className="py-3 lg:py-7">
          <p className="mb-5 flex items-center gap-2 text-[11px] font-medium tracking-[.2em] text-[#5798c9]">
            <Crosshair aria-hidden="true" className="size-3.5" />
            MATCH COMMAND
          </p>
          <h1 className="max-w-xl text-[clamp(2.3rem,5vw,4.6rem)] font-semibold leading-[1.14] tracking-[-.045em] text-[#edf3f7] [text-shadow:0_2px_16px_rgba(0,0,0,.8)]">
            戦略を選び、
            <br />
            対戦を開始する。
          </h1>
          <span className="mt-7 block h-px w-12 bg-[#caa65e]" />
          <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#9aabb8]">
            使用するロールを選び、招待 URL
            だけで共有するか、部屋一覧へ公開するかを選択します。
          </p>
          <div className="mt-8">
            <RoleActions
              disabled={isCreatingMatch}
              onSelect={(faction, visibility) =>
                void handleCreateMatch(faction, visibility)
              }
            />
          </div>
        </div>
        <div className="grid gap-5">
          <TacticalPanel className="p-6 sm:p-7" label="OPEN MATCHES">
            <PublicRoomList
              error={
                publicLobbies.isError
                  ? getMatchmakingErrorMessage(
                      publicLobbies.error,
                      "公開部屋を取得できませんでした。更新してもう一度お試しください。",
                    )
                  : null
              }
              isLoading={publicLobbies.isPending}
              matches={publicLobbies.data ?? []}
              onRefresh={() => void publicLobbies.refetch()}
              onSelect={(matchId) => navigate(createRoomPath(matchId))}
            />
          </TacticalPanel>
          <TacticalPanel className="p-6" label="JOIN WITH INVITATION">
            <h2 className="text-lg font-semibold text-[#e7eff4]">
              招待部屋に参加
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#91a5b4]">
              招待された部屋 ID または URL を入力してください。
            </p>
            <div className="mt-4">
              <RoomJoinForm
                onJoin={(matchId) => navigate(createRoomPath(matchId))}
              />
            </div>
          </TacticalPanel>
        </div>
      </section>
      <HomeFeatureLinks />
    </LobbyLayout>
  );
}

function getGuestSignInErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError && error.status === 429) {
    return "短時間に多くの操作が行われました。時間をおいてからお試しください。";
  }

  return "ゲストとして開始できませんでした。接続状態を確認して、もう一度お試しください。";
}

export function RoleActions({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (faction: Faction, visibility: "invite" | "public") => void;
}) {
  return (
    <div className="grid max-w-xl gap-4">
      <p className="text-sm leading-6 text-[#92a5b3]">
        使用するロールを選んでください。カード構成はロールごとに固定です。
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border border-[#3a3429] bg-[linear-gradient(145deg,rgba(29,26,18,.82),rgba(7,12,16,.94))] p-4 shadow-[inset_0_1px_0_rgba(255,240,196,.05)]">
          <p className="text-sm font-medium tracking-[.06em] text-[#e3c278]">
            招待のみ
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="h-10 border border-[#aa7d32] bg-[linear-gradient(180deg,rgba(104,75,28,.94),rgba(48,34,16,.96))] px-3 text-sm font-medium text-[#fff0ca] transition hover:border-[#efc767] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eac46c]"
              disabled={disabled}
              onClick={() => onSelect("disaster", "invite")}
              type="button"
            >
              災害側
            </button>
            <button
              className="h-10 border border-[#315b7e] bg-[linear-gradient(180deg,rgba(19,45,66,.96),rgba(6,16,25,.98))] px-3 text-sm font-medium text-[#d6edff] transition hover:border-[#72b7e5] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ac4f3]"
              disabled={disabled}
              onClick={() => onSelect("countermeasure", "invite")}
              type="button"
            >
              対策側
            </button>
          </div>
        </div>
        <div className="border border-[#293f4d] bg-[linear-gradient(145deg,rgba(13,31,44,.84),rgba(6,11,16,.95))] p-4 shadow-[inset_0_1px_0_rgba(209,238,255,.05)]">
          <p className="text-sm font-medium tracking-[.06em] text-[#75b9e5]">
            一覧に公開
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="h-10 border border-[#315b7e] bg-[linear-gradient(180deg,rgba(19,45,66,.96),rgba(6,16,25,.98))] px-3 text-sm font-medium text-[#d6edff] transition hover:border-[#72b7e5] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ac4f3]"
              disabled={disabled}
              onClick={() => onSelect("disaster", "public")}
              type="button"
            >
              災害側
            </button>
            <button
              className="h-10 border border-[#466c4f] bg-[linear-gradient(180deg,rgba(23,57,39,.94),rgba(7,21,15,.98))] px-3 text-sm font-medium text-[#d7f1dc] transition hover:border-[#73bd84] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7ecb91]"
              disabled={disabled}
              onClick={() => onSelect("countermeasure", "public")}
              type="button"
            >
              対策側
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LobbyLayout({
  accountSlot,
  title,
  children,
}: {
  accountSlot: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <main
      className="relative min-h-dvh overflow-x-clip bg-[#03080c] text-[#e6eff4]"
      data-home-surface="tactical"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_52%_10%,rgba(20,56,81,.26),transparent_42%),radial-gradient(ellipse_at_4%_90%,rgba(9,43,63,.2),transparent_36%),linear-gradient(180deg,rgba(3,9,13,.3),rgba(0,3,6,.92)),repeating-linear-gradient(0deg,transparent_0,transparent_47px,rgba(102,147,176,.035)_48px),repeating-linear-gradient(90deg,transparent_0,transparent_47px,rgba(102,147,176,.03)_48px)]"
      />
      <div className="relative">
        <AppHeader rightSlot={accountSlot} />
        <div
          className={`relative isolate ${appPageFrameClassName} py-10 sm:py-14`}
          aria-label={title}
          data-home-hero="true"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-12 -top-20 bottom-20 -z-10 bg-center bg-cover bg-no-repeat opacity-55 [mask-image:radial-gradient(ellipse_68%_64%_at_53%_44%,#000_22%,transparent_74%)] [-webkit-mask-image:radial-gradient(ellipse_68%_64%_at_53%_44%,#000_22%,transparent_74%)] sm:-inset-x-24 sm:-top-28"
            data-home-hero-backdrop="r2"
            style={{ backgroundImage: getBoardBackgroundImage() }}
          />
          <div className="relative">{children}</div>
        </div>
      </div>
    </main>
  );
}

function TacticalPanel({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <section
      className={`relative border border-[#2a3d4b] bg-[radial-gradient(circle_at_80%_0%,rgba(57,112,148,.12),transparent_34%),linear-gradient(145deg,rgba(12,24,33,.96),rgba(3,10,15,.98))] shadow-[inset_0_1px_0_rgba(231,246,255,.08),inset_0_0_36px_rgba(0,0,0,.45),0_20px_45px_rgba(0,0,0,.22)] before:pointer-events-none before:absolute before:inset-[4px] before:border before:border-white/[.035] ${className}`}
    >
      <p className="relative text-[10px] font-medium tracking-[.18em] text-[#608eaa]">
        {label}
      </p>
      <div className="relative">{children}</div>
    </section>
  );
}

function HomeFeatureLinks() {
  const links = [
    {
      to: "/learn",
      icon: BookOpen,
      title: "防災情報",
      description: "災害と備えを、カードに関連づけて学ぶ",
      color: "text-[#7cb9ea]",
    },
    {
      to: "/rule",
      icon: CircleHelp,
      title: "遊び方",
      description: "基本ルールと対戦の進め方を確認する",
      color: "text-[#d6b66d]",
    },
    {
      to: "/mypage",
      icon: Swords,
      title: "マイページ",
      description: "アカウントとこれまでの対戦を確認する",
      color: "text-[#9bc88c]",
    },
  ];
  return (
    <section
      aria-label="その他の機能"
      className="mt-9 grid gap-3 md:grid-cols-3"
    >
      {links.map(({ color, description, icon: Icon, title, to }) => (
        <Link
          className="group relative border border-[#263945] bg-[linear-gradient(145deg,rgba(10,20,28,.92),rgba(4,10,14,.94))] p-5 shadow-[inset_0_1px_0_rgba(231,246,255,.05)] transition hover:-translate-y-0.5 hover:border-[#527895] hover:bg-[#0d1d28] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#75bced] motion-reduce:transform-none"
          key={to}
          to={to}
        >
          <Icon
            aria-hidden="true"
            className={`mb-5 size-7 ${color}`}
            strokeWidth={1.45}
          />
          <h2 className="text-[15px] font-semibold tracking-[.04em] text-[#e0ebf1]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#8fa3b0]">{description}</p>
          <ChevronRight
            aria-hidden="true"
            className="absolute right-4 bottom-4 size-4 text-[#667e8d] transition group-hover:translate-x-0.5 group-hover:text-[#b4d6e9]"
          />
        </Link>
      ))}
    </section>
  );
}
