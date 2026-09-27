import { defineMcp } from "@lovable.dev/mcp-js";
import howToPlay from "./tools/how-to-play";
import listThemes from "./tools/list-themes";

export default defineMcp({
  name: "skribbl-chinese-edition",
  title: "Skribbl Chinese Edition",
  version: "0.1.0",
  instructions:
    "Public info about 画啦猜啦, a Chinese draw-and-guess game. Use `how_to_play` for rules and `list_themes` for word themes.",
  tools: [howToPlay, listThemes],
});
