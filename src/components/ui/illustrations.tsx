import type { SVGProps } from "react";

/**
 * Decorative illustrations for the "natural" theme (all aria-hidden).
 * Colours are deliberately muted, real-world coat colours rather than saturated cartoon tones.
 */

const LEAF = "M0 0C-9-5-17-14-10-22C-5-27 0-24 0-19C0-24 5-27 10-22C17-14 9-5 0 0Z";

const CLOVER = { leaf: "#7f9065", vein: "#4a533b" };

/** Coat palettes. */
const TABBY = { fur: "#c9a57f", stripe: "#a7845f", light: "#f1e6d6", ear: "#e3b9a8", eye: "#3b3a2e", nose: "#c98f84" };
const GREY = { fur: "#b9b4ab", stripe: "#958f86", light: "#efebe4", ear: "#e2bdb2", eye: "#2f3328", nose: "#c4928a" };
type Coat = typeof TABBY;

function CloverShape({ leaf, vein, stem = true }: { leaf: string; vein: string; stem?: boolean }) {
  return (
    <g>
      {stem && <path d="M1 2C4 14 3 24-4 34" stroke={vein} strokeWidth="3" fill="none" strokeLinecap="round" />}
      {[0, 90, 180, 270].map((r) => (
        <g key={r} transform={`rotate(${r + 45})`}>
          <path d={LEAF} fill={leaf} />
          <path d="M0-2V-17" stroke={vein} strokeWidth="1.2" strokeLinecap="round" opacity="0.45" />
        </g>
      ))}
      <circle r="2.5" fill={vein} opacity="0.55" />
    </g>
  );
}

export function Clover({ size = 24, leaf = "currentColor", vein = "rgba(0,0,0,.25)", ...rest }: SVGProps<SVGSVGElement> & { size?: number; leaf?: string; vein?: string }) {
  return (
    <svg width={size} height={size} viewBox="-30 -30 60 68" aria-hidden="true" {...rest}>
      <CloverShape leaf={leaf} vein={vein} />
    </svg>
  );
}

/** Kitten head (big eyes) centred at (0,0), roughly 100×90. */
function KittenHead({ c, blink = false }: { c: Coat; blink?: boolean }) {
  return (
    <g>
      <path d="M-40-8L-44-52L-10-32Z" fill={c.fur} />
      <path d="M40-8L44-52L10-32Z" fill={c.fur} />
      <path d="M-35-16L-38-42L-17-30Z" fill={c.ear} />
      <path d="M35-16L38-42L17-30Z" fill={c.ear} />
      <ellipse cx="0" cy="0" rx="46" ry="38" fill={c.fur} />
      <path d="M-12-36c2 7 2 12 0 18M0-38v20M12-36c-2 7-2 12 0 18" stroke={c.stripe} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M-46 0c6-1 10 1 13 4M46 0c-6-1-10 1-13 4" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" fill="none" />
      <ellipse cx="0" cy="14" rx="22" ry="15" fill={c.light} />
      {blink ? (
        <>
          <path d="M-24 0q7 6 14 0M10 0q7 6 14 0" stroke={c.eye} strokeWidth="3" strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <ellipse cx="-17" cy="-1" rx="8" ry="9.5" fill={c.eye} />
          <ellipse cx="17" cy="-1" rx="8" ry="9.5" fill={c.eye} />
          <circle cx="-14" cy="-5" r="3" fill="#fff" />
          <circle cx="20" cy="-5" r="3" fill="#fff" />
          <circle cx="-19.5" cy="2.5" r="1.3" fill="#fff" opacity=".8" />
          <circle cx="14.5" cy="2.5" r="1.3" fill="#fff" opacity=".8" />
        </>
      )}
      <path d="M-4 9h8l-4 4.5z" fill={c.nose} />
      <path d="M0 13.5c0 4-3.5 6-7 5M0 13.5c0 4 3.5 6 7 5" stroke="#6b5a4a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <ellipse cx="-29" cy="12" rx="6.5" ry="3.8" fill="#e6a99a" opacity=".45" />
      <ellipse cx="29" cy="12" rx="6.5" ry="3.8" fill="#e6a99a" opacity=".45" />
      <path d="M-24 9L-48 4M-24 14L-48 16M24 9L48 4M24 14L48 16" stroke="#6b5a4a" strokeWidth="1.3" strokeLinecap="round" opacity=".45" />
    </g>
  );
}

