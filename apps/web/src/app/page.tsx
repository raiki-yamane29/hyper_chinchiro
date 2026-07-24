"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import type { GamePhase } from "@/types/game";

interface RoomListEntry {
  roomId: string;
  hostNickname: string;
  hasPassword: boolean;
  playerCount: number;
  phase: GamePhase;
}

const PHASE_LABELS: Record<GamePhase, string> = {
  lobby: "募集中",
  ability_select: "能力選択中",
  banker_max_bet: "賭け上限設定中",
  betting: "賭け中",
  banker_turn: "親の手番",
  player_turn: "子の手番",
  round_result: "結果表示中",
  game_over: "終了",
};

function lobbyOrigin(): string {
  const host = process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "localhost:1999";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${host}/parties/room-lobby/global`;
}

function passwordStorageKey(roomId: string): string {
  return `room-password-${roomId}`;
}

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [rooms, setRooms] = useState<RoomListEntry[]>([]);
  const [roomsError, setRoomsError] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const goToRoom = useCallback(
    (targetRoomId: string) => {
      const params = new URLSearchParams();
      if (nickname.trim()) {
        params.set("nickname", nickname.trim());
      }

      const query = params.toString();
      router.push(`/room/${targetRoomId}${query ? `?${query}` : ""}`);
    },
    [nickname, router],
  );

  const fetchRooms = useCallback(async () => {
    try {
      const response = await fetch(lobbyOrigin(), { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`status ${response.status}`);
      }
      const entries = (await response.json()) as RoomListEntry[];
      setRooms(entries);
      setRoomsError(false);
    } catch {
      setRoomsError(true);
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    const interval = window.setInterval(fetchRooms, 5000);
    return () => window.clearInterval(interval);
  }, [fetchRooms]);

  const createRoom = () => {
    const roomId = nanoid(8);
    if (createPassword.trim()) {
      sessionStorage.setItem(passwordStorageKey(roomId), createPassword.trim());
    }
    goToRoom(roomId);
  };

  const joinRoom = (room: RoomListEntry) => {
    if (room.hasPassword) {
      const input = window.prompt(
        "このルームにはパスワードが設定されています。パスワードを入力してください。",
      );
      if (!input) {
        return;
      }
      sessionStorage.setItem(passwordStorageKey(room.roomId), input);
    }
    goToRoom(room.roomId);
  };

  return (
    <div className="min-h-screen bg-[#f7f2e8] text-stone-950">
      <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-normal text-red-800">
            Realtime Dice Battle
          </p>
          <h1 className="text-4xl font-bold tracking-normal sm:text-6xl">
            Hyper Chinchiro
          </h1>
          <p className="max-w-2xl text-base leading-7 text-stone-700">
            チンチロに特殊能力を加えたリアルタイム対戦ゲーム。
          </p>
        </header>

        <section className="grid gap-4 border border-stone-300 bg-white p-5 shadow-sm">
          <label className="grid gap-2 text-sm font-semibold">
            ニックネーム
            <input
              className="h-12 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
              maxLength={24}
              placeholder="例: yamada"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-2 text-sm font-semibold">
              パスワード（任意・新規作成時のみ）
              <input
                className="h-12 border border-stone-300 px-3 text-base outline-none focus:border-red-700"
                placeholder="空欄で公開ルーム"
                type="text"
                value={createPassword}
                onChange={(event) => setCreatePassword(event.target.value)}
              />
            </label>
            <button
              className="h-12 self-end bg-red-800 px-5 font-semibold text-white disabled:bg-stone-400"
              disabled={!nickname.trim()}
              onClick={createRoom}
              type="button"
            >
              新規ルーム作成
            </button>
          </div>
        </section>

        <section className="grid gap-3 border border-stone-300 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">公開中のルーム</h2>
            <button
              className="border border-stone-400 px-3 py-1 text-sm font-semibold hover:bg-stone-100"
              onClick={fetchRooms}
              type="button"
            >
              更新
            </button>
          </div>

          {roomsError && (
            <p className="text-sm font-medium text-red-800">
              ルーム一覧の取得に失敗しました。
            </p>
          )}

          {!roomsError && !loadingRooms && rooms.length === 0 && (
            <p className="text-sm text-stone-600">現在公開中のルームはありません。</p>
          )}

          <ul className="grid gap-2">
            {rooms.map((room) => (
              <li
                className="flex flex-wrap items-center justify-between gap-3 border border-stone-200 p-3"
                data-testid={`room-row-${room.roomId}`}
                key={room.roomId}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="flex items-center gap-2 font-semibold">
                    {room.hostNickname} のルーム
                    {room.hasPassword && (
                      <span aria-label="パスワードあり" title="パスワードあり">
                        🔒
                      </span>
                    )}
                  </span>
                  <span className="text-xs text-stone-500">
                    {PHASE_LABELS[room.phase] ?? room.phase} ・ {room.playerCount}人参加中
                  </span>
                </div>
                <button
                  className="h-10 border border-stone-800 px-4 text-sm font-semibold"
                  onClick={() => joinRoom(room)}
                  type="button"
                >
                  参加
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
