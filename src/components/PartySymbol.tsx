import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { SymbolFrame } from 'src/server/party-data';

export interface PartySymbolProps {
  src: string;
  frame?: SymbolFrame;
  alt?: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}

/**
 * Renders a party symbol at the size of its drawing rather than the size of the
 * sheet it was delivered on: the frame takes the drawing's aspect ratio, and
 * the file is scaled and shifted inside it so the sheet's margins fall outside.
 * A symbol without a measured frame keeps the whole sheet and is fitted to the
 * box it is given.
 */
function PartySymbol ({ src, frame, alt = '', sizes, className, priority }: PartySymbolProps) {
  const classes = ['party-symbol', frame ? 'party-symbol--beskuren' : 'party-symbol--hel', className]
    .filter(Boolean)
    .join(' ');
  const image = {
    src,
    sizes,
    unoptimized: true,
    ...(alt ? {} : { 'aria-hidden': 'true' as const }),
    ...(priority ? { loading: 'eager' as const } : {}),
  };

  return (
    <span className={classes} style={frame ? { '--party-symbol-ratio': String(frame.ratio) } as CSSProperties : undefined}>
      {frame ? (
        <Image
          {...image}
          alt={alt}
          width={frame.bildbredd}
          height={frame.bildhojd}
          style={{
            position: 'absolute',
            width: `${frame.bredd * 100}%`,
            height: `${frame.hojd * 100}%`,
            left: `${frame.x * -100}%`,
            top: `${frame.y * -100}%`,
          }}
        />
      ) : (
        <Image {...image} alt={alt} fill />
      )}
    </span>
  );
}

export default PartySymbol;
