export type BoundingBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DetectedObject = {
  id: string;
  label: string;
  score: number;
  box: BoundingBox;
};

export type ContentAnalysisState = {
  enabled: boolean;
  loading: boolean;
  supported: boolean;
  detections: DetectedObject[];
  summary?: string;
};
