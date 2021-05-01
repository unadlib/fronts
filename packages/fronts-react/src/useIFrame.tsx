import React, { memo, useCallback } from 'react';
import { useIFrame as useIFrameURL } from 'fronts';
import { UseIFrame } from './interface';

// TODO: pass `props`
export const useIFrame: UseIFrame = (siteName) => {
  const IFrame = useCallback(
    memo((props) => {
      if (__DEV__) {
        if (Object.hasOwnProperty.call(props, 'src')) {
          console.warn(
            `The iframe component of the site named "${siteName}" does not pass "src" props.`
          );
        }
      }
      const url = useIFrameURL(siteName);
      return <iframe frameBorder="no" {...props} src={url} />;
    }),
    [siteName]
  );
  return IFrame;
};
