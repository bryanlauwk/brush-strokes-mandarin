import { defineTool } from "@lovable.dev/mcp-js";
import { ROOM_THEME_OPTIONS } from "@/lib/game-themes";

export default defineTool({
  name: "list_themes",
  title: "List word themes",
  description: "List the word themes a host can pick when creating a room.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const themes = ROOM_THEME_OPTIONS.map((t) => ({ name: t.label, description: t.description }));
    return {
      content: [{ type: "text", text: themes.map((t) => `${t.name}：${t.description}`).join("\n") }],
      structuredContent: { themes },
    };
  },
});
