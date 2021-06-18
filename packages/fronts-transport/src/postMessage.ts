export const postMessageToFrames: Window['postMessage'] = (message, targetOrigin) => {
  Array.from(document.getElementsByTagName('iframe')).forEach((frame) => {
    const isFronts = !!frame.getAttribute('data-fronts');
    if (isFronts) {
      frame.contentWindow!.postMessage(message, targetOrigin);
    }
  });
}
