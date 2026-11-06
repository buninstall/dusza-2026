import { useMemo } from "react";
import { PageHeader } from "../components/PageHeader.tsx";
import { tokenizeLine } from "../editor/language.ts";
import { useEngine } from "../engine/useEngine.ts";
import { hu } from "../i18n/hu.ts";
import type { ManualBlock, ManualSection } from "../i18n/hu-manual.ts";
import "./ManualPage.css";

const CODE_MARK = "`";

export function InlineText({ text }: { text: string }) {
  const parts = text.split(CODE_MARK);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <code key={`${index.toString()}-${part}`} className="manual-inline-code">
        {part}
      </code>
    ) : (
      part
    ),
  );
}

function CodeSample({ code, caption }: { code: string; caption: string }) {
  const engine = useEngine();
  const keywords = useMemo(() => new Set(engine.keywords()), [engine]);
  const lines = code.split("\n");
  return (
    <figure className="manual-sample">
      <figcaption className="manual-caption">{caption}</figcaption>
      <pre className="manual-code">
        <code>
          {lines.map((line, row) => (
            <span key={`${row.toString()}-${line}`} className="manual-code-line">
              <span aria-hidden="true" className="manual-line-no">
                {row + 1}
              </span>
              {tokenizeLine(line, keywords).map((token, column) => (
                <span
                  key={`${column.toString()}-${token.text}`}
                  data-token={token.kind ?? undefined}
                >
                  {token.text}
                </span>
              ))}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </figure>
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
    case "code":
      return <CodeSample code={block.code} caption={block.caption} />;
    case "table":
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
}

function Section({ section, index }: { section: ManualSection; index: number }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="manual-section">
      <h2 id={`${section.id}-title`} className="manual-section-title">
        <span aria-hidden="true" className="manual-section-no">
          {String(index + 1).padStart(2, "0")}
        </span>
        {section.title}
      </h2>
      {section.blocks.map((block, position) => (
        <Block key={`${section.id}-${position.toString()}`} block={block} />
      ))}
    </section>
  );
}

export function ManualPage() {
  const { manual } = hu;
  return (
    <div className="manual-page">
      <PageHeader eyebrow={manual.eyebrow} title={manual.title} lead={manual.lead} />
      <div className="manual-layout">
        <nav aria-label={manual.tocLabel} className="manual-toc">
          <p className="manual-toc-title">{manual.tocLabel}</p>
          <ol className="manual-toc-list">
            {manual.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="manual-toc-link">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="manual-article">
          {manual.sections.map((section, index) => (
            <Section key={section.id} section={section} index={index} />
          ))}
        </article>
      </div>
    </div>
  );
}
