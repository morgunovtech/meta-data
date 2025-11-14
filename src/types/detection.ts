export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
  label: string;
}

export interface DetectionSummary {
  people: number;
  vehicles: number;
  animals: number;
  description: string;
  top: Array<{ label: string; count: number; confidence: number }>;
}
