export type DetectionCategory = 'object' | 'face';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  label: string;
  category: DetectionCategory;
}

export interface DetectionSummary {
  people: number;
  vehicles: number;
  animals: number;
  faces: number;
  labelCounts: Record<string, number>;
}
