export const getUrl = (externalLink: string) => {
  const link = new URL(externalLink.replace(/^.*@/, ''));
  const path = link.pathname.split('/').slice(0, -1).join('/');
  return `${link.origin}${path}`;
};
