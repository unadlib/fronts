import React, { memo, useCallback, useEffect, useState } from 'react';
import { getIframeUrl } from 'fronts';
import { UseIframe } from './interface';

// TODO: pass `props`
/**
 *
 */
export const useIframe: UseIframe = ({ name }) => {
  const Iframe = useCallback(
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
        getIframeUrl(name).then((url) => {
          setUrl(url);
        });
      }, []);
      return url ? <iframe frameBorder="no" {...props} src={url} /> : null;
    }),
    [name]
  );
  return Iframe;
};
