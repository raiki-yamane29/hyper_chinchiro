"use client";

import { useState } from "react";
import { abilities } from "@/components/lobby/AbilitySelector";
import { useGameState } from "@/hooks/useGameState";
import { usePartySocket } from "@/hooks/usePartySocket";
import { DEBUG_KEY } from "@/types/game";

const abilityNames = new Map(abilities.map((a) => [a.id as string, a.name]));

export default function DebugPage() {
  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomId, setRoomId] = useState("");

  return (
    <main className="min-h-screen bg-[#f7f2e8] p-6 text-stone-950">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <header>
          <h1 className="text-2xl font-bold">検証コンソール</h1>
          <p className="mt-1 text-sm text-stone-600">
            出目と能力を操作できます。このURLを知っている人だけが使えます。
          </p>
        </header>

        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setRoomId(roomIdInput.trim());
          }}
        >
          <input
            className="h-11 flex-1 border border-stone-300 bg-white px-3 outline-none focus:border-red-700"
            placeholder="ルームID（例: Ab3xK9pQ）"
            value={roomIdInput}
            onChange={(event) => setRoomIdInput(event.target.value)}
          />
          <button
            className="h-11 bg-red-800 px-5 font-semibold text-white disabled:bg-stone-400"
            disabled={!roomIdInput.trim()}
            type="submit"
          >
            接続
          </button>
        </form>

        {roomId && <DebugConsole key={roomId} roomId={roomId} />}
      </div>
    </main>
  );
}

function DebugConsole({ roomId }: { roomId: string }) {
  const { socket, status } = usePartySocket({ roomId });
  const { state, error, send } = useGameState(socket);
  const [dice, setDice] = useState<[number, number, number]>([4, 5, 6]);
  const [abilityId, setAbilityId] = useState(abilities[0].id as string);

  if (status !== "open" || !state) {
    return (
      <p className="text-sm text-stone-600">
        接続中… ({status}) — ルームIDが正しいか確認してください
      </p>
    );
  }

  const banker = state.players[state.bankerIndex];
  const active = state.players[state.currentPlayerIndex];

  return (
    <div className="grid gap-5">
      <section className="border border-stone-300 bg-white p-4 text-sm">
        <h2 className="mb-2 font-bold">ルーム状態</h2>
        <div className="flex flex-wrap gap-4 text-stone-700">
          <span>Phase: {state.phase}</span>
          <span>
            Round: {state.round}/{state.maxRounds}
          </span>
          <span>親: {banker?.nickname ?? "-"}</span>
          <span>手番: {active?.nickname ?? "-"}</span>
          <span>
            モード: {state.abilityMode === "random_turn" ? "ランダム" : "選択固定"}
          </span>
        </div>
        {error && <p className="mt-2 text-red-800">{error}</p>}
      </section>

      {state.players.length === 0 && (
        <p className="text-sm text-stone-600">プレイヤーがいません。</p>
      )}

      {state.players.map((player) => {
        const forced = state.debugNextRolls[player.id];
        const effectiveAbility =
          state.abilityMode === "random_turn"
            ? (state.currentTurnAbilityMap[player.id] ?? "(手番待ち)")
            : player.abilityId;

        return (
          <section
            className="grid gap-3 border border-stone-300 bg-white p-4"
            key={player.id}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">
                {player.nickname}
                {player.id === banker?.id ? "（親）" : ""}
                {player.id === active?.id ? " ← 手番" : ""}
              </h3>
              <span className="text-xs text-stone-500">
                能力: {abilityNames.get(effectiveAbility) ?? effectiveAbility} /
                スコア: {state.scores[player.id] ?? 0}pt
              </span>
            </div>

            {forced && (
              <p className="border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                次の出目を [{forced.join(", ")}] に固定中
              </p>
            )}

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <select
                    className="h-10 w-14 border border-stone-300 bg-white text-center"
                    key={i}
                    value={dice[i]}
                    onChange={(event) => {
                      const next: [number, number, number] = [...dice];
                      next[i] = Number(event.target.value);
                      setDice(next);
                    }}
                  >
                    {[1, 2, 3, 4, 5, 6].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
              <button
                className="h-10 bg-red-800 px-4 text-sm font-semibold text-white"
                onClick={() =>
                  send({
                    type: "debug_set_next_roll",
                    key: DEBUG_KEY,
                    playerId: player.id,
                    dice,
                  })
                }
                type="button"
              >
                次の出目を固定
              </button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <select
                className="h-10 border border-stone-300 bg-white px-2"
                value={abilityId}
                onChange={(event) => setAbilityId(event.target.value)}
              >
                {abilities.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <button
                className="h-10 border border-stone-400 px-4 text-sm font-semibold"
                onClick={() =>
                  send({
                    type: "debug_set_ability",
                    key: DEBUG_KEY,
                    playerId: player.id,
                    abilityId,
                  })
                }
                type="button"
              >
                能力を変更
              </button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
