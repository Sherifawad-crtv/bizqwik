

export function limitLabel(n: number | null): string {
  return n === null ? "Unlimited" : String(n);
}
