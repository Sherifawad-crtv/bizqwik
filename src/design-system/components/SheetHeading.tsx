/** The heading at the top of a sheet: a small kicker label over the title. */
export function SheetHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <div className="bq-label">{kicker}</div>
      <div className="bq-title bq-rise">{title}</div>
    </>
  );
}
