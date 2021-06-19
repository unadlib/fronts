import React, { memo, useCallback, useEffect, useState } from 'react';
import { getIframeUrl } from 'fronts';
import { UseIframe } from './interface';

/**
 *
 */
export const useIframe: UseIframe = ({ name, url = '', attrs = {} }) => {
  const Iframe = useCallback(
    memo(() => {
      const [iframeUrl, setIframeUrl] = useState(url);
      if (__DEV__) {
        if (Object.hasOwnProperty.call(attrs, 'src')) {
          console.warn(
            `The iframe component of the site named "${name}" does not pass "src" props.`
          );
        }
      }
      useEffect(() => {
        !iframeUrl &&
          getIframeUrl(name).then((url) => {
            setIframeUrl(url);
          });
      }, []);
      const uid = Math.random().toString(36).slice(2, -1);
      return iframeUrl ? (
        <iframe frameBorder="no" {...attrs} src={iframeUrl} data-fronts={uid} />
      ) : null;
    }),
    [name]
  );
  return Iframe;
};