/** A sitting tabby cat holding a four-leaf clover. */
export function CatWithClover(props: SVGProps<SVGSVGElement>) {
  const c = TABBY;
  return (
    <svg viewBox="0 0 220 220" aria-hidden="true" {...props}>
      <ellipse cx="110" cy="205" rx="68" ry="7" fill="rgba(60,50,40,.12)" />
      <path d="M150 192C192 190 202 150 183 128C176 120 167 124 171 132C183 152 175 175 146 177Z" fill={c.fur} />
      <path d="M177 134c5 4 6 9 5 14M184 153c-2 6-6 10-11 13" stroke={c.stripe} strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M62 197C52 150 70 112 110 112C150 112 168 150 158 197Z" fill={c.fur} />
      <path d="M86 197C82 160 92 135 110 135C128 135 138 160 134 197Z" fill={c.light} />
      <path d="M72 150c8 2 12 6 14 12M148 150c-8 2-12 6-14 12M70 172c8 1 12 4 15 9" stroke={c.stripe} strokeWidth="4" strokeLinecap="round" fill="none" />
      <ellipse cx="92" cy="198" rx="15" ry="8.5" fill={c.light} />
      <ellipse cx="128" cy="198" rx="15" ry="8.5" fill={c.light} />
      <g transform="translate(110 84)"><KittenHead c={c} /></g>
      <g transform="translate(110 172) scale(.9)"><CloverShape {...CLOVER} /></g>
    </svg>
  );
}

/** A grey kitten peeking over an edge, paws first. Place it so its bottom sits on a card's top border. */
export function CatPeeking(props: SVGProps<SVGSVGElement>) {
  const c = GREY;
  return (
    <svg viewBox="0 0 160 92" aria-hidden="true" {...props}>
      <g transform="translate(80 54)"><KittenHead c={c} /></g>
      <ellipse cx="50" cy="88" rx="15" ry="9" fill={c.light} />
      <ellipse cx="110" cy="88" rx="15" ry="9" fill={c.light} />
      <path d="M44 90v-5M50 91v-6M56 90v-5M104 90v-5M110 91v-6M116 90v-5" stroke={c.stripe} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** A tabby kitten reading an open book. */
export function CatReading(props: SVGProps<SVGSVGElement>) {
  const c = TABBY;
  return (
    <svg viewBox="0 0 200 150" aria-hidden="true" {...props}>
      <ellipse cx="100" cy="144" rx="78" ry="5" fill="rgba(60,50,40,.1)" />
      <g transform="translate(100 62)"><KittenHead c={c} /></g>
      {/* book */}
      <path d="M100 108C80 98 50 98 26 104V142C50 136 80 136 100 146Z" fill="#f7f2e7" stroke="#d8cfbd" strokeWidth="2" />
      <path d="M100 108C120 98 150 98 174 104V142C150 136 120 136 100 146Z" fill="#fbf8f1" stroke="#d8cfbd" strokeWidth="2" />
      <path d="M38 114c16-4 34-4 50 1M38 123c16-4 34-4 50 1M38 132c16-4 34-4 50 1M112 115c16-5 34-5 50-1M112 124c16-5 34-5 50-1" stroke="#cfc5b1" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M100 108V146" stroke="#d8cfbd" strokeWidth="2" />
      {/* paws on the book */}
      <ellipse cx="72" cy="106" rx="12" ry="7" fill={c.light} />
      <ellipse cx="128" cy="106" rx="12" ry="7" fill={c.light} />
      <g transform="translate(150 118) scale(.32) rotate(20)"><CloverShape {...CLOVER} stem={false} /></g>
    </svg>
  );
}

/** A small grey cat curled up asleep. */
export function SleepingCat(props: SVGProps<SVGSVGElement>) {
  const c = GREY;
  return (
    <svg viewBox="0 0 120 60" aria-hidden="true" {...props}>
      <ellipse cx="60" cy="55" rx="46" ry="4" fill="rgba(60,50,40,.1)" />
      <path d="M18 52C14 30 34 18 62 18C92 18 106 32 102 52Z" fill={c.fur} />
      <path d="M100 50C110 48 112 40 104 36C98 33 92 40 90 46Z" fill={c.stripe} />
      <path d="M40 24c3 6 3 12 0 18M58 20v20M76 22c-2 6-2 12 0 18" stroke={c.stripe} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M14 46L16 30L30 38Z" fill={c.fur} />
      <circle cx="26" cy="45" r="13" fill={c.fur} />
      <path d="M20 45q3 2 6 0M29 45q3 2 6 0" stroke={c.eye} strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <text x="40" y="12" fontSize="9" fill="#8f9a76" fontFamily="sans-serif" fontWeight="600">z z</text>
    </svg>
  );
}
