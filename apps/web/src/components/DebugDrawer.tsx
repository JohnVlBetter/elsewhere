import { Bug } from "lucide-react";

export function DebugDrawer({ trace }: { trace: unknown }) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <details className="debug-drawer order-5 max-h-48 overflow-auto rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_10px_28px_rgba(39,34,28,0.05)] lg:col-start-2">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--muted)]">
        <Bug className="h-4 w-4" aria-hidden="true" />
        调试记录
      </summary>
      <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(trace ?? {}, null, 2)}</pre>
    </details>
  );
}
