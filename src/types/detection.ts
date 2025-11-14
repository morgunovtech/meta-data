export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  className: string;
};

export type DetectionSummary = {
  boxes: BoundingBox[];
  caption: string;
  counts: Record<string, number>;
};
