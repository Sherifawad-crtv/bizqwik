import { Segmented } from "./Segmented";
import { MOCK } from "../lib/backend";
import { monthShort } from "../lib/format";

export function MonthSegmented({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  return <Segmented value={month} onChange={onChange} options={MOCK.MONTHS.map((m) => ({ value: m, label: monthShort(m) }))} />;
}
