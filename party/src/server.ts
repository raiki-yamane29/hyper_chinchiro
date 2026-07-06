import {
  Server,
  routePartykitRequest,
  type Connection,
  type WSMessage,
} from "partyserver";
import {
  applyMessage,
  createInitialState,
  removePlayer,
  setPlayerConnected,
} from "./gameLogic/stateMachine";
import type { ClientMessage, GameState, RollResult, ServerMessage } from "./types/game";

type Env = {
  ChinchiroServer: DurableObjectNamespace;
};

const GRACE_PERIOD_MS = 60_000;

export class ChinchiroServer extends Server<Env> {
  private state: GameState = createInitialState("");
  private removalTimers = new Map<string, ReturnType<typeof setTimeout>>();
  // 同一ID（同一_pk）の生存接続数。再接続の確立後に旧接続のcloseが遅れて
  // 届いても、接続中のプレイヤーを誤って切断扱いしないための判定に使う
  private connectionCounts = new Map<string, number>();

  onStart() {
    this.state = createInitialState(this.name);
  }

  onConnect(conn: Connection) {
    this.connectionCounts.set(
      conn.id,
      (this.connectionCounts.get(conn.id) ?? 0) + 1,
    );

    const pendingTimer = this.removalTimers.get(conn.id);
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      this.removalTimers.delete(conn.id);
    }

    if (this.state.players.some((player) => player.id === conn.id)) {
      this.state = setPlayerConnected(this.state, conn.id, true);
      this.broadcastMessage({ type: "state_update", state: this.state });
    }

    this.send(conn, { type: "state_update", state: this.state });
  }

  onMessage(sender: Connection, message: WSMessage) {
    if (typeof message !== "string") {
      this.send(sender, { type: "error", message: "不正なメッセージです" });
      return;
    }

    const parsed = this.parseClientMessage(message);
    if (!parsed) {
      this.send(sender, { type: "error", message: "不正なメッセージです" });
      return;
    }

    const previousRoll = this.getLatestRoll(sender.id);
    this.state = applyMessage(this.state, parsed, sender.id);
    const nextRoll = this.getLatestRoll(sender.id);

    if (nextRoll && nextRoll !== previousRoll) {
      this.broadcastMessage({ type: "roll_result", playerId: sender.id, result: nextRoll });
    }

    this.broadcastMessage({ type: "state_update", state: this.state });
  }

  onClose(conn: Connection) {
    const remaining = Math.max(0, (this.connectionCounts.get(conn.id) ?? 1) - 1);
    if (remaining > 0) {
      this.connectionCounts.set(conn.id, remaining);
      return;
    }
    this.connectionCounts.delete(conn.id);

    if (!this.state.players.some((player) => player.id === conn.id)) {
      return;
    }

    this.state = setPlayerConnected(this.state, conn.id, false);
    this.broadcastMessage({ type: "state_update", state: this.state });

    const timer = setTimeout(() => {
      this.removalTimers.delete(conn.id);
      this.state = removePlayer(this.state, conn.id);
      this.broadcastMessage({ type: "state_update", state: this.state });
    }, GRACE_PERIOD_MS);
    this.removalTimers.set(conn.id, timer);
  }

  private parseClientMessage(message: string): ClientMessage | null {
    try {
      const parsed = JSON.parse(message) as Partial<ClientMessage>;
      if (!parsed || typeof parsed.type !== "string") {
        return null;
      }

      return parsed as ClientMessage;
    } catch {
      return null;
    }
  }

  private getLatestRoll(playerId: string): RollResult | null {
    const banker = this.state.players[this.state.bankerIndex];
    if (banker?.id === playerId) {
      return this.state.bankerRoll;
    }

    return this.state.playerRolls[playerId] ?? null;
  }

  private send(conn: Connection, message: ServerMessage) {
    conn.send(JSON.stringify(message));
  }

  private broadcastMessage(message: ServerMessage) {
    this.broadcast(JSON.stringify(message));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("hyper-chinchiro party server", { status: 200 })
    );
  },
};
