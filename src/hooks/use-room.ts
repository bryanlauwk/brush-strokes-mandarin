import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getRoomSnapshot, roomExists } from "@/lib/game.functions";
import type { ChatMessage, Player, Room, Stroke } from "@/lib/game-types";

export type LiveStroke = { id: string; color: string; size: number; points: [number, number][]; turnIndex?: number };

export type RoomIdentity = { playerId: string; token: string } | null;

const POLL_MS = 1000;
const LIVE_END_GRACE_MS = 1800;

type StrokeBroadcast = { stroke: Stroke; turnIndex: number };

function mergeStrokes(snapshot: Stroke[], optimistic: Stroke[]) {
  const seen = new Set(snapshot.map((stroke) => stroke.id));
  const localOnly = optimistic.filter((stroke) => !seen.has(stroke.id));
  return localOnly.length ? [...snapshot, ...localOnly] : snapshot;
}

export function useRoom(code: string, identity: RoomIdentity) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [scratch, setScratch] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Record<string, LiveStroke>>({});
  const [missing, setMissing] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const turnRef = useRef<number>(-1);
  const liveEndTimersRef = useRef<Record<string, number>>({});

  const playerId = identity?.playerId ?? null;
  const token = identity?.token ?? null;

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
    const upper = code.toUpperCase();

    setMissing(false);
    turnRef.current = -1;

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
      if (snap.room.turn_index !== turnRef.current) {
        turnRef.current = snap.room.turn_index;
        setLive({});
        Object.values(liveEndTimersRef.current).forEach((timer) => window.clearTimeout(timer));
        liveEndTimersRef.current = {};
      }
      setStrokes((prev) => mergeStrokes(snap.strokes, prev));
      setLive((prev) => {
        if (!snap.strokes.length) return prev;
        const next = { ...prev };
        for (const s of snap.strokes) {
          delete next[s.id];
          clearLiveEndTimer(s.id);
        }
        return next;
      });
    };

    const refresh = async () => {
      try {
        const snap = await getRoomSnapshot({
          data: { code: upper, playerId, token },
        });
        applySnapshot(snap as unknown as {
          room: Room;
          players: Player[];
          messages: ChatMessage[];
          strokes: Stroke[];
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (message.includes("找不到这个号码")) setMissing(true);
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_MS);

    const channel = supabase
      .channel(`room-${upper}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "live" }, ({ payload }) => {
        const s = payload as LiveStroke;
        if (typeof s.turnIndex === "number" && s.turnIndex !== turnRef.current) return;
        clearLiveEndTimer(s.id);
        setLive((prev) => ({ ...prev, [s.id]: s }));
      })
      .on("broadcast", { event: "stroke" }, ({ payload }) => {
        const { stroke, turnIndex } = payload as StrokeBroadcast;
        if (turnIndex !== turnRef.current) return;
        clearLiveEndTimer(stroke.id);
        setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
        setLive((prev) => {
          const next = { ...prev };
          delete next[stroke.id];
          return next;
        });
      })
      .on("broadcast", { event: "live-end" }, ({ payload }) => {
        const { id, turnIndex } = payload as { id: string; turnIndex?: number };
        if (typeof turnIndex === "number" && turnIndex !== turnRef.current) return;
        clearLiveEndTimer(id);
        liveEndTimersRef.current[id] = window.setTimeout(() => {
          setLive((prev) => {
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
      const s = payload as Stroke;
      setScratch((prev) => (prev.some((x) => x.id === s.id) ? prev : [...prev, s]));
      setLive((prev) => {
        const next = { ...prev };
        delete next[s.id];
        return next;
      });
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      Object.values(liveEndTimersRef.current).forEach((pendingTimer) => window.clearTimeout(pendingTimer));
      liveEndTimersRef.current = {};
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [code, playerId, token, clearLiveEndTimer]);

  const broadcastLive = useCallback((stroke: LiveStroke) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "live",
      payload: { ...stroke, turnIndex: turnRef.current },
    });
  }, []);

  const broadcastLiveEnd = useCallback((id: string) => {
    void channelRef.current?.send({
      type: "broadcast",
      event: "live-end",
      payload: { id, turnIndex: turnRef.current },
    });
  }, []);

  const appendLocalStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
    void channelRef.current?.send({
      type: "broadcast",
      event: "stroke",
      payload: { stroke, turnIndex: turnRef.current },
    });
  }, []);

  // Free doodling in the lobby: never persisted, only shared over the channel.
  const appendScratchStroke = useCallback((stroke: Stroke) => {
    setScratch((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
    void channelRef.current?.send({ type: "broadcast", event: "scratch", payload: stroke });
  }, []);

  const clearScratch = useCallback(() => setScratch([]), []);

  const me = players.find((p) => p.id === playerId) ?? null;

  return {
    room,
    players,
    messages,
    strokes,
    scratch,
    live,
    missing,
    me,
    broadcastLive,
    broadcastLiveEnd,
    appendLocalStroke,
    appendScratchStroke,
    clearScratch,
  };
}
