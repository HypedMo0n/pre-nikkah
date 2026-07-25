// §7.1: "two overlapping outlined circles (44px each, 1.5px stroke, second
// at 0.45 opacity, overlapping by 16px)". §7.10's hard constraint ties this
// to the Path node glyph — both read as the same idea at different scales,
// so this stays a plain two-circle ring pair, nothing more.
const SIZE = 44;
const OVERLAP = 16;
const STROKE_WIDTH = 1.5;

export function BrandMark() {
  const radius = SIZE / 2 - STROKE_WIDTH / 2;
  const totalWidth = SIZE * 2 - OVERLAP;
  return (
    <svg aria-hidden="true" height={SIZE} viewBox={`0 0 ${totalWidth} ${SIZE}`} width={totalWidth}>
      <circle cx={SIZE / 2} cy={SIZE / 2} fill="none" r={radius} stroke="var(--green)" strokeWidth={STROKE_WIDTH} />
      <circle
        cx={totalWidth - SIZE / 2}
        cy={SIZE / 2}
        fill="none"
        opacity={0.45}
        r={radius}
        stroke="var(--green)"
        strokeWidth={STROKE_WIDTH}
      />
    </svg>
  );
}
