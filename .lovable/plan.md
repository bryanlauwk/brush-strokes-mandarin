# 你画我猜 — 多人在线画图猜词游戏

A skribbl-style realtime drawing-and-guessing game with a Simplified Chinese interface and a ~300-word Chinese library. Original UI and artwork (game format only — no copied assets or branding).

## Game flow

```text
首页 /            -> 输入昵称、创建房间 或 输入房号加入
房间 /room/$code  -> 等待区 (玩家列表, 房主设置回合数/时长) 
                  -> 每回合: 画者从 3 个词中选 1 -> 80 秒作画
                     其他人在聊天框输入汉字猜词 (完全匹配)
                  -> 回合结束: 公布答案 + 得分动画
                  -> 所有回合结束: 最终排行榜 -> 再来一局
```

## Backend (Lovable Cloud)

Enable Cloud, then one migration creating:
- `rooms` — code (6位), host_player_id, status (waiting/playing/ended), settings (rounds, draw_seconds), current_round, current_drawer, current_word, word_started_at
- `players` — room_id, name, score, is_host, joined_at, last_seen
- `guesses` — room_id, round, player_id, text, is_correct (correct guesses store a masked "猜对了！" flag so the word never leaks)
- `words` — ~300 rows seeded as literal INSERTs: word (汉字), category (动物/食物/物品/动作/地点/自然), difficulty (简单/中等/困难)
- `strokes` — room_id, round, ordered stroke payloads, so late joiners see the drawing so far

Anonymous play: no login. Each browser gets a persisted player id; rooms are public-by-code with narrow `TO anon` policies plus GRANTs, and all mutations that could cheat (choosing words, scoring guesses, revealing the word) run through server functions rather than direct table writes.

Realtime: Supabase Realtime channel per room for strokes, chat, presence, and round state, with DB rows as the source of truth for scores and reconnection.

## Server functions

- `createRoom` / `joinRoom` — generate code, insert player
- `startGame`, `startRound` — pick drawer in rotation, draw 3 random candidate words, only the drawer receives them
- `chooseWord` — locks the word and the round clock
- `submitGuess` — compares against the exact hanzi word server-side; awards points by speed (faster = more), gives the drawer points per correct guesser; never returns the word to guessers
- `endRound` / `endGame` — reveal word, tally, advance or finish

## Client

- **Canvas**: pointer-based drawing, brush sizes, color palette, eraser, fill, undo, clear; strokes broadcast in batches; read-only for guessers
- **Word hint bar**: `_ _ _` per character, timed hints reveal a character or two
- **Chat**: Chinese input friendly (composition-event safe), correct guesses hidden from others, "接近了！" hint when a guess shares characters with the answer
- **Scoreboard** with live ranks, drawer badge, timer ring
- **房间设置**: 回合数, 每回合秒数, 词语难度

## Design

Playful but not generic: warm paper-cream board, thick ink-black strokes, a single vermilion accent, rounded chunky panels, Noto Sans SC typography. All colors as semantic tokens in `src/styles.css`.

## Routes & SEO

- `src/routes/index.tsx` — lobby/home (replaces placeholder), own `head()` metadata in Chinese
- `src/routes/room.$code.tsx` — game room, own `head()`
- `src/routes/how-to-play.tsx` — 玩法说明

## Technical notes

- Turn timing is validated server-side from `word_started_at`, so a client clock can't be gamed.
- Stroke data is throttled and chunked to keep realtime payloads small; a compacted snapshot is stored per round for late joiners.
- Guess matching is exact hanzi match after trimming whitespace and normalizing full/half-width punctuation.

## Build order

1. Enable Cloud + migration with word seed data
2. Home/lobby + create/join rooms + player presence
3. Canvas + realtime stroke sync
4. Round loop, word selection, timer, hints
5. Guessing, scoring, round/game results
6. Polish: sounds toggle, mobile layout, reconnect handling, SEO metadata
