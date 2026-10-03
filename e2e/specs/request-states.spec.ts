import {
  test,
  expect,
  createAuthenticatedClient,
  seedDeliveryRequestInState,
  getRequestInspectionData,
  elevateAdminToAal2,
  seedAdminUser,
  getPlatformSettingNumber,
  setMerchantSubscriptionStatus,
} from '../fixtures';

/**
 * T-304: E2E y matriz de estados (§5.1 de master-plan.md)
 *
 * Flujos y transiciones cubiertos mediante RPCs reales, autenticación por actor y oráculos en PostgreSQL:
 * 1. draft -> published (merchant dueño, cálculo de expires_at y timestamps persistidos)
 * 2. published -> matched (merchant dueño acepta oferta atómicamente, una accepted y resto rejected)
 * 3. published -> cancelled (merchant dueño cancela sin penalidad, ofertas pending pasan a expired)
 * 4. published -> expired (expiración perezosa al operar y barrido por runSweep)
 * 5. matched -> in_transit (courier asignado marca retirado con persistencia)
 * 6a. matched -> published (republicar: comercio reporta 'no llegó' / no_show con motivo)
 * 6b. matched -> published (republicar: courier cancela match con motivo obligatorio)
 * 7. matched -> cancelled (comercio dueño cancela con motivo obligatorio)
 * 8. in_transit -> delivered (courier asignado confirma entrega y ventana de incidente de 24h)
 * 9. in_transit -> cancelled (admin cancela por incidente con motivo obligatorio y AAL2 — CC-015 / D02 = 2-A)
 * 10. DoD Invariante crítica: falla si se permite cancelar después de entregado (delivered jamás se cancela).
 */

async function expectRpcFailure(
  rpcPromise: PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>,
  expectedError: string
): Promise<void> {
  const { data, error } = await rpcPromise;
  expect(
    error,
    `Se esperaba fallo con código '${expectedError}', pero la RPC retornó éxito con datos: ${JSON.stringify(data)}`
  ).not.toBeNull();
  expect(error?.message).toContain(expectedError);
}

