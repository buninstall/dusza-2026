import { useMemo } from "react";
import { tokenizeLine } from "../editor/language.ts";
import { useEngine } from "../engine/useEngine.ts";

type CodeListingProps = { code: string; caption?: string; currentLine?: number | null };

export function CodeListing({ code, caption, currentLine = null }: CodeListingProps) {
  const engine = useEngine();
  const keywords = useMemo(() => new Set(engine.keywords()), [engine]);
  const lines = code.split("\n");
  const listing = (
    <pre className="manual-code">
      <code>
        {lines.map((line, row) => (
          <span
            key={`${row.toString()}-${line}`}
            className="manual-code-line"
            data-current={currentLine === row + 1 || undefined}
          >
            <span aria-hidden="true" className="manual-line-no">
              {row + 1}
            </span>
            {tokenizeLine(line, keywords).map((token, column) => (
              <span key={`${column.toString()}-${token.text}`} data-token={token.kind ?? undefined}>
                {token.text}
              </span>
            ))}
            {"\n"}
          </span>
        ))}
      </code>
    </pre>
  );
  if (caption === undefined) {
    return listing;
  }
  return (
    <figure className="manual-sample">
      <figcaption className="manual-caption">{caption}</figcaption>
      {listing}
    </figure>
  );
}
