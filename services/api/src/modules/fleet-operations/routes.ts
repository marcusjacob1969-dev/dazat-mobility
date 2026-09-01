import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DatabasePool } from '../../db.js';
import { bearerTokenFromRequest as bearer } from '../../security/bearer-token.js';
import { authenticateBearerSession } from '../identity/session-service.js';
import {
  FleetOperationsForbiddenError,
  FleetOperationsNotFoundError,
  getCurrentFleetMarketplaceOffer,
  listCurrentDriverFleetAgreements,
  listCurrentFleetMarketplaceOffers,
  validateDriverVehicleAssignment
} from './fleet-operations-service.js';

async function requireDriver(request: FastifyRequest, reply: FastifyReply, pool: DatabasePool) {
  const token = bearer(request);
  if (!token) { await reply.code(401).send({ code: 'AUTHENTICATION_REQUIRED' }); return null; }
  const principal = await authenticateBearerSession(pool, token, 'VIEW_PROFILE');
  if (!principal) { await reply.code(401).send({ code: 'SESSION_INVALID' }); return null; }
  if (!principal.driverProfileId) { await reply.code(403).send({ code: 'DRIVER_PROFILE_REQUIRED' }); return null; }
  return principal;
}

function sendFleetError(reply: FastifyReply, error: unknown) {
  if (error instanceof FleetOperationsNotFoundError) return reply.code(404).send({ code: 'FLEET_RESOURCE_NOT_FOUND' });
  if (error instanceof FleetOperationsForbiddenError) return reply.code(403).send({ code: 'FLEET_OPERATIONS_FORBIDDEN' });
  return null;
}

export function registerFleetOperationsRoutes(app: FastifyInstance, pool: DatabasePool): void {
  app.get('/v1/fleet/marketplace', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool); if (!principal) return;
    const query = z.object({ regionCode: z.string().trim().min(2).max(32) }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_FLEET_MARKETPLACE_QUERY' });
    try {
      return reply.code(200).send({ offers: await listCurrentFleetMarketplaceOffers(pool, principal, query.data.regionCode.toUpperCase()) });
    } catch (error) {
      const known = sendFleetError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Fleet Marketplace read failed');
      return reply.code(500).send({ code: 'FLEET_MARKETPLACE_UNAVAILABLE' });
    }
  });

  app.get('/v1/fleet/marketplace/:offerId', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool); if (!principal) return;
    const params = z.object({ offerId: z.string().uuid() }).strict().safeParse(request.params);
    if (!params.success) return reply.code(400).send({ code: 'INVALID_FLEET_OFFER_ID' });
    try {
      return reply.code(200).send(await getCurrentFleetMarketplaceOffer(pool, principal, params.data.offerId));
    } catch (error) {
      const known = sendFleetError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Fleet Marketplace offer read failed');
      return reply.code(500).send({ code: 'FLEET_MARKETPLACE_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/fleet-agreements', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool); if (!principal) return;
    try {
      return reply.code(200).send({ agreements: await listCurrentDriverFleetAgreements(pool, principal) });
    } catch (error) {
      const known = sendFleetError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Fleet agreement read failed');
      return reply.code(500).send({ code: 'FLEET_AGREEMENTS_UNAVAILABLE' });
    }
  });

  app.get('/v1/driver/vehicle-assignment-validation', async (request, reply) => {
    const principal = await requireDriver(request, reply, pool); if (!principal) return;
    const query = z.object({
      vehicleId: z.string().uuid(),
      regionCode: z.string().trim().min(2).max(32),
      replacementForAssignmentId: z.string().uuid().optional()
    }).strict().safeParse(request.query);
    if (!query.success) return reply.code(400).send({ code: 'INVALID_VEHICLE_ASSIGNMENT_QUERY' });
    try {
      return reply.code(200).send(await validateDriverVehicleAssignment(
        pool, principal, query.data.vehicleId, query.data.regionCode.toUpperCase(), query.data.replacementForAssignmentId ?? null
      ));
    } catch (error) {
      const known = sendFleetError(reply, error); if (known) return known;
      request.log.error({ err: error }, 'Vehicle assignment validation failed');
      return reply.code(500).send({ code: 'VEHICLE_ASSIGNMENT_VALIDATION_UNAVAILABLE' });
    }
  });
}
