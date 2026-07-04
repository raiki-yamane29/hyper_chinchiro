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
} from "./gameLogic/stateMachine";
import type { ClientMessage, GameState, RollResult, ServerMessage } from "./types/game";

type Env = {
  ChinchiroServer: DurableObjectNamespace;
};

export class ChinchiroServer extends Server<Env> {
  private state: GameState = createInitialState("");

  onStart() {
    this.state = createInitialState(this.name);
  }

  onConnect(conn: Connection) {
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
    this.state = removePlayer(this.state, conn.id);
    this.broadcastMessage({ type: "state_update", state: this.state });
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
