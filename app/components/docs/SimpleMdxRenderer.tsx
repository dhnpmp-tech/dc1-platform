import React from 'react'

interface SimpleMdxRendererProps {
  source: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlightCode(code: string, language: string): string {
  const escaped = escapeHtml(code)
  const keywordPattern = /\b(const|let|var|function|return|if|else|for|while|class|import|from|export|def|print|try|except|await|async)\b/g
  const boolPattern = /\b(true|false|null|None)\b/g
  const numberPattern = /\b\d+(\.\d+)?\b/g
  const stringPattern = /("[^"]*"|'[^']*')/g

  if (!['ts', 'tsx', 'js', 'jsx', 'python', 'bash', 'json'].includes(language)) {
    return escaped
  }

  return escaped
    .replace(stringPattern, '<span class="hljs-string">$1</span>')
    .replace(keywordPattern, '<span class="hljs-keyword">$1</span>')
    .replace(boolPattern, '<span class="hljs-literal">$1</span>')
    .replace(numberPattern, '<span class="hljs-number">$1</span>')
}

function renderInlineLinks(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const pattern = /\[([^\]]+)\]\(([^)]+)\)/g
  let lastIndex = 0
  let match = pattern.exec(text)
  while (match) {
    const [full, label, href] = match
    const start = match.index
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start))
    }
    parts.push(
      <a key={`${href}-${start}`} href={href}>
        {label}
      </a>
    )
    lastIndex = start + full.length
    match = pattern.exec(text)
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }
  return parts
}

export default function SimpleMdxRenderer({ source }: SimpleMdxRendererProps) {
  const lines = source.split('\n')
  const blocks: React.ReactNode[] = []
  let index = 0
  let key = 0

  while (index < lines.length) {
    const line = lines[index]

    if (!line.trim()) {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      index += 1
      const codeLines: string[] = []
      while (index < lines.length && !lines[index].startsWith('```')) {
        codeLines.push(lines[index])
        index += 1
      }
      if (index < lines.length && lines[index].startsWith('```')) {
        index += 1
      }
      const code = codeLines.join('\n')
      blocks.push(
        <pre key={`pre-${key++}`}>
          <code
            className={`language-${language || 'text'} hljs`}
            dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
          />
        </pre>
      )
      continue
    }

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={`h3-${key++}`}>{line.slice(4).trim()}</h3>)
      index += 1
      continue
    }

    if (line.startsWith('## ')) {
      blocks.push(<h2 key={`h2-${key++}`}>{line.slice(3).trim()}</h2>)
      index += 1
      continue
    }

    if (line.startsWith('# ')) {
      blocks.push(<h1 key={`h1-${key++}`}>{line.slice(2).trim()}</h1>)
      index += 1
      continue
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\d+\.\s+/, '').trim())
        index += 1
      }
      blocks.push(
        <ol key={`ol-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-ol-item-${itemIndex}`}>{renderInlineLinks(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    if (line.startsWith('- ')) {
      const items: string[] = []
      while (index < lines.length && lines[index].startsWith('- ')) {
        items.push(lines[index].slice(2).trim())
        index += 1
      }
      blocks.push(
        <ul key={`ul-${key++}`}>
          {items.map((item, itemIndex) => (
            <li key={`${key}-ul-item-${itemIndex}`}>{renderInlineLinks(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Markdown table support
    if (line.trimStart().startsWith('|')) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('|')) {
        tableLines.push(lines[index])
        index += 1
      }

      const parseRow = (row: string): string[] =>
        row.split('|').slice(1, -1).map((cell) => cell.trim())

      const isSeparator = (row: string): boolean =>
        /^\|[\s:?-]+\|/.test(row) && row.includes('---')

      const headerRow = parseRow(tableLines[0])
      const dataStart = tableLines.length > 1 && isSeparator(tableLines[1]) ? 2 : 1
      const dataRows = tableLines.slice(dataStart).map(parseRow)

      blocks.push(
        <div key={`table-wrap-${key}`} className="overflow-x-auto my-6">
          <table key={`table-${key++}`} className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-dc1-border">
                {headerRow.map((cell, ci) => (
                  <th
                    key={`th-${key}-${ci}`}
                    className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-dc1-amber whitespace-nowrap"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, ri) => (
                <tr
                  key={`tr-${key}-${ri}`}
                  className="border-b border-dc1-border/40 hover:bg-dc1-surface-l2/50"
                >
                  {row.map((cell, ci) => (
                    <td
                      key={`td-${key}-${ri}-${ci}`}
                      className="px-4 py-2 text-dc1-text-secondary whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !lines[index].startsWith('#') &&
      !lines[index].startsWith('```') &&
      !lines[index].startsWith('- ') &&
      !lines[index].trimStart().startsWith('|') &&
      !/^\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(lines[index])
      index += 1
    }
    blocks.push(<p key={`p-${key++}`}>{renderInlineLinks(paragraphLines.join(' '))}</p>)
  }

  return <>{blocks}</>
}
