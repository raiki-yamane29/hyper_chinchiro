"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AbilitySelector } from "@/components/lobby/AbilitySelector";
import { GameBoard } from "@/components/game/GameBoard";
import { PlayerList } from "@/components/game/PlayerList";
import { useGameState } from "@/hooks/useGameState";
import { usePartySocket } from "@/hooks/usePartySocket";
import type { AbilityMode } from "@/types/game";

interface RoomClientProps {
  roomId: string;
}

export function RoomClient({ roomId }: RoomClientProps) {
  const searchParams = useSearchParams();
  const initialNickname = searchParams.get("nickname") ?? "";
  const initialAbility = searchParams.get("abilityId") ?? "trickster";
  const [nickname, setNickname] = useState(initialNickname);
  const [abilityId, setAbilityId] = useState(initialAbility);
  const [selectedAbilityMode, setSelectedAbilityMode] =
    useState<AbilityMode>("random_turn");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );
  const { socket, status } = usePartySocket({ roomId });
  const { state, lastRoll, error, send } = useGameState(socket);
  const roomHasPlayers = Boolean(state?.players.length);
  const effectiveAbilityMode = roomHasPlayers
    ? (state?.abilityMode ?? "random_turn")
    : selectedAbilityMode;

  const me = useMemo(() => {
    if (!state || !socket) {
      return null;
    }

    return state.players.find((player) => player.id === socket.id) ?? null;
  }, [socket, state]);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }

    const timeout = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyRoomId = async () => {
    try {
      await copyText(roomId);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-950">
      {/* pb-32: 画面下部固定のアクションバーと重ならないための余白 */}
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pt-8 pb-32 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-stone-300 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal">Hyper Chinchiro</h1>
            <p className="mt-1 text-sm text-stone-600">接続: {status}</p>
          </div>
          <div className="grid gap-2 border-2 border-red-800 bg-white p-3 shadow-sm sm:min-w-80">
            <span className="text-xs font-bold uppercase tracking-normal text-red-800">
              Room ID
            </span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <code className="select-all break-all font-mono text-2xl font-bold text-stone-950">
                {roomId}
              </code>
              <button
                className="h-10 shrink-0 bg-red-800 px-4 text-sm font-semibold text-white"
                onClick={copyRoomId}
                type="button"
              >
                {copyState === "copied"
                  ? "コピー済み"
                  : copyState === "failed"
                    ? "失敗"
                    : "コピー"}
              </button>
            </div>
          </div>
        </header>

        {!me && (
          <form
            className="grid gap-4 border border-stone-300 bg-white p-4 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              send({
                type: "join",
                nickname,
                abilityId,
                abilityMode: effectiveAbilityMode,
              });
            }}
          >
            <div
              className={[
                "grid gap-4",
                effectiveAbilityMode === "selected"
                  ? "md:grid-cols-[minmax(220px,0.7fr)_1.3fr]"
                  : "",
              ].join(" ")}
            >
              <label className="grid content-start gap-2 text-sm font-medium">
                ニックネーム
                <input
                  className="h-11 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
                  maxLength={24}
                  required
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                />
              </label>
              <fieldset className="grid content-start gap-2 text-sm font-medium">
                <legend>能力モード</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={[
                      "cursor-pointer border p-3",
                      effectiveAbilityMode === "random_turn"
                        ? "border-red-800 bg-red-50"
                        : "border-stone-300 bg-white",
                      roomHasPlayers ? "cursor-not-allowed opacity-70" : "",
                    ].join(" ")}
                  >
                    <input
                      checked={effectiveAbilityMode === "random_turn"}
                      className="sr-only"
                      disabled={roomHasPlayers}
                      name="abilityMode"
                      onChange={() => setSelectedAbilityMode("random_turn")}
                      type="radio"
                      value="random_turn"
                    />
                    <span className="font-semibold">ランダム</span>
                  </label>
                  <label
                    className={[
                      "cursor-pointer border p-3",
                      effectiveAbilityMode === "selected"
                        ? "border-red-800 bg-red-50"
                        : "border-stone-300 bg-white",
                      roomHasPlayers ? "cursor-not-allowed opacity-70" : "",
                    ].join(" ")}
                  >
                    <input
                      checked={effectiveAbilityMode === "selected"}
                      className="sr-only"
                      disabled={roomHasPlayers}
                      name="abilityMode"
                      onChange={() => setSelectedAbilityMode("selected")}
                      type="radio"
                      value="selected"
                    />
                    <span className="font-semibold">選択固定</span>
                  </label>
                </div>
              </fieldset>
              {effectiveAbilityMode === "selected" ? (
                <AbilitySelector value={abilityId} onChange={setAbilityId} />
              ) : (
                <div className="grid content-start gap-2 border border-red-200 bg-red-50 p-4 text-sm">
                  <span className="font-semibold">毎ターンランダム能力</span>
                  <span className="leading-6 text-stone-700">
                    このルームでは手番ごとに能力が自動で決まります。
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                className="h-11 bg-red-800 px-5 font-semibold text-white disabled:bg-stone-400"
                disabled={status !== "open" || !nickname.trim()}
                type="submit"
              >
                参加
              </button>
            </div>
          </form>
        )}

        {error && <p className="text-sm font-medium text-red-800">{error}</p>}
        <p className="text-sm text-stone-600">
          能力モード:{" "}
          {effectiveAbilityMode === "random_turn"
            ? "毎ターンランダム"
            : "選択固定"}
        </p>

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <GameBoard
            lastRollPlayerId={lastRoll?.playerId}
            onNextRound={() => send({ type: "next_round" })}
            onReady={() => send({ type: "ready" })}
            onRoll={() => send({ type: "roll" })}
            onUseGodhand={(pinnedValue) =>
              send({ type: "use_active_ability", payload: { pinnedValue } })
            }
            self={me}
            state={state}
          />
          <PlayerList selfId={socket?.id} state={state} />
        </section>
      </div>
    </main>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("copy failed");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
