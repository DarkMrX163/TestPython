import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface PythonCodeBlockProps {
  code: string;
  filename?: string;
}

const KEYWORDS = new Set([
  'def',
  'return',
  'if',
  'elif',
  'else',
  'for',
  'while',
  'in',
  'and',
  'or',
  'not',
  'break',
  'continue',
  'True',
  'False',
  'None',
  'import',
  'from',
  'as',
  'pass',
]);

const BUILTINS = new Set([
  'print',
  'len',
  'type',
  'range',
  'int',
  'str',
  'float',
  'list',
  'dict',
  'set',
  'sum',
  'input',
]);

interface Token {
  type: 'comment' | 'string' | 'keyword' | 'builtin' | 'number' | 'plain';
  value: string;
}

function tokenizePythonLine(line: string): Token[] {
  const tokens: Token[] = [];
  const regex =
    /(#.*$)|((?:f|r)?(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))|\b(\d+(?:\.\d+)?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'plain', value: line.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      tokens.push({ type: 'comment', value: match[1] });
    } else if (match[2]) {
      tokens.push({ type: 'string', value: match[2] });
    } else if (match[3]) {
      tokens.push({ type: 'number', value: match[3] });
    } else if (match[4]) {
      const word = match[4];
      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (BUILTINS.has(word)) {
        tokens.push({ type: 'builtin', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ type: 'plain', value: line.slice(lastIndex) });
  }

  return tokens;
}

function tokenClass(type: Token['type']): string {
  switch (type) {
    case 'comment':
      return 'text-[#8B949E] italic';
    case 'string':
      return 'text-[#A5D6FF]';
    case 'keyword':
      return 'text-[#FF7B72] font-medium';
    case 'builtin':
      return 'text-[#D2A8FF]';
    case 'number':
      return 'text-[#79C0FF]';
    default:
      return 'text-[#E6EDF3]';
  }
}

export function PythonCodeBlock({ code, filename = 'task.py' }: PythonCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable in restricted contexts
    }
  };

  return (
    <div className="rounded-lg border border-[#30363D] bg-[#0D1117] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363D] bg-[#161B22]">
        <span className="font-mono text-xs text-[#8B949E] truncate">{filename}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-[#8B949E] hover:text-[#E6EDF3] rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#3FB950]"
          aria-label="Скопировать код"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#3FB950]" />
              <span className="text-[#3FB950]">Скопировано</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Копировать</span>
            </>
          )}
        </button>
      </div>
      <div className="p-4 overflow-x-auto font-mono text-sm sm:text-[15px] leading-relaxed">
        <pre className="m-0">
          {lines.map((line, idx) => (
            <div key={idx} className="flex">
              <span
                className="select-none w-7 pr-3 text-right text-[#484F58] tabular-nums shrink-0"
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <code className="whitespace-pre">
                {line.length === 0 ? (
                  '\u00A0'
                ) : (
                  tokenizePythonLine(line).map((tok, tIdx) => (
                    <span key={tIdx} className={tokenClass(tok.type)}>
                      {tok.value}
                    </span>
                  ))
                )}
              </code>
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
