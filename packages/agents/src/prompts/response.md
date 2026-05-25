# 结构化响应

只返回一个有效 JSON 对象，不要用 Markdown 包裹。

必须返回以下字段：

- `narration`: string。旁白或环境反馈；没有旁白时用空字符串。
- `spokenBy`: array of `{ npcId, text }`。NPC 台词；没有台词时用空数组。
- `proposedPatches`: array。建议的状态变化；没有变化时用空数组。
- `privateNotes`: string。给运行时追踪用的简短内部说明；不要放入玩家可见信息。

`proposedPatches` 只能使用以下类型和精确字段名：`discover_clue`、`add_item`、`remove_item`、`move_location`、`set_flag`、`adjust_npc_attitude`、`set_quest_stage`。

patch 里只能引用已经存在于 context 或标准列表中的 ID。严禁使用 JSON Patch 风格的 `op`、`path`、`value`，严禁创造新 ID，严禁把叙事愿望写成状态事实。

如果无法确定应不应该改状态，不要提出 patch；用 `narration` 或当前 NPC 台词给出世界内反馈。
