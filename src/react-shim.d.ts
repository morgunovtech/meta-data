declare module 'react' {
  export type ReactNode = any;
  export type FC<P = {}> = (props: P & { children?: ReactNode }) => any;
  export type ChangeEvent<T = any> = { target: T } & Event;
  export type FormEvent<T = any> = { target: T; preventDefault(): void } & Event;
  export type Dispatch<A> = (value: A) => void;
  export type SetStateAction<S> = S | ((prev: S) => S);
  export function useState<S>(initial: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(effect: (...args: any[]) => any, deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps?: any[]): T;
  export function useCallback<T extends (...args: any[]) => any>(fn: T, deps?: any[]): T;
  export function useRef<T>(initial: T | null): { current: T | null };
  export function createContext<T>(defaultValue: T): any;
  export function useContext<T>(ctx: any): T;
  export const StrictMode: any;
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  const React: {
    StrictMode: any;
  };
  export default React;
}

declare namespace JSX {
  interface IntrinsicElements {
    [elem: string]: any;
  }
}

declare module 'react-dom/client' {
  export function createRoot(container: Element | DocumentFragment): { render(node: any): void };
}
