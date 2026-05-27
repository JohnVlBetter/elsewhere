export function DebugDrawer({ trace }: { trace: unknown }) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <details className="debug-drawer">
      <summary>调试记录</summary>
      <pre>{JSON.stringify(trace ?? {}, null, 2)}</pre>
    </details>
  );
}
