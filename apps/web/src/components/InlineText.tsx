const CODE_MARK = "`";

export function InlineText({ text }: { text: string }) {
  const parts = text.split(CODE_MARK);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code key={`${index.toString()}-${part}`} className="inline-code">
        {part}
      </code>
    ) : (
      part
    ),
  );
}
