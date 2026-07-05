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
  lucky_one: "ラッキーワン",
  trickster: "ラッキーツー",
  lucky_three: "ラッキースリー",
  lucky_four: "ラッキーフォー",
  lucky_five: "ラッキーファイブ",
  lucky_six: "ラッキーシックス",
  no_one: "ピンゾロ封じ",
  chaos: "カオスダイス",
  shigoro: "シゴロ賽",
  hifumi123: "ヒフミ賽",
  gambler: "ギャンブラー",
  godhand: "神の一手",
  double_chance: "ダブルチャンス",
};

const abilityDescriptions: Record<string, string> = {
  lucky_one: "1の出目が出やすくなります。",
  trickster: "2の出目が出やすくなります。",
  lucky_three: "3の出目が出やすくなります。",
  lucky_four: "4の出目が出やすくなります。",
  lucky_five: "5の出目が出やすくなります。",
  lucky_six: "6の出目が出やすくなります。",
  no_one: "1の出目を抑えて、ピンゾロやヒフミに寄りにくくします。",
  chaos: "手番ごとにサイコロの重みがランダムに変わります。",
  shigoro: "4・5・6の目しか出なくなります。",
  hifumi123: "1・2・3の目しか出なくなります。",
  gambler: "自分が絡む精算のポイントの受け渡しが倍になります。",
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
  onReturnToLobby: () => void;
}

export function GameBoard({
  state,
  self,
  lastRollPlayerId,
  onReady,
  onRoll,
  onUseGodhand,
  onNextRound,
  onReturnToLobby,
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
        <div className="mb-5 border-b border-stone-200 pb-5">
          <AbilityCard
            abilityId={activeAbilityId}
            randomMode={state?.abilityMode === "random_turn"}
          />
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

      {self && (
        <ActionBar
          activePlayer={activePlayer}
          canRoll={canRoll}
          isGameOver={isGameOver}
          isMyTurn={isMyTurn}
          onNextRound={onNextRound}
          onReady={onReady}
          onReturnToLobby={onReturnToLobby}
          onRoll={onRoll}
          phase={state?.phase ?? null}
          self={self}
        />
      )}
    </div>
  );
}

function ActionBar({
  activePlayer,
  canRoll,
  isGameOver,
  isMyTurn,
  onNextRound,
  onReady,
  onReturnToLobby,
  onRoll,
  phase,
  self,
}: {
  activePlayer: Player | null;
  canRoll: boolean;
  isGameOver: boolean;
  isMyTurn: boolean;
  onNextRound: () => void;
  onReady: () => void;
  onReturnToLobby: () => void;
  onRoll: () => void;
  phase: GameState["phase"] | null;
  self: Player;
}) {
  let statusText = "";
  let action: { label: string; onClick: () => void; disabled: boolean } | null =
    null;

  if (phase === "lobby" || phase === "ability_select") {
    statusText = "全員がReadyになると開始します";
    action = {
      label: self.isReady ? "Ready済み" : "Ready",
      onClick: onReady,
      disabled: self.isReady,
    };
  } else if (phase === "banker_turn" || phase === "player_turn") {
    if (isMyTurn) {
      statusText = "あなたの番です！";
      action = { label: "振る", onClick: onRoll, disabled: !canRoll };
    } else {
      statusText = `${activePlayer?.nickname ?? "-"} の番です`;
    }
  } else if (phase === "round_result") {
    statusText = "結果を確認したら次へ";
    action = { label: "次ラウンド", onClick: onNextRound, disabled: false };
  } else if (isGameOver) {
    statusText = "ゲーム終了！全員Readyで再戦";
    action = {
      label: self.isReady ? "Ready済み" : "再戦 Ready",
      onClick: onReady,
      disabled: self.isReady,
    };
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-red-800 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <span
          className={[
            "text-sm",
            isMyTurn ? "font-bold text-red-800" : "text-stone-600",
          ].join(" ")}
        >
          {statusText}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {isGameOver && (
            <button
              className="h-14 border border-stone-400 px-4 text-sm font-semibold text-stone-700 transition-transform active:scale-95"
              onClick={onReturnToLobby}
              type="button"
            >
              能力モードに戻る
            </button>
          )}
          {action && (
            <button
              className="h-14 min-w-40 bg-red-800 px-8 text-lg font-bold text-white transition-transform active:scale-95 disabled:bg-stone-400 sm:min-w-56"
              disabled={action.disabled}
              onClick={action.onClick}
              type="button"
            >
              {action.label}
            </button>
          )}
        </div>
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
