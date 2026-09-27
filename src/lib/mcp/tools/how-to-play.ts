import { defineTool } from "@lovable.dev/mcp-js";

const RULES = [
  "1. 开新房：输入名字创建房间，把房间号分享给朋友。",
  "2. 加入房：朋友输入房间号和名字加入（最多 8 人）。",
  "3. 轮流画画：轮到你时从三个中文词里选一个，在限时内画出来。",
  "4. 在答题室猜词：打出完全正确的中文词语即算猜对，越快得分越高。",
  "5. 每位玩家每轮都会画一次，几轮后分数最高者获胜。",
].join("\n");

export default defineTool({
  name: "how_to_play",
  title: "How to play",
  description: "Explain the rules of 画啦猜啦, the Chinese draw-and-guess party game.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => ({ content: [{ type: "text", text: RULES }] }),
});
