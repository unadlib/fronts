export type NodeElement = HTMLElement | null;

export type Render = (target: NodeElement) => () => void;

export type DynamicImport = () => Promise<{
  default: Render;
}>;
