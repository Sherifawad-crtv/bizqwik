export function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40svh" }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 999,
          border: "3px solid var(--primary-tint)",
          borderTopColor: "var(--primary)",
          animation: "bqSpin .7s linear infinite",
        }}
      />
    </div>
  );
}
