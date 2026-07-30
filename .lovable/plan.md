## 诊断（已核实）

不是 OpenAI 出问题，是这个功能根本没打到任何模型。

`src/lib/drawing-hint.functions.ts:42` 读 `process.env.OPENAI_API_KEY`，读不到就直接 `return unavailableHint(prompt)`——沙箱里确认 `OPENAI_API_KEY` 未配置，而 `LOVABLE_API_KEY` 是有的。所以每次都走「AI 图没生成」这条静默分支，前端 `DrawingHintPanel` 只看到 `source: "unavailable"`，无法区分「没配 key」「模型报错」「超时」。

## 修改计划

### 1. 改用 Lovable AI 出图（不需要用户自备 key）
- 把 `fetch("https://api.openai.com/v1/images/generations")` 换成 `https://ai.gateway.lovable.dev/v1/images/generations`，用 `LOVABLE_API_KEY`。
- 模型选 `google/gemini-3.1-flash-image`（Nano Banana 2，出图快、质量够用，适合一局游戏里 18 秒内要拿到图），请求体用 Gemini 的 `messages` + `modalities` 形状，非流式（服务端一次性拿 `data[0].b64_json` 返回给前端）。
- 保留现有的 18 秒超时与 `AbortController`。

### 2. 失败原因要能看见
- `DrawingHint` 增加一个 `reason` 字段（`no-key` / `blocked` / `timeout` / `error`）。
- 服务端在每个失败分支记录 `console.error`，方便用日志排查。
- 前端把「AI 图没生成」换成对应的中文提示，例如「这题被模型挡下来了，换个说法再试」「网络慢了，点重试」。

### 3. 提示词微调
现在的 prompt 明确禁止出现文字，这对 Gemini 图像模型同样适用，保留。只把开头一句改得更像图像指令（去掉 "Private reference image for..." 这种元描述），减少模型把它当成对话来回答的概率。

## 技术细节

- 只改 `src/lib/drawing-hint.functions.ts` 与 `src/components/game/DrawingHintPanel.tsx`。
- `process.env.LOVABLE_API_KEY` 在 `.handler()` 内读，不在模块顶层。
- 现有的房主/回合校验（`authPlayer`、`drawer_id`、`turn_index`）与 `room_secrets` 读取逻辑完全不动。
- 改完后在房间里实跑一次，确认返回 `source: "ai"` 且图能渲染，再看服务端日志确认没有 400。
