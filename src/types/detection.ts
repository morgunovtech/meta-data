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
  faces: number;
  vehicles: number;
  animals: number;
  description: string;
}
