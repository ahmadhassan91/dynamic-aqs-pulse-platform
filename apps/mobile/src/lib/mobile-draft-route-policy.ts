import type { CreateTrainingSessionRequest } from '@pulse/contracts/training';

export function refreshRouteVisitCreateRequestForRetry(
  request: CreateTrainingSessionRequest,
  now: Date = new Date(),
): CreateTrainingSessionRequest {
  const scheduledAt = new Date(request.scheduledAt).getTime();
  const minimumRetryTime = now.getTime() + 30_000;
  if (Number.isFinite(scheduledAt) && scheduledAt > now.getTime()) {
    return request;
  }
  return {
    ...request,
    scheduledAt: new Date(minimumRetryTime).toISOString(),
  };
}
