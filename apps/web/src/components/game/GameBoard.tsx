"use client";

import { useState } from "react";
import { DiceDisplay } from "./DiceDisplay";
import { HandResult } from "./HandResult";
import type {
  GameState,
  Player,
  RollResult,
  RoundSettlement,
} from "@/types/game";

const abilityNames: Record<string, string> = {
  trickster: "イカサマ師",
  lucky_six: "ラッキーシックス",
  all_high: "オールフォア",
  no_one: "ピンゾロ封じ",
  chaos: "カオスダイス",
  mirror: "ミラーロール",
  godhand: "神の一手",
  double_chance: "ダブルチャンス",
};

const abilityDescriptions: Record<string, string> = {
  trickster: "2の出目が出やすくなります。",
  lucky_six: "6の出目が出やすくなります。",
  all_high: "4・5・6の出目が出やすくなります。",
  no_one: "1の出目を抑えて、ピンゾロやヒフミに寄りにくくします。",
  chaos: "手番ごとにサイコロの重みがランダムに変わります。",
  mirror: "直前の相手の出目に寄りやすくなります。",
  godhand: "1ラウンド1回だけ、サイコロ1個を任意の目に固定できます。",
  double_chance: "役なし時の振り直し上限が1回増えます。",
};

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
  const activeAbilityId = self ? getEffectiveAbilityId(state, self) : null;
  const activeTurnAbilityId = activePlayer
    ? getEffectiveAbilityId(state, activePlayer)
    : null;
  const canRoll =
    Boolean(self) &&
    isMyTurn &&
    (state?.phase === "banker_turn" || state?.phase === "player_turn");
  const canUseGodhand =
    canRoll && activeAbilityId === "godhand" && !self?.abilityUsedThisRound;
  const isGameOver = state?.phase === "game_over";
  const bankerRoundDelta = banker
    ? Object.values(state?.roundSettlements ?? {}).reduce(
        (total, settlement) => total + settlement.bankerDelta,
        0,
      )
    : 0;

  return (
    <div
      className={[
        "min-h-80 border bg-white p-5",
        isMyTurn
          ? "border-2 border-red-800 shadow-[0_0_0_4px_rgba(153,27,27,0.12)]"
          : "border-stone-300",
      ].join(" ")}
    >
      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-stone-600">
        <span>Phase: {state?.phase ?? "loading"}</span>
        <span>Round: {state ? `${state.round}/${state.maxRounds}` : "-"}</span>
        <span>親: {banker?.nickname ?? "-"}</span>
        <span>手番: {activePlayer?.nickname ?? "-"}</span>
        {state?.abilityMode === "random_turn" && activeTurnAbilityId && (
          <span>
            今の能力: {abilityNames[activeTurnAbilityId] ?? activeTurnAbilityId}
          </span>
        )}
      </div>

      {self && (
        <div className="mb-5 grid gap-4 border-b border-stone-200 pb-5 lg:grid-cols-[1fr_auto] lg:items-start">
          <AbilityCard
            abilityId={activeAbilityId}
            randomMode={state?.abilityMode === "random_turn"}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="h-10 bg-stone-900 px-4 text-sm font-semibold text-white disabled:bg-stone-400"
              disabled={self.isReady}
              onClick={onReady}
              type="button"
            >
              {isGameOver ? "再戦 Ready" : "Ready"}
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
          isActive={activePlayer?.id === banker?.id}
          isBanker
          player={banker}
          roll={state?.bankerRoll ?? null}
          rolling={lastRollPlayerId === banker?.id}
          settlementSummary={
            state?.phase === "round_result" || state?.phase === "game_over"
              ? {
                  label: "ラウンド合計",
                  delta: bankerRoundDelta,
                }
              : null
          }
          state={state}
        />
        {state?.players
          .filter((player) => player.id !== banker?.id)
          .map((player) => (
            <RollPanel
              isActive={activePlayer?.id === player.id}
              isBanker={false}
              key={player.id}
              player={player}
              roll={state.playerRolls[player.id] ?? null}
              rolling={lastRollPlayerId === player.id}
              settlement={state.roundSettlements[player.id] ?? null}
              state={state}
            />
          ))}
      </div>
    </div>
  );
}

function RollPanel({
  isActive,
  isBanker,
  player,
  roll,
  rolling,
  settlement,
  settlementSummary,
  state,
}: {
  isActive: boolean;
  isBanker: boolean;
  player: Player | null;
  roll: RollResult | null;
  rolling: boolean;
  settlement?: RoundSettlement | null;
  settlementSummary?: { label: string; delta: number } | null;
  state: GameState | null;
}) {
  const title = player
    ? `${player.nickname}${isBanker ? "(親)" : ""} の出目`
    : "出目";
  const abilityId = player ? getEffectiveAbilityId(state, player) : null;

  return (
    <section
      className={[
        "border p-4",
        isActive ? "border-red-800 bg-red-50" : "border-stone-200",
      ].join(" ")}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-stone-700">{title}</h2>
        {abilityId && (
          <span className="text-xs text-stone-500">
            ability {abilityNames[abilityId] ?? abilityId}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <DiceDisplay dice={roll?.dice ?? null} rolling={rolling} />
          <HandResult roll={roll} />
        </div>
        <SettlementDisplay
          playerId={player?.id ?? null}
          settlement={settlement}
          summary={settlementSummary}
        />
      </div>
    </section>
  );
}

function SettlementDisplay({
  playerId,
  settlement,
  summary,
}: {
  playerId: string | null;
  settlement?: RoundSettlement | null;
  summary?: { label: string; delta: number } | null;
}) {
  if (summary) {
    return (
      <PointDeltaCard
        delta={summary.delta}
        label={summary.label}
        reason={summary.delta === 0 ? "移動なし" : ""}
      />
    );
  }

  if (!settlement || !playerId) {
    return null;
  }

  const delta =
    playerId === settlement.bankerId
      ? settlement.bankerDelta
      : settlement.playerDelta;

  return (
    <PointDeltaCard
      delta={delta}
      label={delta >= 0 ? "獲得" : "支払い"}
      reason={settlement.reason}
    />
  );
}

function PointDeltaCard({
  delta,
  label,
  reason,
}: {
  delta: number;
  label: string;
  reason: string;
}) {
  const positive = delta > 0;
  const neutral = delta === 0;

  return (
    <div
      className={[
        "grid min-w-32 gap-1 border p-3 text-right text-sm",
        positive
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : neutral
            ? "border-stone-200 bg-stone-50 text-stone-600"
            : "border-red-300 bg-red-50 text-red-800",
      ].join(" ")}
    >
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-2xl font-bold">
        {delta > 0 ? "+" : ""}
        {delta}pt
      </span>
      {reason && <span className="text-xs">{reason}</span>}
    </div>
  );
}

function AbilityCard({
  abilityId,
  randomMode,
}: {
  abilityId: string | null;
  randomMode: boolean;
}) {
  if (!abilityId) {
    return (
      <section className="grid gap-1 border border-stone-200 bg-stone-50 p-4 text-sm">
        <span className="text-xs font-semibold uppercase tracking-normal text-stone-500">
          Ability
        </span>
        <h2 className="text-base font-bold text-stone-800">
          {randomMode ? "手番で決定" : "未選択"}
        </h2>
        <p className="leading-6 text-stone-600">
          {randomMode
            ? "毎ターンランダムモードでは、自分の手番になると能力が表示されます。"
            : "能力を選択して参加してください。"}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-1 border-2 border-red-800 bg-red-50 p-4 text-sm">
      <span className="text-xs font-semibold uppercase tracking-normal text-red-800">
        Ability
      </span>
      <h2 className="text-base font-bold text-stone-950">
        {abilityNames[abilityId] ?? abilityId}
      </h2>
      <p className="leading-6 text-stone-700">
        {abilityDescriptions[abilityId] ?? ""}
      </p>
    </section>
  );
}

function getEffectiveAbilityId(
  state: GameState | null,
  player: Player,
): string | null {
  if (state?.abilityMode === "random_turn") {
    return state.currentTurnAbilityMap[player.id] ?? null;
  }

  return player.abilityId;
}
