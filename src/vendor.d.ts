declare module 'page-flip' {
  export class PageFlip {
    constructor(element: HTMLElement, settings: Record<string, unknown>);
    loadFromHTML(elements: HTMLElement[]): void;
    destroy(): void;
    on(event: string, callback: (event: { data: unknown }) => void): this;
    off(event: string): void;
    turnToPage(index: number): void;
    flipNext(corner?: string): void;
    flipPrev(corner?: string): void;
    getCurrentPageIndex(): number;
    getState(): string;
    getUI(): { getDistElement(): HTMLElement };
    startUserTouch(point: { x: number; y: number }): void;
    userMove(point: { x: number; y: number }, touch: boolean): void;
    userStop(point: { x: number; y: number }, swipe?: boolean): void;
  }
}
