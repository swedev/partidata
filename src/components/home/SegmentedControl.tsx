import { Fragment, useId } from 'react';
import type { Segment } from './segments';

export interface SegmentedControlProps<T extends string> {
  legend: string;
  value: T;
  segments: Segment<T>[];
  onChange: (value: T) => void;
}

/**
 * A single choice shown as a joined row of segments. The radios carry the
 * semantics — one tab stop, arrow keys within the group, disabled segments
 * skipped — so the row needs no keyboard code of its own.
 */
function SegmentedControl<T extends string> ({ legend, value, segments, onChange }: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className="home-segments">
      <legend className="sr-only">{legend}</legend>
      {segments.map(segment => {
        // The description has to sit outside the label; inside it would become
        // part of the segment's own name.
        const noteId = segment.title ? `${name}-${segment.value || 'alla'}-note` : undefined;
        return (
          <Fragment key={segment.value}>
            <label className="home-segment" title={segment.title}>
              <input
                className="sr-only"
                type="radio"
                name={name}
                value={segment.value}
                checked={value === segment.value}
                disabled={segment.disabled}
                aria-describedby={noteId}
                onChange={() => onChange(segment.value)}
              />
              <span className="home-segment__text">{segment.label}</span>
            </label>
            {noteId && <span id={noteId} className="sr-only">{segment.title}</span>}
          </Fragment>
        );
      })}
    </fieldset>
  );
}

export default SegmentedControl;