test.describe('T-304 — Matriz de estados y transiciones (§5.1)', () => {
  // ---------------------------------------------------------------------------
  // Fila 1: draft -> published
  // ---------------------------------------------------------------------------
  test('Fila 1 (§5.1): draft -> published (merchant dueño, cálculo de expires_at y timestamps persistidos)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier en stagingContext');
    }

    // Precondición: solicitud en draft con contactos
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'draft',
      merchantId: merchant.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;

    const merchantClient = await createAuthenticatedClient(merchant);
    const courierClient = await createAuthenticatedClient(courier);

    // 1a. Caso negativo: courier intenta publicar una solicitud
    await expectRpcFailure(
      courierClient.rpc('publish_request', { p_request_id: requestId }),
      'UNAUTHORIZED_ACTOR'
    );

    // 1b. Caso negativo (H09): comercio con suscripción inactiva ('expired') no puede publicar (§5.1)
    await setMerchantSubscriptionStatus(merchant.id, 'expired');
    try {
      await expectRpcFailure(
        merchantClient.rpc('publish_request', { p_request_id: requestId }),
        'SUBSCRIPTION_INACTIVE'
      );
    } finally {
      // Restaurar suscripción activa (pilot) para que continúe la prueba
      await setMerchantSubscriptionStatus(merchant.id, 'pilot');
    }

    // 2. Caso positivo: comercio dueño publica la solicitud
    const { data: publishData, error: publishError } = await merchantClient.rpc('publish_request', {
      p_request_id: requestId,
    });
    expect(publishError).toBeNull();
    expect(publishData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('published');
    expect(inspection.publishedAt).not.toBeNull();
    expect(inspection.expiresAt).not.toBeNull();

    // expires_at debe ser exactamente now + request_ttl_minutes según configuración real en platform_settings (H09)
    const ttlMinutes = await getPlatformSettingNumber('request_ttl_minutes', 45);
    const pubTime = new Date(inspection.publishedAt ?? '').getTime();
    const expTime = new Date(inspection.expiresAt ?? '').getTime();
    expect(expTime).toBeGreaterThan(pubTime);
    const diffMinutes = Math.round((expTime - pubTime) / (60 * 1000));
    expect(diffMinutes).toBe(ttlMinutes);
  });

  // ---------------------------------------------------------------------------
  // Fila 2: published -> matched
  // ---------------------------------------------------------------------------
  test('Fila 2 (§5.1): published -> matched (merchant dueño acepta oferta atómicamente, una accepted y resto rejected)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier0 = stagingContext.courierUsers?.[0];
    const courier1 = stagingContext.courierUsers?.[1];
    if (!merchant || !courier0 || !courier1) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y 2 couriers en stagingContext');
    }

    // Precondición: solicitud published con 2 ofertas pending de repartidores aprobados
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      withContacts: true,
      withPendingOffersCount: 2,
    });
    const requestId = seedResult.requestId;
    const [offer0Id, offer1Id] = seedResult.pendingOfferIds;
    if (!offer0Id || !offer1Id) {
      throw new Error('[E2E Precondition Error] No se crearon las 2 ofertas pendientes');
    }

    const merchantClient = await createAuthenticatedClient(merchant);
    const courierClient = await createAuthenticatedClient(courier0);

    // 1. Caso negativo: courier no puede aceptar oferta
    await expectRpcFailure(
      courierClient.rpc('accept_offer', { p_offer_id: offer0Id }),
      'UNAUTHORIZED_ACTOR'
    );

    // 2. Caso positivo: comercio dueño acepta offer0
    const { data: acceptData, error: acceptError } = await merchantClient.rpc('accept_offer', {
      p_offer_id: offer0Id,
    });
    expect(acceptError).toBeNull();
    expect(acceptData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('matched');
    expect(inspection.acceptedOfferId).toBe(offer0Id);
    expect(inspection.matchedAt).not.toBeNull();

    // Efecto colateral atómico: oferta 0 accepted, oferta 1 rejected
    const acceptedOffer = inspection.offers.find((o) => o.id === offer0Id);
    const rejectedOffer = inspection.offers.find((o) => o.id === offer1Id);
    expect(acceptedOffer?.status).toBe('accepted');
    expect(rejectedOffer?.status).toBe('rejected');

    // 4. Caso de concurrencia: intentar aceptar la oferta 1 cuando ya está matched falla
    await expectRpcFailure(
      merchantClient.rpc('accept_offer', { p_offer_id: offer1Id }),
      'ALREADY_MATCHED'
    );
  });

  // ---------------------------------------------------------------------------
  // Fila 3: published -> cancelled
  // ---------------------------------------------------------------------------
  test('Fila 3 (§5.1): published -> cancelled (merchant dueño cancela sin penalidad, ofertas pending pasan a expired)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier en stagingContext');
    }

    // Precondición: solicitud published con oferta pending
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      withContacts: true,
      withPendingOffersCount: 1,
    });
    const requestId = seedResult.requestId;
    const pendingOfferId = seedResult.pendingOfferIds[0];

    const merchantClient = await createAuthenticatedClient(merchant);
    const courierClient = await createAuthenticatedClient(courier);

    // 1. Caso negativo: courier no puede cancelar solicitud
    await expectRpcFailure(
      courierClient.rpc('cancel_request', {
        p_request_id: requestId,
        p_reason: 'Intento courier',
      }),
      'UNAUTHORIZED_ACTOR'
    );

    // 2. Caso positivo: comercio dueño cancela antes de aceptar oferta
    const { data: cancelData, error: cancelError } = await merchantClient.rpc('cancel_request', {
      p_request_id: requestId,
      p_reason: 'El cliente retirará en el local comercial',
    });
    expect(cancelError).toBeNull();
    expect(cancelData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('cancelled');
    expect(inspection.cancelledAt).not.toBeNull();
    expect(inspection.cancelReason).toBe('El cliente retirará en el local comercial');

    // Las ofertas pending asociadas deben pasar a expired
    const offer = inspection.offers.find((o) => o.id === pendingOfferId);
    expect(offer?.status).toBe('expired');
  });

  // ---------------------------------------------------------------------------
  // Fila 4: published -> expired
  // ---------------------------------------------------------------------------
  test('Fila 4 (§5.1): published -> expired (expiración perezosa al operar y barrido de expiración)', async ({
    stagingContext,
    request,
  }) => {
    const merchant = stagingContext.merchantUser;
    if (!merchant) {
      throw new Error('[E2E Precondition Error] Se requiere merchant en stagingContext');
    }

    // Precondición: solicitud published con expires_at en el pasado (5 minutos atrás) y oferta pendiente
    const pastExpiresAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'published',
      merchantId: merchant.id,
      expiresAt: pastExpiresAt,
      withContacts: true,
      withPendingOffersCount: 1,
    });
    const requestId = seedResult.requestId;
    const pendingOfferId = seedResult.pendingOfferIds[0];
    if (!pendingOfferId) {
      throw new Error('[E2E Precondition Error] No se creó oferta pendiente');
    }

    const merchantClient = await createAuthenticatedClient(merchant);

    // 1. Expiración perezosa en RPC real: intentar aceptar oferta sobre solicitud vencida falla con REQUEST_EXPIRED
    await expectRpcFailure(
      merchantClient.rpc('accept_offer', { p_offer_id: pendingOfferId }),
      'REQUEST_EXPIRED'
    );

    // 2. Precedencia contractual real (H08): intentar cancelar sobre solicitud vencida falla con REQUEST_EXPIRED
    await expectRpcFailure(
      merchantClient.rpc('cancel_request', {
        p_request_id: requestId,
        p_reason: 'Intento de cancelación sobre solicitud expirada',
      }),
      'REQUEST_EXPIRED'
    );

    // 3. Ejecución del endpoint de cron /api/cron/sweep si CRON_SECRET está configurado
    if (process.env.CRON_SECRET) {
      const sweepResponse = await request.post('/api/cron/sweep', {
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });
      expect(sweepResponse.ok()).toBe(true);

      // Oráculo server-side en PostgreSQL: estado físico actualizado a expired
      const inspection = await getRequestInspectionData(stagingContext, requestId);
      expect(inspection.requestStatus).toBe('expired');
      const offer = inspection.offers.find((o) => o.id === pendingOfferId);
      expect(offer?.status).toBe('expired');
    }
  });

  // ---------------------------------------------------------------------------
  // Fila 5: matched -> in_transit
  // ---------------------------------------------------------------------------
  test('Fila 5 (§5.1): matched -> in_transit (courier asignado marca retirado con persistencia)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier0 = stagingContext.courierUsers?.[0];
    const courier1 = stagingContext.courierUsers?.[1];
    if (!merchant || !courier0 || !courier1) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y 2 couriers');
    }

    // Precondición: solicitud matched con courier0 asignado
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      merchantId: merchant.id,
      assignedCourierId: courier0.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;

    const courier0Client = await createAuthenticatedClient(courier0);
    const courier1Client = await createAuthenticatedClient(courier1);
    const merchantClient = await createAuthenticatedClient(merchant);

    // 1. Casos negativos: actor no autorizado (courier no asignado y merchant)
    await expectRpcFailure(
      courier1Client.rpc('mark_picked_up', { p_request_id: requestId }),
      'UNAUTHORIZED_ACTOR'
    );
    await expectRpcFailure(
      merchantClient.rpc('mark_picked_up', { p_request_id: requestId }),
      'UNAUTHORIZED_ACTOR'
    );

    // 2. Caso positivo: repartidor asignado marca pedido retirado
    const { data: pickupData, error: pickupError } = await courier0Client.rpc('mark_picked_up', {
      p_request_id: requestId,
    });
    expect(pickupError).toBeNull();
    expect(pickupData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('in_transit');
    expect(inspection.pickedUpAt).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Fila 6a: matched -> published por no_show
  // ---------------------------------------------------------------------------
  test('Fila 6a (§5.1): matched -> published (republicar: comercio reporta no llegó con motivo)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier');
    }

    // Precondición: solicitud matched con courier asignado
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;
    const acceptedOfferId = seedResult.acceptedOfferId;
    if (!acceptedOfferId) {
      throw new Error('[E2E Precondition Error] Se requiere acceptedOfferId');
    }

    const merchantClient = await createAuthenticatedClient(merchant);
    const courierClient = await createAuthenticatedClient(courier);

    // 1. Caso negativo: courier no puede reportar no_show
    await expectRpcFailure(
      courierClient.rpc('report_no_show', {
        p_request_id: requestId,
        p_republish: true,
      }),
      'UNAUTHORIZED_ACTOR'
    );

    // 2. Caso positivo: comercio dueño reporta que el repartidor no llegó y republica
    const { data: noShowData, error: noShowError } = await merchantClient.rpc('report_no_show', {
      p_request_id: requestId,
      p_republish: true,
    });
    expect(noShowError).toBeNull();
    expect(noShowData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('published');
    expect(inspection.acceptedOfferId).toBeNull();
    expect(inspection.matchedAt).toBeNull();
    expect(inspection.expiresAt).not.toBeNull();

    // La oferta previamente aceptada debe quedar en cancelled
    const offer = inspection.offers.find((o) => o.id === acceptedOfferId);
    expect(offer?.status).toBe('cancelled');

    // 4. §5.1: Se registra el motivo ('no_show') y queda disponible para conteo de métricas por admin
    expect(inspection.cancellationReasons?.length).toBeGreaterThanOrEqual(1);
    const noShowReason = inspection.cancellationReasons?.find(
      (r) => r.action === 'report_no_show'
    );
    expect(noShowReason).toBeDefined();
    expect(noShowReason?.reason).toBe('no_show');
    expect(noShowReason?.actorId).toBe(merchant.id);
  });

  // ---------------------------------------------------------------------------
  // Fila 6b: matched -> published por courier_cancel_match
  // ---------------------------------------------------------------------------
  test('Fila 6b (§5.1): matched -> published (republicar: courier cancela match con motivo obligatorio)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier0 = stagingContext.courierUsers?.[0];
    const courier1 = stagingContext.courierUsers?.[1];
    if (!merchant || !courier0 || !courier1) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y 2 couriers');
    }

    // Precondición: solicitud matched con courier0 asignado
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      merchantId: merchant.id,
      assignedCourierId: courier0.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;
    const acceptedOfferId = seedResult.acceptedOfferId;
    if (!acceptedOfferId) {
      throw new Error('[E2E Precondition Error] Se requiere acceptedOfferId');
    }

    const courier0Client = await createAuthenticatedClient(courier0);
    const courier1Client = await createAuthenticatedClient(courier1);

    // 1. Casos negativos: motivo vacío y courier no asignado
    await expectRpcFailure(
      courier0Client.rpc('courier_cancel_match', {
        p_request_id: requestId,
        p_reason: '   ',
      }),
      'REASON_REQUIRED'
    );
    await expectRpcFailure(
      courier1Client.rpc('courier_cancel_match', {
        p_request_id: requestId,
        p_reason: 'Desperfecto en moto',
      }),
      'UNAUTHORIZED_ACTOR'
    );

    // 2. Caso positivo: repartidor asignado cancela match con motivo válido
    const { data: cancelMatchData, error: cancelMatchError } = await courier0Client.rpc(
      'courier_cancel_match',
      {
        p_request_id: requestId,
        p_reason: 'Se pinchó la rueda delantera en camino al local',
      }
    );
    expect(cancelMatchError).toBeNull();
    expect(cancelMatchData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('published');
    expect(inspection.acceptedOfferId).toBeNull();
    expect(inspection.matchedAt).toBeNull();
    expect(inspection.expiresAt).not.toBeNull();

    const offer = inspection.offers.find((o) => o.id === acceptedOfferId);
    expect(offer?.status).toBe('cancelled');

    // 4. §5.1: Se registra el motivo del repartidor y queda disponible para conteo de métricas por admin
    expect(inspection.cancellationReasons?.length).toBeGreaterThanOrEqual(1);
    const courierReason = inspection.cancellationReasons?.find(
      (r) => r.action === 'courier_cancel_match'
    );
    expect(courierReason).toBeDefined();
    expect(courierReason?.reason).toBe('Se pinchó la rueda delantera en camino al local');
    expect(courierReason?.actorId).toBe(courier0.id);
  });

  // ---------------------------------------------------------------------------
  // Fila 7: matched -> cancelled
  // ---------------------------------------------------------------------------
  test('Fila 7 (§5.1): matched -> cancelled (comercio dueño cancela con motivo obligatorio)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier');
    }

    // Precondición: solicitud matched con courier asignado
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'matched',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;
    const acceptedOfferId = seedResult.acceptedOfferId;
    if (!acceptedOfferId) {
      throw new Error('[E2E Precondition Error] Se requiere acceptedOfferId');
    }

    const merchantClient = await createAuthenticatedClient(merchant);

    // 1. Caso negativo: comercio cancela sin motivo
    await expectRpcFailure(
      merchantClient.rpc('cancel_request', {
        p_request_id: requestId,
        p_reason: '   ',
      }),
      'REASON_REQUIRED'
    );

    // 2. Caso positivo: comercio cancela con motivo obligatorio
    const { data: cancelData, error: cancelError } = await merchantClient.rpc('cancel_request', {
      p_request_id: requestId,
      p_reason: 'El cliente canceló la compra por demora de cocina',
    });
    expect(cancelError).toBeNull();
    expect(cancelData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('cancelled');
    expect(inspection.cancelledAt).not.toBeNull();
    expect(inspection.cancelReason).toBe('El cliente canceló la compra por demora de cocina');

    const offer = inspection.offers.find((o) => o.id === acceptedOfferId);
    expect(offer?.status).toBe('cancelled');

    // 4. §5.1: Motivo persistido y gap contractual de notificación documentado
    // Gap contractual (§5.1 vs backend): La matriz §5.1 define que al pasar de matched a cancelled
    // 'Se notifica al repartidor'. La RPC cancel_request / request_cycle actualiza delivery_requests
    // y offers a 'cancelled', registra cancel_reason y crea fila en request_cancellation_reasons,
    // pero no emite eventos ni despacha push en la capa de datos (el push es best-effort y se maneja en Edge).
    // Verificamos toda la persistencia real sin fingir señales inexistentes en base de datos.
    expect(inspection.cancellationReasons?.length).toBeGreaterThanOrEqual(1);
    const cancelReasonRow = inspection.cancellationReasons?.find(
      (r) => r.action === 'cancel_request'
    );
    expect(cancelReasonRow).toBeDefined();
    expect(cancelReasonRow?.reason).toBe('El cliente canceló la compra por demora de cocina');
    expect(cancelReasonRow?.actorId).toBe(merchant.id);
  });

  // ---------------------------------------------------------------------------
  // Fila 8: in_transit -> delivered
  // ---------------------------------------------------------------------------
  test('Fila 8 (§5.1): in_transit -> delivered (courier asignado confirma entrega y ventana de incidente)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier0 = stagingContext.courierUsers?.[0];
    const courier1 = stagingContext.courierUsers?.[1];
    if (!merchant || !courier0 || !courier1) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y 2 couriers');
    }

    // Precondición: solicitud in_transit con courier0 asignado
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'in_transit',
      merchantId: merchant.id,
      assignedCourierId: courier0.id,
      withContacts: true,
    });
    const requestId = seedResult.requestId;

    const courier0Client = await createAuthenticatedClient(courier0);
    const courier1Client = await createAuthenticatedClient(courier1);
    const merchantClient = await createAuthenticatedClient(merchant);

    // 1. Casos negativos: actor no autorizado (courier no asignado y merchant)
    await expectRpcFailure(
      courier1Client.rpc('mark_delivered', { p_request_id: requestId }),
      'UNAUTHORIZED_ACTOR'
    );
    await expectRpcFailure(
      merchantClient.rpc('mark_delivered', { p_request_id: requestId }),
      'UNAUTHORIZED_ACTOR'
    );

    // 2. Caso positivo: repartidor asignado confirma entrega
    const { data: deliveredData, error: deliveredError } = await courier0Client.rpc(
      'mark_delivered',
      {
        p_request_id: requestId,
      }
    );
    expect(deliveredError).toBeNull();
    expect(deliveredData).toBeDefined();

    // 3. Oráculo server-side en PostgreSQL
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('delivered');
    expect(inspection.deliveredAt).not.toBeNull();

    // 4. Ventana de 24 horas para reporte de incidentes post-entrega (§5.1)
    // El comercio involucrado reporta un incidente dentro de las 24 horas
    const { data: incidentData, error: incidentError } = await merchantClient.rpc(
      'report_incident',
      {
        p_request_id: requestId,
        p_kind: 'damaged_goods',
        p_description: 'El paquete llegó con el embalaje roto y producto dañado',
      }
    );
    expect(incidentError).toBeNull();
    expect(incidentData).toBeDefined();

    // Verificar que el incidente quedó registrado en PostgreSQL
    const postIncidentInspection = await getRequestInspectionData(stagingContext, requestId);
    expect(postIncidentInspection.incidents?.length).toBeGreaterThanOrEqual(1);

    // 5. Expiración de ventana de incidente (> 24 h) (§5.1 & H09):
    // Se prepara una solicitud entregada hace más de 24 horas (25 horas antes)
    const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const expiredSeed = await seedDeliveryRequestInState(stagingContext, {
      status: 'delivered',
      merchantId: merchant.id,
      assignedCourierId: courier0.id,
      deliveredAt: twentyFiveHoursAgo,
      withContacts: true,
    });
    const expiredRequestId = expiredSeed.requestId;

    // Intentar reportar un incidente fuera de la ventana de 24h debe fallar con INCIDENT_WINDOW_EXPIRED
    await expectRpcFailure(
      merchantClient.rpc('report_incident', {
        p_request_id: expiredRequestId,
        p_kind: 'damaged_goods',
        p_description: 'Reporte fuera de plazo de 24 horas',
      }),
      'INCIDENT_WINDOW_EXPIRED'
    );
  });

  // ---------------------------------------------------------------------------
  // Fila 9: in_transit -> cancelled por admin (CC-015 / Decisión 2-A)
  // ---------------------------------------------------------------------------
  test('Fila 9 (§5.1 & CC-015): in_transit -> cancelled por admin (requiere incidente registrado y AAL2)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier');
    }

    // Crear admin real para la prueba
    const adminUser = await seedAdminUser(stagingContext);

    // Preparar dos solicitudes en in_transit: Req A (sin incidentes) y Req B (con incidente)
    const seedReqA = await seedDeliveryRequestInState(stagingContext, {
      status: 'in_transit',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
    });
    const reqAId = seedReqA.requestId;

    const seedReqB = await seedDeliveryRequestInState(stagingContext, {
      status: 'in_transit',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
    });
    const reqBId = seedReqB.requestId;

    const adminClient = await createAuthenticatedClient(adminUser);
    const merchantClient = await createAuthenticatedClient(merchant);

    // 1. Caso negativo: admin con AAL1 es rechazado con AAL2_REQUIRED
    await expectRpcFailure(
      adminClient.rpc('cancel_request', {
        p_request_id: reqAId,
        p_reason: 'Intento con AAL1',
      }),
      'AAL2_REQUIRED'
    );

    // Elevar sesión de admin a AAL2 vía TOTP real (RFC 6238)
    await elevateAdminToAal2(adminClient, adminUser);

    // 2a. Precedencia contractual (H09): admin con AAL2 pero motivo vacío falla con REASON_REQUIRED
    await expectRpcFailure(
      adminClient.rpc('cancel_request', {
        p_request_id: reqAId,
        p_reason: '   ',
      }),
      'REASON_REQUIRED'
    );

    // 2b. Caso negativo CC-015: admin AAL2 con motivo pero 0 incidentes registrados en Req A
    await expectRpcFailure(
      adminClient.rpc('cancel_request', {
        p_request_id: reqAId,
        p_reason: 'Intento admin sin incidente',
      }),
      'INVALID_STATE_TRANSITION'
    );

    // Verificar en PostgreSQL que Req A sigue en in_transit
    const inspReqAInitial = await getRequestInspectionData(stagingContext, reqAId);
    expect(inspReqAInitial.requestStatus).toBe('in_transit');

    // 3. Control cruzado: registrar incidente en Req B NO debe habilitar cancelación de Req A
    const { error: incBErr } = await merchantClient.rpc('report_incident', {
      p_request_id: reqBId,
      p_kind: 'safety',
      p_description: 'Incidente de tránsito en viaje B',
    });
    expect(incBErr).toBeNull();

    // Req A sigue teniendo 0 incidentes -> cancelación debe seguir rechazada
    await expectRpcFailure(
      adminClient.rpc('cancel_request', {
        p_request_id: reqAId,
        p_reason: 'Intento admin en Req A habiendo incidente solo en Req B',
      }),
      'INVALID_STATE_TRANSITION'
    );

    // 4. Caso positivo CC-015: registrar incidente sobre Req A y cancelar exitosamente
    const { error: incAErr } = await merchantClient.rpc('report_incident', {
      p_request_id: reqAId,
      p_kind: 'damaged_goods',
      p_description: 'Paquete dañado reportado formalmente para cancelación',
    });
    expect(incAErr).toBeNull();

    const { data: cancelData, error: cancelError } = await adminClient.rpc('cancel_request', {
      p_request_id: reqAId,
      p_reason: 'Incidente de extravío verificado por mediación de soporte',
    });
    expect(cancelError).toBeNull();
    expect(cancelData).toBeDefined();

    // 5. Oráculo server-side en PostgreSQL: Req A pasa a cancelled
    const inspReqAFinal = await getRequestInspectionData(stagingContext, reqAId);
    expect(inspReqAFinal.requestStatus).toBe('cancelled');
    expect(inspReqAFinal.cancelledAt).not.toBeNull();
    expect(inspReqAFinal.cancelReason).toBe(
      'Incidente de extravío verificado por mediación de soporte'
    );

    expect(inspReqAFinal.cancellationReasons?.length).toBeGreaterThanOrEqual(1);
    const adminReason = inspReqAFinal.cancellationReasons?.find(
      (r) => r.action === 'cancel_request'
    );
    expect(adminReason).toBeDefined();
    expect(adminReason?.reason).toBe(
      'Incidente de extravío verificado por mediación de soporte'
    );
    expect(adminReason?.actorId).toBe(adminUser.id);
  });

  // ---------------------------------------------------------------------------
  // Invariante crítica del DoD: Falla si se permite cancelar después de entregado
  // ---------------------------------------------------------------------------
  test('DoD Invariante crítica: Falla si se permite cancelar después de entregado (§5.1)', async ({
    stagingContext,
  }) => {
    const merchant = stagingContext.merchantUser;
    const courier = stagingContext.courierUsers?.[0];
    if (!merchant || !courier) {
      throw new Error('[E2E Precondition Error] Se requieren merchant y courier');
    }

    // Precondición: solicitud entregada (delivered)
    const seedResult = await seedDeliveryRequestInState(stagingContext, {
      status: 'delivered',
      merchantId: merchant.id,
      assignedCourierId: courier.id,
      withContacts: true,
      withIncident: {
        kind: 'other',
        description: 'Incidente posterior a la entrega',
        reporterId: merchant.id,
      },
    });
    const requestId = seedResult.requestId;

    const merchantClient = await createAuthenticatedClient(merchant);
    const courierClient = await createAuthenticatedClient(courier);

    const adminUser = await seedAdminUser(stagingContext);
    const adminClient = await createAuthenticatedClient(adminUser);
    await elevateAdminToAal2(adminClient, adminUser);

    // 1. Intento de cancelación por comercio sobre delivered -> rechazado
    await expectRpcFailure(
      merchantClient.rpc('cancel_request', {
        p_request_id: requestId,
        p_reason: 'Comercio intenta cancelar pedido entregado',
      }),
      'INVALID_STATE_TRANSITION'
    );

    // 2. Intento de cancelación por courier sobre delivered -> rechazado
    await expectRpcFailure(
      courierClient.rpc('cancel_request', {
        p_request_id: requestId,
        p_reason: 'Courier intenta cancelar pedido entregado',
      }),
      'UNAUTHORIZED_ACTOR'
    );

    // 3. Intento de cancelación por admin AAL2 sobre delivered (incluso con incidente) -> rechazado
    await expectRpcFailure(
      adminClient.rpc('cancel_request', {
        p_request_id: requestId,
        p_reason: 'Admin intenta cancelar pedido entregado con incidente',
      }),
      'INVALID_STATE_TRANSITION'
    );

    // 4. Oráculo server-side en PostgreSQL: el estado final permanece estrictamente en 'delivered'
    const inspection = await getRequestInspectionData(stagingContext, requestId);
    expect(inspection.requestStatus).toBe('delivered');
    expect(inspection.cancelledAt).toBeNull();
    expect(inspection.cancelReason).toBeNull();
  });
});
