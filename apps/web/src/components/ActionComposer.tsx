import type { FormEvent } from "react";
import type { Profile } from "@aigame/shared";

export function ActionComposer({
  input,
  isReady,
  isSubmitting,
  quickActions,
  onInputChange,
  onQuickAction,
  onSubmit
}: {
  input: string;
  isReady: boolean;
  isSubmitting: boolean;
  quickActions: Profile["quickActions"];
  onInputChange: (value: string) => void;
  onQuickAction: (command: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form className="action-composer" onSubmit={onSubmit} data-testid="action-composer">
      <div className="action-row">
        <textarea
          aria-label="行动"
          rows={2}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="写下你的行动"
          disabled={!isReady || isSubmitting}
        />
        <button type="submit" disabled={!input.trim() || !isReady || isSubmitting}>
          {isSubmitting ? "继续中" : "发送"}
        </button>
      </div>
      {quickActions.length ? (
        <div className="quick-actions" aria-label="快捷行动">
          {quickActions.map((action) => (
            <button type="button" key={action.command} disabled={!isReady || isSubmitting} onClick={() => onQuickAction(action.command)}>
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
