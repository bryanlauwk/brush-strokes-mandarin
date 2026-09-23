import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getRoomSnapshot, roomExists } from "@/lib/game.functions";
import { retryTransient } from "@/lib/retry";
import type { ChatMessage, Player, Room, Stroke } from "@/lib/game-types";

export type LiveStroke = {
  id: string;
  color: string;
  size: number;
  points: [number, number][];
  turnIndex?: number;
  round?: number;
};

export type RoomIdentity = {
  playerId: string;
  token: string;
  clientId: string;
} | null;

const POLL_MS = 1000;
const LIVE_END_GRACE_MS = 1800;

type TurnMarker = { turnIndex?: number; round?: number };
type StrokeBroadcast = { stroke: Stroke; turnIndex: number; round: number };

function mergeStrokes(snapshot: Stroke[], optimistic: Stroke[]) {
  const seen = new Set(snapshot.map((stroke) => stroke.id));
  const localOnly = optimistic.filter((stroke) => !seen.has(stroke.id));
  const merged = localOnly.length ? [...snapshot, ...localOnly] : snapshot;
  // Stroke payloads are immutable. Keep the same array when a poll merely
  // confirms the strokes we already rendered, rather than repainting history.
  return merged.length === optimistic.length &&
    merged.every((stroke, index) => stroke.id === optimistic[index].id)
    ? optimistic
    : merged;
}

function sameKnownTurn(marker: TurnMarker, currentTurn: number, currentRound: number) {
  if (
    typeof marker.turnIndex === "number" &&
    marker.turnIndex >= 0 &&
    currentTurn >= 0 &&
    marker.turnIndex !== currentTurn
  ) {
    return false;
  }
  if (
    typeof marker.round === "number" &&
    marker.round >= 0 &&
    currentRound >= 0 &&
    marker.round !== currentRound
  ) {
    return false;
  }
  return true;
}

