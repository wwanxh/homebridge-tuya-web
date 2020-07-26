export class MapRange {
  private constructor(private fromStart, private fromEnd, private toStart, private toEnd) {}

  static from(start, end): { to: (start: number, end: number) => MapRange } {
    return {
      to: (toStart, toEnd) => {
        return new MapRange(start, end, toStart, toEnd);
      },
    };
  }

  public map(input: number): number {
    return (input - this.fromStart) * (this.toEnd - this.toStart) / (this.fromEnd - this.fromStart) + this.toStart;
  }

  public inverseMap(input: number): number {
    return (input - this.toStart) * (this.fromEnd - this.fromStart) / (this.toEnd - this.toStart) + this.fromStart;
  }
}
