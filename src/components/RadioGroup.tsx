import { useRef, type KeyboardEvent, type ReactNode } from "react";

interface Option<T extends string> { value: T; content: ReactNode; className?: (checked: boolean) => string }

/**
 * Accessible radio group (WAI-ARIA pattern): one tab stop, arrow keys move and
 * select, Home/End jump. Arrow direction follows `dir` (mirrored in RTL).
 */
export function RadioGroup<T extends string>({ label, value, onChange, options, className }: {
  label: string; value: T; onChange: (v: T) => void; options: Option<T>[]; className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  const onKey = (e: KeyboardEvent, i: number) => {
    const rtl = document.documentElement.dir === "rtl";
    const next = rtl ? "ArrowLeft" : "ArrowRight", prev = rtl ? "ArrowRight" : "ArrowLeft";
    if (e.key === next || e.key === "ArrowDown") { e.preventDefault(); move(i + 1); }
    else if (e.key === prev || e.key === "ArrowUp") { e.preventDefault(); move(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); move(0); }
    else if (e.key === "End") { e.preventDefault(); move(options.length - 1); }
  };
  return (
    <div role="radiogroup" aria-label={label} className={className}>
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={checked}
            tabIndex={checked ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => onKey(e, i)} className={o.className?.(checked)}>
            {o.content}
          </button>
        );
      })}
    </div>
  );
}
