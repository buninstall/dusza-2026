import { InlineText } from "../components/InlineText.tsx";
import { Notice } from "../components/Notice.tsx";
import { NumberedHeading } from "../components/NumberedHeading.tsx";
import type { ManualBlock, ManualSection } from "../i18n/hu-manual.ts";
import { Bench } from "./Bench.tsx";
import { CodeListing } from "./CodeListing.tsx";

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

function Block({ block }: { block: ManualBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <p className="manual-paragraph">
          <InlineText text={block.text} />
        </p>
      );
    case "list":
      return (
        <ul className="manual-list">
          {block.items.map((item) => (
            <li key={item}>
              <InlineText text={item} />
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="manual-steps">
          {block.items.map((item) => (
            <li key={item}>
              <InlineText text={item} />
            </li>
          ))}
        </ol>
      );
    case "tip":
      return (
        <div className="manual-tip">
          <Notice tone="info" title={block.title}>
            <p>
              <InlineText text={block.text} />
            </p>
          </Notice>
        </div>
      );
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

export function Section({ section, index }: { section: ManualSection; index: number }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="manual-section">
      <NumberedHeading id={`${section.id}-title`} number={index + 1} title={section.title} />
      {section.blocks.map((block, position) => (
        <Block key={`${section.id}-${position.toString()}`} block={block} />
      ))}
    </section>
  );
}
