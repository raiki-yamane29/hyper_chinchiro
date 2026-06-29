"use client";

import { useState } from "react";
import { DiceDisplay } from "./DiceDisplay";
import { HandResult } from "./HandResult";
import type { GameState, Player, RollResult } from "@/types/game";

interface GameBoardProps {
  state: GameState | null;
  self: Player | null;
  lastRollPlayerId?: string;
  onReady: () => void;
  onRoll: () => void;
  onUseGodhand: (pinnedValue: number) => void;
  onNextRound: () => void;
}

export function GameBoard({
  state,
  self,
  lastRollPlayerId,
  onReady,
  onRoll,
  onUseGodhand,
  onNextRound,
}: GameBoardProps) {
  const [pinnedValue, setPinnedValue] = useState(6);
  const banker = state?.players[state.bankerIndex] ?? null;
  const activePlayer = state?.players[state.currentPlayerIndex] ?? null;
  const isMyTurn = Boolean(self && activePlayer?.id === self.id);
  const canRoll =
    Boolean(self) &&
    isMyTurn &&
    (state?.phase === "banker_turn" || state?.phase === "player_turn");
  const canUseGodhand =
    canRoll && self?.abilityId === "godhand" && !self.abilityUsedThisRound;

  return (
    <div className="min-h-80 border border-stone-300 bg-white p-5">
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-stone-600">
        <span>Phase: {state?.phase ?? "loading"}</span>
        <span>Round: {state ? `${state.round}/${state.maxRounds}` : "-"}</span>
        <span>親: {banker?.nickname ?? "-"}</span>
        <span>手番: {activePlayer?.nickname ?? "-"}</span>
      </div>

      {self && (
        <div className="mb-5 flex flex-wrap gap-3 border-b border-stone-200 pb-5">
          <button
            className="h-10 bg-stone-900 px-4 text-sm font-semibold text-white disabled:bg-stone-400"
            disabled={self.isReady}
            onClick={onReady}
            type="button"
          >
            Ready
          </button>
          <button
            className="h-10 bg-red-800 px-4 text-sm font-semibold text-white disabled:bg-stone-400"
            disabled={!canRoll}
            onClick={onRoll}
            type="button"
          >
            振る
          </button>
          <button
            className="h-10 border border-stone-400 px-4 text-sm font-semibold disabled:text-stone-400"
            disabled={state?.phase !== "round_result"}
            onClick={onNextRound}
            type="button"
          >
            次ラウンド
          </button>
        </div>
      )}

      {canUseGodhand && (
        <div className="mb-5 grid gap-3 border border-red-200 bg-red-50 p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-2 text-sm font-semibold">
            神の一手
            <select
              className="h-10 border border-red-200 bg-white px-3 text-base outline-none focus:border-red-700"
              onChange={(event) => setPinnedValue(Number(event.target.value))}
              value={pinnedValue}
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <button
            className="h-10 bg-red-800 px-4 text-sm font-semibold text-white"
            onClick={() => onUseGodhand(pinnedValue)}
            type="button"
          >
            固定して振る
          </button>
        </div>
      )}

      <div className="grid gap-4">
        <RollPanel
          player={banker}
          roll={state?.bankerRoll ?? null}
          rolling={lastRollPlayerId === banker?.id}
          title="親の出目"
        />
        {state?.players
          .filter((player) => player.id !== banker?.id)
          .map((player) => (
            <RollPanel
              key={player.id}
              player={player}
              roll={state.playerRolls[player.id] ?? null}
              rolling={lastRollPlayerId === player.id}
              title={`${player.nickname} の出目`}
            />
          ))}
      </div>
    </div>
  );
}

function RollPanel({
  title,
  player,
  roll,
  rolling,
}: {
  title: string;
  player: Player | null;
  roll: RollResult | null;
  rolling: boolean;
}) {
  return (
    <section className="border border-stone-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-600">{title}</h2>
        {player && (
          <span className="text-xs text-stone-500">
            ability {player.abilityId}
          </span>
        )}
      </div>
      <DiceDisplay dice={roll?.dice ?? null} rolling={rolling} />
      <HandResult roll={roll} />
    </section>
  );
}
