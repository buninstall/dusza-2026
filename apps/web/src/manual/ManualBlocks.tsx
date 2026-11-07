import { InlineText } from "../components/InlineText.tsx";
import type { ManualBlock } from "../i18n/hu-manual.ts";
import { hu } from "../i18n/hu.ts";
import { PixelIcon } from "../pixel/PixelIcon.tsx";
import { Bench } from "./Bench.tsx";
import { CodeListing } from "./CodeListing.tsx";

const LEAD_MARK = "**";

function LeadText({ text }: { text: string }) {
  if (!text.startsWith(LEAD_MARK)) {
    return <InlineText text={text} />;
  }
  const end = text.indexOf(LEAD_MARK, LEAD_MARK.length);
  if (end < 0) {
    return <InlineText text={text} />;
  }
  const lead = text.slice(LEAD_MARK.length, end);
  const rest = text.slice(end + LEAD_MARK.length).trimStart();
  return (
    <>
      <strong className="manual-lead">
        <InlineText text={lead} />
      </strong>{" "}
      <InlineText text={rest} />
    </>
  );
}

function TableBlock({ block }: { block: Extract<ManualBlock, { kind: "table" }> }) {
  return (
    <div className="manual-table-frame">
      <table className="manual-table">
        <caption>{block.caption}</caption>
        <thead>
          <tr>
            {block.head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row) => (
            <tr key={row.join("|")}>
              {row.map((cell, index) =>
                index === 0 ? (
                  <th key={cell} scope="row">
                    <InlineText text={cell} />
                  </th>
                ) : (
                  <td key={`${index.toString()}-${cell}`}>
                    <InlineText text={cell} />
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TipBlock({ block }: { block: Extract<ManualBlock, { kind: "tip" }> }) {
  return (
    <div role="note" className="manual-tip">
      <p className="manual-tip-head">
        <PixelIcon name="lantern" />
        <span className="manual-tip-kind">{hu.manual.tipLabel}</span>
        <span className="manual-tip-title">{block.title}</span>
      </p>
      <p className="manual-tip-text">
        <InlineText text={block.text} />
      </p>
    </div>
  );
}

export function Block({ block, isLede = false }: { block: ManualBlock; isLede?: boolean }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="manual-paragraph" data-lede={isLede || undefined}>
          <InlineText text={block.text} />
        </p>
      );
    case "heading":
      return <h3 className="manual-subhead">{block.text}</h3>;
    case "list":
      return (
        <ul className="manual-list">
          {block.items.map((item) => (
            <li key={item}>
              <LeadText text={item} />
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="manual-steps">
          {block.items.map((item) => (
            <li key={item}>
              <LeadText text={item} />
            </li>
          ))}
        </ol>
      );
    case "tip":
      return <TipBlock block={block} />;
    case "code":
      return block.map ? (
        <Bench code={block.code} map={block.map} caption={block.caption} />
      ) : (
        <CodeListing code={block.code} caption={block.caption} />
      );
    case "table":
      return <TableBlock block={block} />;
  }
}
