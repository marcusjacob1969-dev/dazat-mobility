/**
 * Provider-neutral boundary for WebAuthn/passkey ceremonies.
 * Phase 0.2 deliberately does not implement cryptography or trust a client assertion by itself.
 * A later adapter must perform standards-compliant challenge issuance and verification.
 */
export interface PasskeyRegistrationContext {
  readonly accountId: string;
  readonly personDisplayName: string;
  readonly userVerification: 'required' | 'preferred';
}

export interface PasskeyRegistrationChallenge {
  readonly ceremonyId: string;
  readonly publicKeyOptions: Readonly<Record<string, unknown>>;
  readonly expiresAt: string;
}

export interface VerifiedPasskeyCredential {
  readonly credentialId: Uint8Array;
  readonly credentialPublicKey: Uint8Array;
  readonly signCount: number;
  readonly transports: readonly string[];
  readonly aaguid?: string;
}

export interface PasskeyCeremonyProvider {
  createRegistrationChallenge(context: PasskeyRegistrationContext): Promise<PasskeyRegistrationChallenge>;
  verifyRegistrationResponse(ceremonyId: string, clientResponse: unknown): Promise<VerifiedPasskeyCredential>;
}

export interface SessionSecretIssuer {
  /** Returns the one-time bearer secret plus the hash/reference persisted server-side. */
  issue(): Promise<{ bearerSecret: string; persistedHash: string }>;
}
