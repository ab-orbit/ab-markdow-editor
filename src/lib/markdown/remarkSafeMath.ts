import remarkMath from 'remark-math';
import type { Options } from 'remark-math';
import type { Code, Construct, Effects, State, TokenizeContext, Extension } from 'micromark-util-types';
import { markdownLineEnding } from 'micromark-util-character';
import type {} from 'micromark-extension-math';

const dollar = 36, space = 32;
const isDigit = (code: Code) => code !== null && code >= 48 && code <= 57;
const isBlank = (code: Code) => code === null || code === space || markdownLineEnding(code);

/**
 * Single-dollar inline math follows the Pandoc `tex_math_dollars` rules so that currency
 * such as `R$274,43 e R$88,17` or `US$ 20` stays prose:
 * - the opening `$` may not be glued to a preceding letter or digit (`R$`, `US$`, `A$`);
 * - the opening `$` must be followed by a non-blank character;
 * - a closing `$` must be preceded by a non-blank character and must not be followed by a digit.
 * A rejected closer is treated as data and the search continues, like Pandoc.
 * Double-dollar inline math (`$$x$$`) keeps the upstream CommonMark-like behaviour.
 */
function tokenizeSafeMathText(this: TokenizeContext, effects: Effects, ok: State, nok: State): State {
  let sizeOpen = 0, size = 0, last: Code = null;
  let token: ReturnType<Effects['enter']>;
  const consume = (code: Code) => { effects.consume(code); last = code; };
  return start;

  function start(code: Code): State | undefined {
    effects.enter('mathText'); effects.enter('mathTextSequence');
    return sequenceOpen(code);
  }
  function sequenceOpen(code: Code): State | undefined {
    if (code === dollar) { consume(code); sizeOpen++; return sequenceOpen; }
    if (sizeOpen === 1 && isBlank(code)) return nok(code);
    effects.exit('mathTextSequence');
    return between(code);
  }
  function between(code: Code): State | undefined {
    if (code === null) return nok(code);
    if (code === dollar) {
      // A single-dollar closer may not follow whitespace; keep it as data instead.
      if (sizeOpen === 1 && isBlank(last)) { effects.enter('mathTextData'); consume(code); return data; }
      token = effects.enter('mathTextSequence'); size = 0;
      return sequenceClose(code);
    }
    if (code === space) { effects.enter('space'); consume(code); effects.exit('space'); return between; }
    if (markdownLineEnding(code)) { effects.enter('lineEnding'); consume(code); effects.exit('lineEnding'); return between; }
    effects.enter('mathTextData');
    return data(code);
  }
  function data(code: Code): State | undefined {
    if (code === null || code === space || code === dollar || markdownLineEnding(code)) { effects.exit('mathTextData'); return between(code); }
    consume(code);
    return data;
  }
  function sequenceClose(code: Code): State | undefined {
    if (code === dollar) { consume(code); size++; return sequenceClose; }
    // Currency: `R$10 e R$20` must not close at the `$` that precedes `20`.
    if (size === sizeOpen && !(sizeOpen === 1 && isDigit(code))) { effects.exit('mathTextSequence'); effects.exit('mathText'); return ok(code); }
    token.type = 'mathTextData';
    return data(code);
  }
}

/** Opening `$` cannot follow an escape, another `$`, or a letter/digit (currency prefixes such as `R$`). */
function previous(this: TokenizeContext, code: Code): boolean {
  if (code === dollar) return this.events[this.events.length - 1][1].type === 'characterEscape';
  return code === null || code < 0 || !/[\p{L}\p{N}]/u.test(String.fromCodePoint(code));
}

/** `remark-math` with currency-safe single-dollar inline math; block math and options are unchanged. */
export function remarkSafeMath(this: unknown, options?: Options) {
  (remarkMath as (this: unknown, options?: Options) => void).call(this, options);
  const extensions = (this as { data: () => { micromarkExtensions?: Extension[] } }).data().micromarkExtensions || [];
  const math = extensions[extensions.length - 1];
  const original = (math?.text as Record<number, Construct> | undefined)?.[dollar];
  if (original) (math.text as Record<number, Construct>)[dollar] = { ...original, tokenize: tokenizeSafeMathText, previous };
}
