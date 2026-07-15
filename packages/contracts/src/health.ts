export const HEALTH_STATUS = "ok";

export interface HealthResponse {
  status: typeof HEALTH_STATUS;
}
