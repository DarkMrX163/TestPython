import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

interface PythonCodeBlockProps {
  code: string;
  filename?: string;
  activeLine?: number | null;
  // Interactive Find-Bug debugger props
  interactiveBugMode?: boolean;
  selectedLine?: number | null;
  buggyLine?: number;
  fixedLine?: string;
  revealed?: boolean;
  onSelectLine?: (lineNumber: number) => void;
  // Interactive Fill-in-the-blank props
  blankValue?: string;
  blankState?: 'idle' | 'correct' | 'wrong';
  blankPlaceholder?: string;
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

function renderHighlightedSegment(segment: string) {
  return tokenizePythonLine(segment).map((tok, tIdx) => (
    <span key={tIdx} className={tokenClass(tok.type)}>
      {tok.value}
    </span>
  ));
}

export function PythonCodeBlock({
  code,
  filename = 'task.py',
  activeLine = null,
  interactiveBugMode = false,
  selectedLine = null,
  buggyLine,
  fixedLine,
  revealed = false,
  onSelectLine,
  blankValue,
  blankState = 'idle',
  blankPlaceholder = '___',
}: PythonCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const lines = code.split('\n');

  const handleCopy = async () => {
    try {
      const textToCopy =
        blankValue && code.includes('___') ? code.replace('___', blankValue) : code;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API unavailable
    }
  };

  return (
    <div className="rounded-lg border border-[#30363D] bg-[#0D1117] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#30363D] bg-[#161B22]">
        <div className="flex items-center gap-2 font-mono text-xs text-[#8B949E] min-w-0">
          <span className="truncate">{filename}</span>
          {interactiveBugMode && !revealed && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#E3B341] whitespace-nowrap">Нажми на строку с ошибкой</span>
            </>
          )}
          {activeLine !== null && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-[#3FB950] whitespace-nowrap tabular-nums">
                Строка {activeLine}
              </span>
            </>
          )}
        </div>
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

      <div className="py-3 overflow-x-auto font-mono text-sm sm:text-[15px] leading-relaxed">
        <div className="min-w-max">
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const isTraceActive = activeLine === lineNum;
            const isSelectedBug = selectedLine === lineNum;
            const isActualBug = revealed && buggyLine === lineNum;
            const isWrongPick = revealed && isSelectedBug && buggyLine !== lineNum;

            let rowBg = '';
            if (isActualBug) {
              rowBg = 'bg-[#2EA043]/15';
            } else if (isWrongPick) {
              rowBg = 'bg-[#F85149]/15';
            } else if (isTraceActive) {
              rowBg = 'bg-[#58A6FF]/15';
            } else if (interactiveBugMode && !revealed) {
              rowBg = 'hover:bg-[#21262D]';
            }

            const renderLineContent = () => {
              if (line.length === 0) return '\u00A0';
              if (line.includes('___') && blankValue !== undefined) {
                const parts = line.split('___');
                const slotStyle =
                  blankState === 'correct'
                    ? 'border-[#3FB950] bg-[#2EA043]/20 text-[#3FB950]'
                    : blankState === 'wrong'
                      ? 'border-[#F85149] bg-[#F85149]/20 text-[#F85149]'
                      : blankValue
                        ? 'border-[#58A6FF] bg-[#58A6FF]/15 text-[#E6EDF3]'
                        : 'border-[#E3B341]/70 bg-[#E3B341]/10 text-[#E3B341]';

                return (
                  <>
                    {renderHighlightedSegment(parts[0])}
                    <span
                      className={`inline-block px-2 py-0.5 mx-0.5 rounded border text-sm font-semibold align-baseline ${slotStyle}`}
                    >
                      {blankValue || blankPlaceholder}
                    </span>
                    {renderHighlightedSegment(parts.slice(1).join('___'))}
                  </>
                );
              }
              return renderHighlightedSegment(line);
            };

            const innerRow = (
              <>
                <span
                  className={`select-none w-11 pr-3 text-right tabular-nums shrink-0 inline-flex items-center justify-end gap-1 ${
                    isTraceActive
                      ? 'text-[#58A6FF] font-semibold'
                      : isActualBug
                        ? 'text-[#3FB950] font-semibold'
                        : isWrongPick
                          ? 'text-[#F85149] font-semibold'
                          : 'text-[#484F58]'
                  }`}
                  aria-hidden="true"
                >
                  {isTraceActive && <span>→</span>}
                  <span>{lineNum}</span>
                </span>
                <code className="whitespace-pre flex-1">{renderLineContent()}</code>
                {isActualBug && (
                  <span className="ml-4 pr-4 text-xs text-[#3FB950] whitespace-nowrap shrink-0">
                    {isSelectedBug ? '✓ Баг найден' : '← Строка с багом'}
                  </span>
                )}
                {isWrongPick && (
                  <span className="ml-4 pr-4 text-xs text-[#F85149] whitespace-nowrap shrink-0">
                    ✕ Здесь нет ошибки
                  </span>
                )}
              </>
            );

            if (interactiveBugMode) {
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={revealed}
                  onClick={() => onSelectLine?.(lineNum)}
                  className={`w-full px-2 py-1.5 flex items-center text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#3FB950] ${rowBg} ${
                    revealed ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  {innerRow}
                </button>
              );
            }

            return (
              <div key={idx} className={`px-2 py-0.5 flex items-center ${rowBg}`}>
                {innerRow}
              </div>
            );
          })}
        </div>

        {/* Fixed Diff Preview after Find-Bug reveal */}
        {interactiveBugMode && revealed && fixedLine && buggyLine && (
          <div className="mt-3 mx-3 rounded border border-[#30363D] bg-[#161B22] px-3 py-2 text-xs space-y-1">
            <div className="text-[#8B949E]">Исправление строки {buggyLine}:</div>
            <div className="text-[#3FB950] whitespace-pre">+ {fixedLine}</div>
          </div>
        )}
      </div>
    </div>
  );
}
