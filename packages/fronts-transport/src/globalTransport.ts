/* eslint-disable @typescript-eslint/ban-types */
import { ListenerOptions, Transport, TransportOptions } from 'data-transport';
import { broadcastMessage } from './postMessage';

interface GlobalTransportOptions extends Partial<TransportOptions> {
  /**
   * Specify what the origin of targetWindow must be for the event to be dispatched,
   * by default, it's the literal string "*" (indicating no preference).
   */
  targetOrigin?: string;
}

export class GlobalTransport<T = any, P = any> extends Transport<T, P> {
  constructor({
    targetOrigin = '*',
    listener = (callback) => {
      const handler = ({ data }: MessageEvent<ListenerOptions>) => {
        callback(data);
        broadcastMessage(data, targetOrigin);
      };
      window.addEventListener('message', handler);
      return () => {
        window.removeEventListener('message', handler);
      };
    },
    sender = (message) => {
      const isParentFronts = !!window.name && /^fronts/.test(window.name);
      if (isParentFronts) {
        window.parent.postMessage(message, targetOrigin);
      } else {
        window.postMessage(message, targetOrigin);
      }
    },
    checkListen = false,
    ...options
  }: GlobalTransportOptions) {
    super({
      ...options,
      checkListen,
      listener,
      sender,
    });
  }
}

export const globalTransport = new GlobalTransport({});
