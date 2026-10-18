export const MATCH_THRESHOLD_MIN = 50;
export const MATCH_THRESHOLD_MAX = 90;
export const MATCH_THRESHOLD_DEFAULT = 60;

type MatchThresholdSliderProps = {
  value: number;
  onChange: (value: number) => void;
};

export function MatchThresholdSlider({ value, onChange }: MatchThresholdSliderProps) {
  return (
    <div className="match-threshold">
      <label htmlFor="match-threshold">
        <span>Minimum match</span>
        <span className="match-threshold-value">{value}%</span>
      </label>
      <input
        id="match-threshold"
        type="range"
        min={MATCH_THRESHOLD_MIN}
        max={MATCH_THRESHOLD_MAX}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
