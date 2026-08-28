import type { RegistrationContactType } from '@dazat/contracts';

export interface ContactVerificationDelivery {
  readonly verificationId: string;
  readonly contactPointId: string;
  readonly type: RegistrationContactType;
  readonly normalizedValue: string;
  readonly displayHint: string;
  readonly code: string;
  readonly expiresAt: string;
}

export interface ContactVerificationDeliveryPort {
  sendVerificationCode(delivery: ContactVerificationDelivery): Promise<'DELIVERED' | 'UNKNOWN'>;
}

export class DevelopmentConsoleVerificationDelivery implements ContactVerificationDeliveryPort {
  public constructor(private readonly exposeCodeInConsole: boolean) {}

  async sendVerificationCode(delivery: ContactVerificationDelivery): Promise<'DELIVERED'> {
    if (this.exposeCodeInConsole) {
      // Local development only. Production providers must never log verification secrets.
      console.info(`[DAZAT DEV] Verification ${delivery.verificationId}: ${delivery.code} -> ${delivery.displayHint}`);
    }
    return 'DELIVERED';
  }
}
