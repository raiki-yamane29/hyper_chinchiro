"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import PartySocket from "partysocket";
import { abilities } from "@/components/lobby/AbilitySelector";
import { useGameState } from "@/hooks/useGameState";
import { usePartySocket } from "@/hooks/usePartySocket";
import {
  DEBUG_KEY,
  type AbilityMode,
  type ClientMessage,
  type GameState,
  type Player,
} from "@/types/game";

const HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
const abilityNames = new Map(abilities.map((a) => [a.id as string, a.name]));

export default function DebugPage() {
  const [roomIdInput, setRoomIdInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  // ページを開いた時点で検証用ルームを自動生成する
  useEffect(() => {
    setRoomId(nanoid(8));
  }, []);

  useEffect(() => {
    if (copyState === "idle") {
      return;
    }
    const timeout = window.setTimeout(() => setCopyState("idle"), 1800);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const roomUrl =
    roomId && typeof window !== "undefined"
      ? `${window.location.origin}/room/${roomId}`
      : "";

  return (
    <main className="min-h-screen bg-[#f7f2e8] p-6 text-stone-950">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <header>
          <h1 className="text-2xl font-bold">検証コンソール</h1>
          <p className="mt-1 text-sm text-stone-600">
            1人でダミープレイヤーを追加し、出目・能力・行動を操作できます。
          </p>
        </header>

        <section className="grid gap-3 border-2 border-red-800 bg-white p-4">
          <span className="text-xs font-bold uppercase text-red-800">
            検証ルーム
          </span>
          <div className="flex flex-wrap items-center gap-3">
            <code className="select-all font-mono text-xl font-bold">
              {roomId || "生成中…"}
            </code>
            <button
              className="h-10 bg-red-800 px-4 text-sm font-semibold text-white"
              disabled={!roomUrl}
              onClick={async () => {
                await navigator.clipboard.writeText(roomUrl);
                setCopyState("copied");
              }}
              type="button"
            >
              {copyState === "copied" ? "コピー済み" : "ルームURLをコピー"}
            </button>
            {roomUrl && (
              <a
                className="flex h-10 items-center border border-stone-400 px-4 text-sm font-semibold"
                href={roomUrl}
                rel="noreferrer"
                target="_blank"
              >
                ルームを開く
              </a>
            )}
            <button
              className="h-10 border border-stone-400 px-4 text-sm font-semibold"
              onClick={() => setRoomId(nanoid(8))}
              type="button"
            >
              作り直す
            </button>
          </div>
        </section>

        <form
          className="flex gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setRoomId(roomIdInput.trim());
            setRoomIdInput("");
          }}
        >
          <input
            className="h-11 flex-1 border border-stone-300 bg-white px-3 outline-none focus:border-red-700"
            placeholder="既存のルームIDに接続する場合はここに入力"
            value={roomIdInput}
            onChange={(event) => setRoomIdInput(event.target.value)}
          />
          <button
            className="h-11 border border-stone-400 px-5 font-semibold disabled:text-stone-400"
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

interface Dummy {
  id: string;
  socket: PartySocket;
}

function DebugConsole({ roomId }: { roomId: string }) {
  const { socket, status } = usePartySocket({ roomId });
  const { state, error, send } = useGameState(socket);
  const [dummies, setDummies] = useState<Dummy[]>([]);
  const dummiesRef = useRef<Dummy[]>([]);
  const dummySeq = useRef(1);
  const [newAbilityId, setNewAbilityId] = useState(abilities[0].id as string);
  const [newAbilityMode, setNewAbilityMode] =
    useState<AbilityMode>("selected");

  // アンマウント時（ルーム切替含む）に全ダミー接続を切断してルームから退出させる
  useEffect(() => {
    return () => {
      for (const dummy of dummiesRef.current) {
        dummy.socket.close();
      }
      dummiesRef.current = [];
    };
  }, []);

  const addDummy = () => {
    const nickname = `BOT-${dummySeq.current++}`;
    const dummySocket = new PartySocket({
      host: HOST,
      party: "chinchiro-server",
      room: roomId,
    });
    // partysocket は接続前の送信をバッファするため即送信でよい
    const joinMessage: ClientMessage = {
      type: "join",
      nickname,
      abilityId: newAbilityId,
      abilityMode: newAbilityMode,
    };
    dummySocket.send(JSON.stringify(joinMessage));
    const next = [...dummiesRef.current, { id: dummySocket.id, socket: dummySocket }];
    dummiesRef.current = next;
    setDummies(next);
  };

  const removeDummy = (id: string) => {
    const target = dummiesRef.current.find((dummy) => dummy.id === id);
    target?.socket.close();
    const next = dummiesRef.current.filter((dummy) => dummy.id !== id);
    dummiesRef.current = next;
    setDummies(next);
  };

  const actAs = (id: string, message: ClientMessage) => {
    const dummy = dummiesRef.current.find((d) => d.id === id);
    if (dummy) {
      dummy.socket.send(JSON.stringify(message));
    }
  };

  if (status !== "open" || !state) {
    return <p className="text-sm text-stone-600">接続中… ({status})</p>;
  }

  const banker = state.players[state.bankerIndex];
  const active = state.players[state.currentPlayerIndex];
  const dummyIds = new Set(dummies.map((dummy) => dummy.id));

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

      <section className="grid gap-3 border border-stone-300 bg-white p-4">
        <h2 className="text-sm font-bold">ダミープレイヤーを追加</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-xs font-semibold">
            能力
            <select
              className="h-10 border border-stone-300 bg-white px-2 text-sm font-normal"
              value={newAbilityId}
              onChange={(event) => setNewAbilityId(event.target.value)}
            >
              {abilities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold">
            能力モード（最初の参加者のみ有効）
            <select
              className="h-10 border border-stone-300 bg-white px-2 text-sm font-normal"
              value={newAbilityMode}
              onChange={(event) =>
                setNewAbilityMode(event.target.value as AbilityMode)
              }
            >
              <option value="selected">選択固定</option>
              <option value="random_turn">ランダム</option>
            </select>
          </label>
          <button
            className="h-10 bg-stone-900 px-4 text-sm font-semibold text-white"
            onClick={addDummy}
            type="button"
          >
            追加
          </button>
        </div>
      </section>

      {state.players.length === 0 && (
        <p className="text-sm text-stone-600">
          プレイヤーがいません。ダミーを追加するか、ルームURLから参加してください。
        </p>
      )}

      {state.players.map((player) => (
        <PlayerPanel
          actAs={actAs}
          active={active}
          banker={banker}
          isDummy={dummyIds.has(player.id)}
          key={player.id}
          player={player}
          removeDummy={removeDummy}
          send={send}
          state={state}
        />
      ))}
    </div>
  );
}

function PlayerPanel({
  actAs,
  active,
  banker,
  isDummy,
  player,
  removeDummy,
  send,
  state,
}: {
  actAs: (id: string, message: ClientMessage) => void;
  active: Player | null | undefined;
  banker: Player | null | undefined;
  isDummy: boolean;
  player: Player;
  removeDummy: (id: string) => void;
  send: (message: ClientMessage) => void;
  state: GameState;
}) {
  const [dice, setDice] = useState<[number, number, number]>([4, 5, 6]);
  const [abilityId, setAbilityId] = useState(abilities[0].id as string);

  const forced = state.debugNextRolls[player.id];
  const effectiveAbility =
    state.abilityMode === "random_turn"
      ? (state.currentTurnAbilityMap[player.id] ?? "(手番待ち)")
      : player.abilityId;
  const isTheirTurn =
    active?.id === player.id &&
    (state.phase === "banker_turn" || state.phase === "player_turn");
  const canReady =
    (state.phase === "lobby" ||
      state.phase === "ability_select" ||
      state.phase === "game_over") &&
    !player.isReady;

  return (
    <section className="grid gap-3 border border-stone-300 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">
          {player.nickname}
          {isDummy ? "（ダミー）" : ""}
          {player.id === banker?.id ? "（親）" : ""}
          {isTheirTurn ? " ← 手番" : ""}
        </h3>
        <span className="text-xs text-stone-500">
          能力: {abilityNames.get(effectiveAbility) ?? effectiveAbility} /
          スコア: {state.scores[player.id] ?? 0}pt /
          {player.isReady ? " ready" : " waiting"}
        </span>
      </div>

      {isDummy && (
        <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3">
          <button
            className="h-10 bg-stone-900 px-4 text-sm font-semibold text-white disabled:bg-stone-300"
            disabled={!canReady}
            onClick={() => actAs(player.id, { type: "ready" })}
            type="button"
          >
            Ready
          </button>
          <button
            className="h-10 bg-red-800 px-4 text-sm font-semibold text-white disabled:bg-stone-300"
            disabled={!isTheirTurn}
            onClick={() => actAs(player.id, { type: "roll" })}
            type="button"
          >
            振る
          </button>
          <button
            className="h-10 border border-stone-400 px-4 text-sm font-semibold disabled:text-stone-300"
            disabled={state.phase !== "round_result"}
            onClick={() => actAs(player.id, { type: "next_round" })}
            type="button"
          >
            次ラウンド
          </button>
          <button
            className="h-10 border border-red-300 px-4 text-sm font-semibold text-red-800"
            onClick={() => removeDummy(player.id)}
            type="button"
          >
            退出
          </button>
        </div>
      )}

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
}
