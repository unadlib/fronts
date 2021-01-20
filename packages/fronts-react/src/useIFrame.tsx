import React, { memo, useCallback, FunctionComponent } from 'react';
import { useIFrame as useIFrameURL } from 'fronts';

export const useIFrame = <
  T extends { [k: string]: any } = { [k: string]: any }
>(
  siteName: string
): FunctionComponent<T> => {
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
