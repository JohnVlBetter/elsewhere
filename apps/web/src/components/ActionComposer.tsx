import type { FormEvent } from "react";
import { Send, Sparkles } from "lucide-react";
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
    <form className="action-composer order-3 grid gap-3 rounded-lg border border-[var(--line)] bg-white/90 p-3 shadow-[0_16px_42px_rgba(39,34,28,0.1)] backdrop-blur lg:col-start-1 lg:row-start-3" onSubmit={onSubmit} data-testid="action-composer">
      <div className="action-row grid gap-3 md:grid-cols-[minmax(0,1fr)_112px]">
        <textarea
          className="min-h-24 min-w-0 resize-y rounded-md border border-[var(--line)] bg-white px-4 py-3 leading-7 text-[var(--ink)] outline-none transition focus:border-[var(--accent)]"
          aria-label="行动"
          rows={2}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="写下你的行动"
          disabled={!isReady || isSubmitting}
        />
        <button className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[var(--accent-strong)] px-4 font-bold text-white transition hover:bg-[var(--accent)] disabled:hover:bg-[var(--accent-strong)]" type="submit" disabled={!input.trim() || !isReady || isSubmitting}>
          <Send className="h-4 w-4" aria-hidden="true" data-testid="send-icon" />
          {isSubmitting ? "继续中" : "发送"}
        </button>
      </div>
      {quickActions.length ? (
        <div className="quick-actions flex flex-wrap gap-2" aria-label="快捷行动">
          {quickActions.map((action) => (
            <button className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[var(--line)] bg-[var(--surface-2)] px-3 text-sm font-bold text-[var(--ink)] transition hover:border-[rgba(82,104,122,0.34)] hover:text-[var(--accent-strong)]" type="button" key={action.command} disabled={!isReady || isSubmitting} onClick={() => onQuickAction(action.command)}>
              <Sparkles className="h-4 w-4" aria-hidden="true" data-testid="quick-action-icon" />
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
