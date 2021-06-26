import { SendOptions } from 'data-transport';

const postMessageToFrames: Window['postMessage'] = (message, targetOrigin) => {
  Array.from(document.getElementsByTagName('iframe')).forEach((frame) => {
    const isFronts = !!frame.getAttribute('data-fronts');
    if (isFronts) {
      frame.contentWindow!.postMessage(message, targetOrigin);
    }
  });
};
export const broadcastMessage: Window['postMessage'] = (
  message: SendOptions<{}> & { downward?: boolean },
  targetOrigin
) => {
  if (!message?.__DATA_TRANSPORT_UUID__) return;
  if (!message?.downward) {
    const isParentFronts = !!window.name && /^fronts/.test(window.name);
    if (isParentFronts) {
      window.parent.postMessage(message, targetOrigin);
    } else {
      // The fronts apps of the top level, and start spreading the message downward
      message.downward = true;
      postMessageToFrames(message, targetOrigin);
    }
  } else {
    postMessageToFrames(message, targetOrigin);
  }
};
