"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AbilitySelector } from "@/components/lobby/AbilitySelector";
import { GameBoard } from "@/components/game/GameBoard";
import { PlayerList } from "@/components/game/PlayerList";
import { useGameState } from "@/hooks/useGameState";
import { usePartySocket } from "@/hooks/usePartySocket";

interface RoomClientProps {
  roomId: string;
}

export function RoomClient({ roomId }: RoomClientProps) {
  const searchParams = useSearchParams();
  const initialNickname = searchParams.get("nickname") ?? "";
  const initialAbility = searchParams.get("abilityId") ?? "trickster";
  const [nickname, setNickname] = useState(initialNickname);
  const [abilityId, setAbilityId] = useState(initialAbility);
  const { socket, status } = usePartySocket({ roomId });
  const { state, lastRoll, error, send } = useGameState(socket);

  const me = useMemo(() => {
    if (!state || !socket) {
      return null;
    }

    return state.players.find((player) => player.id === socket.id) ?? null;
  }, [socket, state]);

  return (
    <main className="min-h-screen bg-[#f7f2e8] text-stone-950">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-2 border-b border-stone-300 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Room {roomId}</p>
            <h1 className="text-3xl font-bold tracking-normal">Hyper Chinchiro</h1>
          </div>
          <span className="text-sm text-stone-600">接続: {status}</span>
        </header>

        {!me && (
          <form
            className="grid gap-4 border border-stone-300 bg-white p-4 shadow-sm"
            onSubmit={(event) => {
              event.preventDefault();
              send({ type: "join", nickname, abilityId });
            }}
          >
            <div className="grid gap-4 md:grid-cols-[minmax(220px,0.7fr)_1.3fr]">
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
              <AbilitySelector value={abilityId} onChange={setAbilityId} />
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
