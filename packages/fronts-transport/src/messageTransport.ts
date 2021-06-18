/* eslint-disable @typescript-eslint/ban-types */
import { ListenerOptions, Transport, TransportOptions } from 'data-transport';
import { postMessageToFrames } from './postMessage';

interface MessageTransportOptions extends Partial<TransportOptions> {
  /**
   * Specify what the origin of targetWindow must be for the event to be dispatched,
   * by default, it's the literal string "*" (indicating no preference).
   */
  targetOrigin?: string;
}

class MessageTransport<T = {}> extends Transport<T> {
  constructor({
    targetOrigin = '*',
    listener = (callback) => {
      const handler = ({ data }: MessageEvent<ListenerOptions>) => {
        callback(data);
        postMessageToFrames(data, targetOrigin);
      };
      window.addEventListener('message', handler);
      return () => {
        window.removeEventListener('message', handler);
      };
    },
    sender = (message) => {
      window.top.postMessage(message, targetOrigin);
      postMessageToFrames(message, targetOrigin);
    },
    checkListen = false,
    ...options
  }: MessageTransportOptions) {
    super({
      ...options,
      checkListen,
      listener,
      sender,
    });
  }
}

export const transport = new MessageTransport({});
