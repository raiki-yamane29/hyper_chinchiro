"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useGameState } from "@/hooks/useGameState";
import { usePartySocket } from "@/hooks/usePartySocket";

const abilities = [
  ["trickster", "イカサマ師"],
  ["lucky_six", "ラッキーシックス"],
  ["all_high", "オールフォア"],
  ["no_one", "ピンゾロ封じ"],
  ["chaos", "カオスダイス"],
  ["mirror", "ミラーロール"],
  ["godhand", "神の一手"],
  ["double_chance", "ダブルチャンス"],
] as const;

interface RoomClientProps {
  roomId: string;
}

export function RoomClient({ roomId }: RoomClientProps) {
  const searchParams = useSearchParams();
  const initialNickname = searchParams.get("nickname") ?? "";
  const initialAbility = searchParams.get("abilityId") ?? "trickster";
  const [nickname, setNickname] = useState(initialNickname);
  const [abilityId, setAbilityId] = useState(initialAbility);
  const [joined, setJoined] = useState(false);
  const { socket, status } = usePartySocket({ roomId });
  const { state, lastRoll, error, send } = useGameState(socket);

  const me = useMemo(() => {
    if (!state || !socket) {
      return null;
    }

    return state.players.find((player) => player.id === socket.id) ?? null;
  }, [socket, state]);

  const activePlayer = state?.players[state.currentPlayerIndex];
  const banker = state?.players[state.bankerIndex];

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
            className="grid gap-4 border border-stone-300 bg-white p-4 shadow-sm sm:grid-cols-[1fr_220px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const sent = send({ type: "join", nickname, abilityId });
              if (sent) {
                setJoined(true);
              }
            }}
          >
            <label className="grid gap-2 text-sm font-medium">
              ニックネーム
              <input
                className="h-11 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
                maxLength={24}
                required
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              能力
              <select
                className="h-11 border border-stone-300 bg-white px-3 text-base outline-none focus:border-red-700"
                value={abilityId}
                onChange={(event) => setAbilityId(event.target.value)}
              >
                {abilities.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="h-11 self-end bg-red-800 px-5 font-semibold text-white disabled:bg-stone-400"
              disabled={status !== "open" || !nickname.trim()}
              type="submit"
            >
              参加
            </button>
          </form>
        )}

        {me && (
          <section className="flex flex-wrap items-center gap-3 border border-stone-300 bg-white p-4">
            <span className="font-semibold">{me.nickname}</span>
            <span className="text-sm text-stone-600">能力: {me.abilityId}</span>
            <button
              className="h-10 bg-stone-900 px-4 text-sm font-semibold text-white disabled:bg-stone-400"
              disabled={me.isReady}
              onClick={() => send({ type: "ready" })}
              type="button"
            >
              Ready
            </button>
            <button
              className="h-10 bg-red-800 px-4 text-sm font-semibold text-white"
              onClick={() => send({ type: "roll" })}
              type="button"
            >
              振る
            </button>
            <button
              className="h-10 border border-stone-400 px-4 text-sm font-semibold"
              onClick={() => send({ type: "next_round" })}
              type="button"
            >
              次ラウンド
            </button>
          </section>
        )}

        {error && <p className="text-sm font-medium text-red-800">{error}</p>}
        {joined && !me && (
          <p className="text-sm text-stone-600">参加情報を送信しました。</p>
        )}

        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-h-80 border border-stone-300 bg-white p-5">
            <div className="mb-5 flex flex-wrap gap-4 text-sm text-stone-600">
              <span>Phase: {state?.phase ?? "loading"}</span>
              <span>
                Round: {state ? `${state.round}/${state.maxRounds}` : "-"}
              </span>
              <span>親: {banker?.nickname ?? "-"}</span>
              <span>手番: {activePlayer?.nickname ?? "-"}</span>
            </div>

            <div className="grid gap-4">
              <RollPanel title="親の出目" roll={state?.bankerRoll ?? null} />
              {state?.players
                .filter((player) => player.id !== banker?.id)
                .map((player) => (
                  <RollPanel
                    key={player.id}
                    title={`${player.nickname} の出目`}
                    roll={state.playerRolls[player.id] ?? null}
                  />
                ))}
            </div>

            {lastRoll && (
              <p className="mt-4 text-sm text-stone-600">
                最新: {lastRoll.result.dice.join(" / ")}
              </p>
            )}
          </div>

          <aside className="border border-stone-300 bg-white p-5">
            <h2 className="mb-3 text-lg font-bold">Players</h2>
            <div className="grid gap-2">
              {state?.players.map((player) => (
                <div
                  className="flex items-center justify-between border-b border-stone-200 py-2 text-sm"
                  key={player.id}
                >
                  <span>{player.nickname}</span>
                  <span className="font-semibold">
                    {state.scores[player.id] ?? 0} pt
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function RollPanel({
  title,
  roll,
}: {
  title: string;
  roll: { dice: [number, number, number]; hand: string } | null;
}) {
  return (
    <div className="border border-stone-200 p-4">
      <h2 className="mb-3 text-sm font-semibold text-stone-600">{title}</h2>
      <div className="flex gap-2">
        {(roll?.dice ?? ["-", "-", "-"]).map((value, index) => (
          <span
            className="grid size-14 place-items-center border border-stone-400 bg-[#fffaf0] text-xl font-bold"
            key={`${value}-${index}`}
          >
            {value}
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-600">役: {roll?.hand ?? "-"}</p>
    </div>
  );
}
