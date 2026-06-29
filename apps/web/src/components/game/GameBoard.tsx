"use client";

import { DiceDisplay } from "./DiceDisplay";
import { HandResult } from "./HandResult";
import type { GameState, Player, RollResult } from "@/types/game";

interface GameBoardProps {
  state: GameState | null;
  self: Player | null;
  lastRollPlayerId?: string;
  onReady: () => void;
  onRoll: () => void;
  onNextRound: () => void;
}

export function GameBoard({
  state,
  self,
  lastRollPlayerId,
  onReady,
  onRoll,
  onNextRound,
}: GameBoardProps) {
  const banker = state?.players[state.bankerIndex] ?? null;
  const activePlayer = state?.players[state.currentPlayerIndex] ?? null;
  const isMyTurn = Boolean(self && activePlayer?.id === self.id);
  const canRoll =
    Boolean(self) &&
    isMyTurn &&
    (state?.phase === "banker_turn" || state?.phase === "player_turn");

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
