/**
 * Tiny markdown renderer (~50 lines).
 *
 * Handles:
 *  - **bold** → <strong>
 *  - `code` → <code>
 *  - - bullet and * bullet lines → <ul><li>
 *  - 1. numbered list lines → <ol><li>
 *  - blank-line separated paragraphs
 */

import * as React from "react"

interface Segment {
  type: "text" | "bold" | "code"
  content: string
}

function parseInline(text: string): Segment[] {
  const segments: Segment[] = []
  // split on **bold** and `code`
  const re = /(\*\*(.+?)\*\*|`([^`]+)`)/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: "text", content: text.slice(last, match.index) })
    }
    if (match[0].startsWith("**")) {
      segments.push({ type: "bold", content: match[2] })
    } else {
      segments.push({ type: "code", content: match[3] })
    }
    last = match.index + match[0].length
  }
  if (last < text.length) segments.push({ type: "text", content: text.slice(last) })
  return segments
}

function renderInline(text: string): React.ReactNode {
  const segs = parseInline(text)
  return segs.map((s, i) => {
    if (s.type === "bold") return <strong key={i} className="font-semibold">{s.content}</strong>
    if (s.type === "code") return <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{s.content}</code>
    return <React.Fragment key={i}>{s.content}</React.Fragment>
  })
}

type Block =
  | { kind: "p"; lines: string[] }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }

function parseBlocks(text: string): Block[] {
  const rawLines = text.split("\n")
  const blocks: Block[] = []
  let current: Block | null = null

  for (const raw of rawLines) {
    const line = raw

    if (line.trim() === "") {
      current = null
      continue
    }

    const ulMatch = /^[-*]\s+(.*)/.exec(line)
    const olMatch = /^\d+\.\s+(.*)/.exec(line)

    if (ulMatch) {
      if (current?.kind !== "ul") { current = { kind: "ul", items: [] }; blocks.push(current) }
      current.items.push(ulMatch[1])
    } else if (olMatch) {
      if (current?.kind !== "ol") { current = { kind: "ol", items: [] }; blocks.push(current) }
      current.items.push(olMatch[1])
    } else {
      if (current?.kind !== "p") { current = { kind: "p", lines: [] }; blocks.push(current) }
      current.lines.push(line)
    }
  }

  return blocks
}

export function MiniMarkdown({ text }: { text: string }): React.ReactElement {
  const blocks = parseBlocks(text)
  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, bi) => {
        if (block.kind === "ul") {
          return (
            <ul key={bi} className="ml-3 flex flex-col gap-0.5 list-disc list-outside">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item)}</li>
              ))}
            </ul>
          )
        }
        if (block.kind === "ol") {
          return (
            <ol key={bi} className="ml-3 flex flex-col gap-0.5 list-decimal list-outside">
              {block.items.map((item, ii) => (
                <li key={ii}>{renderInline(item)}</li>
              ))}
            </ol>
          )
        }
        // paragraph
        return (
          <p key={bi} className="leading-relaxed">
            {block.lines.map((l, li) => (
              <React.Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(l)}
              </React.Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
