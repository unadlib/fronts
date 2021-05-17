// from `react-shadow-dom-retarget-events`

type Props = Record<string, (e: Event) => void>;

type Component = {
  memoizedProps?: Props;
  _currentElement?: { props?: Props };
};

type EventsMap = Record<string, string>;

const retargetedEvents = [
  'onAbort',
  'onAnimationCancel',
  'onAnimationEnd',
  'onAnimationIteration',
  'onAuxClick',
  'onBlur',
  'onChange',
  'onClick',
  'onClose',
  'onContextMenu',
  'onDoubleClick',
  'onError',
  'onFocus',
  'onGotPointerCapture',
  'onInput',
  'onKeyDown',
  'onKeyPress',
  'onKeyUp',
  'onLoad',
  'onLoadEnd',
  'onLoadStart',
  'onLostPointerCapture',
  'onMouseDown',
  'onMouseMove',
  'onMouseOut',
  'onMouseOver',
  'onMouseUp',
  'onPointerCancel',
  'onPointerDown',
  'onPointerEnter',
  'onPointerLeave',
  'onPointerMove',
  'onPointerOut',
  'onPointerOver',
  'onPointerUp',
  'onReset',
  'onResize',
  'onScroll',
  'onSelect',
  'onSelectionChange',
  'onSelectStart',
  'onSubmit',
  'onTouchCancel',
  'onTouchMove',
  'onTouchStart',
  'onTouchEnd',
  'onTransitionCancel',
  'onTransitionEnd',
  'onDrag',
  'onDragEnd',
  'onDragEnter',
  'onDragExit',
  'onDragLeave',
  'onDragOver',
  'onDragStart',
  'onDrop',
  'onFocusOut',
];

const divergentNativeEvents: EventsMap = {
  onDoubleClick: 'dblclick',
};

const mimickedReactEvents: EventsMap = {
  onInput: 'onChange',
  onFocusOut: 'onBlur',
  onSelectionChange: 'onSelect',
};

const findReactProperty = (
  item: EventTarget & Record<string, Component>,
  propertyPrefix: string
) => {
  for (const key in item) {
    // eslint-disable-next-line no-prototype-builtins
    if (item.hasOwnProperty(key) && key.indexOf(propertyPrefix) !== -1) {
      return (item as Record<string, Component | Props>)[key];
    }
  }
};

const findReactProps = (component: undefined | Component) =>
  component?.memoizedProps ?? // React 16 Fiber
  component?._currentElement?.props; // React <=15

type DispatchEvent = Event & {
  persist: () => void;
  isPersistent: () => boolean;
};

const dispatchEvent = (
  event: Event,
  eventType: string,
  componentProps: Props
) => {
  (event as DispatchEvent).persist = () => {
    (event as DispatchEvent).isPersistent = () => true;
  };

  if (componentProps[eventType]) {
    componentProps[eventType](event);
  }
};

const getNativeEventName = (reactEventName: string) => {
  if (divergentNativeEvents[reactEventName]) {
    return divergentNativeEvents[reactEventName];
  }
  return reactEventName.replace(/^on/, '').toLowerCase();
};

const composedPath = (element: EventTarget | HTMLElement | null) => {
  const path = [];
  while (element) {
    path.push(element);
    if ((element as HTMLElement).tagName === 'HTML') {
      path.push(document);
      path.push(window);
      return path;
    }
    element = (element as HTMLElement).parentElement;
  }
};

export const retargetEvents = (shadowRoot: HTMLElement) => {
  const removeEventListeners: (() => void)[] = [];

  retargetedEvents.forEach((reactEventName) => {
    const nativeEventName = getNativeEventName(reactEventName);

    const eventListener = (event: Event) => {
      const path: ((EventTarget | HTMLElement) & Record<string, Component>)[] =
        (event as Event & { path: (HTMLElement & Record<string, Component>)[] })
          .path ||
        (event.composedPath && event.composedPath()) ||
        composedPath(event.target);

      for (let i = 0; i < path.length; i++) {
        const eventTarget = path[i];
        let props: Props | null | undefined = null;
        const reactComponent = findReactProperty(eventTarget, '_reactInternal');
        const eventHandlers = findReactProperty(
          eventTarget,
          '__reactEventHandlers'
        );

        if (!eventHandlers) {
          props = findReactProps(reactComponent);
        } else {
          props = eventHandlers as Props;
        }

        if (reactComponent && props) {
          dispatchEvent(event, reactEventName, props);
        }

        if (reactComponent && props && mimickedReactEvents[reactEventName]) {
          dispatchEvent(event, mimickedReactEvents[reactEventName], props);
        }

        if (event.cancelBubble) {
          break;
        }

        if (eventTarget === shadowRoot) {
          break;
        }
      }
    };

    shadowRoot.addEventListener(nativeEventName, eventListener, false);

    removeEventListeners.push(() => {
      shadowRoot.removeEventListener(nativeEventName, eventListener, false);
    });
  });

  return () => {
    removeEventListeners.forEach((removeEventListener) => {
      removeEventListener();
    });
  };
};
