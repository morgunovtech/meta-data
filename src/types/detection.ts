export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  score: number;
}

export interface DetectionSummary {
  caption: string;
  counts: Record<string, number>;
  boxes: BoundingBox[];
}
