declare module 'circletype' {
  class CircleType {
    constructor(element: HTMLElement);
    radius(radius: number): CircleType;
    dir(direction: number): CircleType;
    forceWidth(force: boolean): CircleType;
    forceHeight(force: boolean): CircleType;
    destroy(): void;
  }
  export = CircleType;
}
