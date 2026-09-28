import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';

/** The centre's letterhead block, as the other printed sheets draw it. */
export const CentreLetterhead: React.FC<{ centre?: CentreProfile }> = ({ centre = CENTRE }) => {
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const mailLine = contactLine([
    ['Mail-ID', centre.email],
    ['WebSite', centre.website],
  ]);
  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  return (
    <div className="flex min-h-[86px] items-stretch border-b border-black">
      <div className="flex w-[120px] shrink-0 flex-col items-center justify-center border-r border-black px-1 py-1 text-center">
        {logoShown && (
          <img
            src={centre.logoUrl}
            alt=""
            className="max-h-[62px] max-w-full object-contain"
            onError={() => setLogoShown(false)}
          />
        )}
        {centre.tagline && <span className="mt-[2px] text-[6px] leading-[7px]">{centre.tagline}</span>}
        {centre.unitLine && <span className="text-[6px] leading-[7px]">{centre.unitLine}</span>}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1">
        <p className="text-[13px] font-bold leading-[15px]">{centre.name}</p>
        {centre.address && <p className="text-[8px] leading-[10px]">{centre.address}</p>}
        {mailLine && <p className="text-[8px] leading-[10px]">{mailLine}</p>}
        {phoneLine && <p className="text-[8px] leading-[10px]">{phoneLine}</p>}
      </div>
    </div>
  );
};

export default CentreLetterhead;
