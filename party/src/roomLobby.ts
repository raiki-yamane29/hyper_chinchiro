import { Server } from "partyserver";

type Env = Record<string, never>;

interface RoomRow {
  roomId: string;
  hostNickname: string;
  hasPassword: number;
  playerCount: number;
  phase: string;
  updatedAt: number;
}

export interface RoomListEntry {
  roomId: string;
  hostNickname: string;
  hasPassword: boolean;
  playerCount: number;
  phase: string;
}

// この時間より前に更新されたルームは孤児（サーバー異常終了などで登録解除されず残った）
// とみなして一覧から除外する
const STALE_MS = 30 * 60 * 1000;

export class RoomLobby extends Server<Env> {
  onStart() {
    this.sql`
      CREATE TABLE IF NOT EXISTS rooms (
        roomId TEXT PRIMARY KEY,
        hostNickname TEXT NOT NULL,
        hasPassword INTEGER NOT NULL,
        playerCount INTEGER NOT NULL,
        phase TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `;
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET") {
      const cutoff = Date.now() - STALE_MS;
      const rows = this.sql<RoomRow>`
        SELECT * FROM rooms WHERE updatedAt >= ${cutoff} ORDER BY updatedAt DESC
      `;
      const entries: RoomListEntry[] = rows.map((row) => ({
        roomId: row.roomId,
        hostNickname: row.hostNickname,
        hasPassword: Boolean(row.hasPassword),
        playerCount: row.playerCount,
        phase: row.phase,
      }));
      return Response.json(entries);
    }

    if (request.method === "PUT") {
      const body = (await request.json()) as Omit<RoomListEntry, "hasPassword"> & {
        hasPassword: boolean;
      };
      this.sql`
        INSERT INTO rooms (roomId, hostNickname, hasPassword, playerCount, phase, updatedAt)
        VALUES (${body.roomId}, ${body.hostNickname}, ${body.hasPassword ? 1 : 0}, ${body.playerCount}, ${body.phase}, ${Date.now()})
        ON CONFLICT(roomId) DO UPDATE SET
          hostNickname = excluded.hostNickname,
          hasPassword = excluded.hasPassword,
          playerCount = excluded.playerCount,
          phase = excluded.phase,
          updatedAt = excluded.updatedAt
      `;
      return new Response(null, { status: 204 });
    }

    if (request.method === "DELETE") {
      const roomId = url.searchParams.get("roomId");
      this.sql`DELETE FROM rooms WHERE roomId = ${roomId}`;
      return new Response(null, { status: 204 });
    }

    return new Response("not found", { status: 404 });
  }
}
