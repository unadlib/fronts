export const injectScript = ({
  url,
  resolve,
  reject,
}: {
  url: string;
  resolve?: (value: unknown) => void;
  reject?: (reason?: any) => void;
}) => {
  // TODO: resolve browser compatibility issues
  const element = document.createElement('script');
  element.src = url;
  element.async = true;
  element.type = 'text/javascript';
  element.onload = () => {
    resolve?.(null);
    document.head.removeChild(element);
  };
  element.onerror = () => {
    // TODO: retry load script from urls
    document.head.removeChild(element);
    reject?.(`Script Error: ${url}`);
  };
  document.head.appendChild(element);
};
