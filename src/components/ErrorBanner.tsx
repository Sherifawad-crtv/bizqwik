/** A form or action error, shown under what it's about (a soft red box). */
export function ErrorBanner({ text }: { text: string }) {
  return <div className="bq-error bq-error--spaced">{text}</div>;
}
