export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateVersion: number;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}
