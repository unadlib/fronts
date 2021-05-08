import React, { memo, useCallback, useEffect, useState } from 'react';
import { getIFrameUrl } from 'fronts';
import { UseIFrame } from './interface';

// TODO: pass `props`
/**
 *
 */
export const useIFrame: UseIFrame = ({ name }) => {
  const IFrame = useCallback(
    memo((props) => {
      const [url, setUrl] = useState('');
      if (__DEV__) {
        if (Object.hasOwnProperty.call(props, 'src')) {
          console.warn(
            `The iframe component of the site named "${name}" does not pass "src" props.`
          );
        }
      }
      useEffect(() => {
        getIFrameUrl(name).then((url) => {
          setUrl(url);
        });
      }, []);
      return url ? <iframe frameBorder="no" {...props} src={url} /> : null;
    }),
    [name]
  );
  return IFrame;
};
