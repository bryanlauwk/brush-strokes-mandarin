import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ChatMessage, Player, Room, Stroke } from "@/lib/game-types";

export type LiveStroke = { id: string; color: string; size: number; points: [number, number][] };

export function useRoom(code: string, playerId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [live, setLive] = useState<Record<string, LiveStroke>>({});
  const [missing, setMissing] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const turnRef = useRef<number>(-1);

  const loadPlayers = useCallback(async (roomId: string) => {
    const { data } = await supabase
      .from("players")
      .select("*")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    setPlayers((data ?? []) as Player[]);
  }, []);

  const loadStrokes = useCallback(async (roomId: string, turnIndex: number) => {
    const { data } = await supabase
      .from("strokes")
      .select("payload")
      .eq("room_id", roomId)
      .eq("turn_index", turnIndex)
      .order("id", { ascending: true });
    setStrokes(((data ?? []) as { payload: Stroke }[]).map((r) => r.payload));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const upper = code.toUpperCase();

    void (async () => {
      const { data: roomRow } = await supabase
        .from("rooms")
        .select("*")
        .eq("code", upper)
        .maybeSingle();
      if (cancelled) return;
      if (!roomRow) {
        setMissing(true);
        return;
      }
      const r = roomRow as Room;
      setRoom(r);
      turnRef.current = r.turn_index;
      await loadPlayers(r.id);
      await loadStrokes(r.id, r.turn_index);
      const { data: chat } = await supabase
        .from("guesses")
        .select("*")
        .eq("room_id", r.id)
        .order("id", { ascending: true })
        .limit(200);
      if (cancelled) return;
      setMessages((chat ?? []) as ChatMessage[]);

      const channel = supabase
        .channel(`room-${r.id}`, { config: { broadcast: { self: false } } })
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${r.id}` },
          (payload) => {
            const next = payload.new as Room;
            setRoom(next);
            if (next.turn_index !== turnRef.current) {
              turnRef.current = next.turn_index;
              setStrokes([]);
              setLive({});
            }
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "players", filter: `room_id=eq.${r.id}` },
          () => {
            void loadPlayers(r.id);
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "guesses", filter: `room_id=eq.${r.id}` },
          (payload) => {
            const msg = payload.new as ChatMessage;
            setMessages((prev) =>
              prev.some((m) => m.id === msg.id) ? prev : [...prev.slice(-199), msg],
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "strokes", filter: `room_id=eq.${r.id}` },
          (payload) => {
            const row = payload.new as { payload: Stroke; turn_index: number };
            if (row.turn_index !== turnRef.current) return;
            setStrokes((prev) =>
              prev.some((s) => s.id === row.payload.id) ? prev : [...prev, row.payload],
            );
            setLive((prev) => {
              if (!prev[row.payload.id]) return prev;
              const next = { ...prev };
              delete next[row.payload.id];
              return next;
            });
          },
        )
        .on("broadcast", { event: "live" }, ({ payload }) => {
          const s = payload as LiveStroke;
          setLive((prev) => ({ ...prev, [s.id]: s }));
        })
        .on("broadcast", { event: "live-end" }, ({ payload }) => {
          const { id } = payload as { id: string };
          setLive((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        });

      channel.subscribe();
      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [code, loadPlayers, loadStrokes]);

  const broadcastLive = useCallback((stroke: LiveStroke) => {
    void channelRef.current?.send({ type: "broadcast", event: "live", payload: stroke });
  }, []);

  const broadcastLiveEnd = useCallback((id: string) => {
    void channelRef.current?.send({ type: "broadcast", event: "live-end", payload: { id } });
  }, []);

  const appendLocalStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => (prev.some((s) => s.id === stroke.id) ? prev : [...prev, stroke]));
  }, []);

  const me = players.find((p) => p.id === playerId) ?? null;

  return {
    room,
    players,
    messages,
    strokes,
    live,
    missing,
    me,
    broadcastLive,
    broadcastLiveEnd,
    appendLocalStroke,
  };
}