export function useRoom(code: string, identity: RoomIdentity) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [scratch, setScratch] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Record<string, LiveStroke>>({});
  const [missing, setMissing] = useState(false);
  const [identityInvalid, setIdentityInvalid] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const turnRef = useRef<number>(-1);
  const roundRef = useRef<number>(-1);
  const refreshRef = useRef<(() => void) | null>(null);
  const liveEndTimersRef = useRef<Record<string, number>>({});

  const playerId = identity?.playerId ?? null;
  const token = identity?.token ?? null;
  const clientId = identity?.clientId ?? null;

  const clearLiveEndTimer = useCallback((id: string) => {
    const timer = liveEndTimersRef.current[id];
    if (!timer) return;
    window.clearTimeout(timer);
    delete liveEndTimersRef.current[id];
  }, []);

  // Without an identity we can only check that the room code exists.
  useEffect(() => {
    if (identity) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await roomExists({ data: { code: code.toUpperCase() } });
        if (!cancelled) setMissing(!res.exists);
      } catch {
        /* keep current state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, identity]);

  useEffect(() => {
    if (!playerId || !token) return;
    let cancelled = false;
    let refreshing = false;
    let refreshQueued = false;
    const upper = code.toUpperCase();
    const finishedLiveIds = new Set<string>();

    setMissing(false);
    setIdentityInvalid(false);
    turnRef.current = -1;
    roundRef.current = -1;

    const matchesCurrentTurn = (marker: TurnMarker) =>
      sameKnownTurn(marker, turnRef.current, roundRef.current);

    const applySnapshot = (snap: {
      room: Room;
      players: Player[];
      messages: ChatMessage[];
      strokes: Stroke[];
    }) => {
      if (cancelled) return;
      setRoom(snap.room);
      setPlayers(snap.players);
      setMessages(snap.messages);
      const hadTurn = turnRef.current >= 0 && roundRef.current >= 0;
      const turnChanged =
        snap.room.turn_index !== turnRef.current || snap.room.current_round !== roundRef.current;
      if (turnChanged) finishedLiveIds.clear();
      for (const stroke of snap.strokes) finishedLiveIds.add(stroke.id);
      turnRef.current = snap.room.turn_index;
      roundRef.current = snap.room.current_round;
      if (hadTurn && turnChanged) {
        setStrokes(snap.strokes);
        setLive({});
        Object.values(liveEndTimersRef.current).forEach((timer) => window.clearTimeout(timer));
        liveEndTimersRef.current = {};
      } else {
        setStrokes((prev) => mergeStrokes(snap.strokes, prev));
      }
      const committedIds = new Set(snap.strokes.map((stroke) => stroke.id));
      setLive((prev) => {
        let next = prev;
        for (const [id, stroke] of Object.entries(prev)) {
          if (!sameKnownTurn(stroke, turnRef.current, roundRef.current) || committedIds.has(id)) {
            if (next === prev) next = { ...prev };
            delete next[id];
            clearLiveEndTimer(id);
          }
        }
        return next;
      });
    };

    const refresh = async (queueIfBusy = true) => {
      if (cancelled) return;
      if (refreshing) {
        // A successful action must get a snapshot taken after the action.
        // Routine polling can skip a busy request without building a backlog.
        refreshQueued ||= queueIfBusy;
        return;
      }
      refreshing = true;
      try {
        // On lossy networks the snapshot request can be dropped entirely; retry
        // briefly so the room does not sit on a stale view until the next poll.
        const snap = await retryTransient(
          () =>
            getRoomSnapshot({
              data: {
                code: upper,
                playerId,
                token,
                clientId: clientId ?? undefined,
              },
            }),
          { attempts: 3, baseDelayMs: 250 },
        );
        if (cancelled) return;
        if ((snap as { authError?: boolean }).authError) {
          setIdentityInvalid(true);
          return;
        }
        setIdentityInvalid(false);
        applySnapshot(
          snap as unknown as {
            room: Room;
            players: Player[];
            messages: ChatMessage[];
            strokes: Stroke[];
          },
        );
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "";
        if (message.includes("找不到这个号码")) setMissing(true);
        if (message.includes("身份验证失败") || message.includes("已经不在这局")) {
          setIdentityInvalid(true);
        }
      } finally {
        refreshing = false;
        if (refreshQueued && !cancelled) {
          refreshQueued = false;
          void refresh();
        }
      }
    };

    void refresh();
    refreshRef.current = () => void refresh();
    const timer = window.setInterval(() => void refresh(false), POLL_MS);

    // Coming back from another tab/route must not wait for the next poll,
    // otherwise players briefly see a stale turn or stale word choices.
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const channel = supabase
      .channel(`room-${upper}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "live" }, ({ payload }) => {
        if (cancelled) return;
        const s = payload as LiveStroke;
        if (!matchesCurrentTurn(s) || finishedLiveIds.has(s.id)) return;
        clearLiveEndTimer(s.id);
        setLive((prev) => ({ ...prev, [s.id]: s }));
      })
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        if (cancelled) return;
        const { stroke, turnIndex, round } = payload as StrokeBroadcast;
        if (!matchesCurrentTurn({ turnIndex, round })) return;
        finishedLiveIds.add(stroke.id);
        clearLiveEndTimer(stroke.id);
        setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
        setLive((prev) => {
          if (!(stroke.id in prev)) return prev;
          const next = { ...prev };
          delete next[stroke.id];
          return next;
        });
      })
      .on("broadcast", { event: "live-end" }, ({ payload }) => {
        if (cancelled) return;
        const { id, turnIndex, round } = payload as {
          id: string;
          turnIndex?: number;
          round?: number;
        };
        if (!matchesCurrentTurn({ turnIndex, round })) return;
        // The final stroke normally arrives before live-end. It has already
        // reconciled the preview; don't schedule another snapshot per pen lift.
        if (finishedLiveIds.has(id)) return;
        clearLiveEndTimer(id);
        liveEndTimersRef.current[id] = window.setTimeout(() => {
          setLive((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
          delete liveEndTimersRef.current[id];
          void refresh();
        }, LIVE_END_GRACE_MS);
      })
      .on("broadcast", { event: "sync" }, () => {
        void refresh();
      });

    channel.on("broadcast", { event: "scratch" }, ({ payload }) => {
      if (cancelled) return;
      const s = payload as Stroke;
      finishedLiveIds.add(s.id);
      clearLiveEndTimer(s.id);
      setScratch((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
      setLive((prev) => {
        if (!(s.id in prev)) return prev;
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
    });

    channel.subscribe((status) => {
      // Reconnects can miss room updates between polls. Catch up immediately.
      if (status === "SUBSCRIBED") void refresh();
    });
    channelRef.current = channel;

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      refreshRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      Object.values(liveEndTimersRef.current).forEach((pendingTimer) =>
        window.clearTimeout(pendingTimer),
      );
      liveEndTimersRef.current = {};
      void supabase.removeChannel(channel);
      if (channelRef.current === channel) channelRef.current = null;
    };
  }, [code, playerId, token, clientId, clearLiveEndTimer]);

  const broadcastLive = useCallback((stroke: LiveStroke) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "live",
      payload: {
        ...stroke,
        turnIndex: turnRef.current,
        round: roundRef.current,
      },
    });
  }, []);

  const broadcastLiveEnd = useCallback((id: string) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "live-end",
      payload: { id, turnIndex: turnRef.current, round: roundRef.current },
    });
  }, []);

  const appendLocalStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
    void channelRef.current?.send({
      type: "broadcast",
      event: "stroke",
      payload: { stroke, turnIndex: turnRef.current, round: roundRef.current },
    });
  }, []);

  // Free doodling in the lobby: never persisted, only shared over the channel.
  const appendScratchStroke = useCallback((stroke: Stroke) => {
    setScratch((prev) => (prev.some((x) => x.id === stroke.id) ? prev : [...prev, stroke]));
    void channelRef.current?.send({
      type: "broadcast",
      event: "scratch",
      payload: stroke,
    });
  }, []);

  const clearScratch = useCallback(() => setScratch([]), []);

  /** Pull a fresh snapshot now and ask every other client to do the same. */
  const broadcastSync = useCallback(() => {
    refreshRef.current?.();
    void channelRef.current?.send({ type: "broadcast", event: "sync", payload: {} });
  }, []);

  const me = players.find((p) => p.id === playerId) ?? null;

  return {
    room,
    players,
    messages,
    strokes,
    scratch,
    live,
    missing,
    identityInvalid,
    me,
    broadcastLive,
    broadcastLiveEnd,
    appendLocalStroke,
    appendScratchStroke,
    clearScratch,
    broadcastSync,
  };
}
