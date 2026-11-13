import 'server-only';

import {
  RPC_CONTRACTS,
  err,
  ok,
  type ActionResult,
  type RpcErrorCode,
  type RpcInput,
  type RpcOutput,
} from '@/domain';
import type { SupabaseRpcCaller, SupabaseRpcErrorLike } from './admin';

export type ReplaceCourierDocumentResult = RpcOutput<'replace_courier_document'>;

function isAllowedReplaceError(
  candidate: string,
): candidate is RpcErrorCode<'replace_courier_document'> {
  const allowedCodes: readonly string[] =
    RPC_CONTRACTS.replace_courier_document.errorCodes;
  return allowedCodes.includes(candidate as RpcErrorCode<'replace_courier_document'>);
}

/**
 * Maps PostgREST / Postgres errors returned by `replace_courier_document` into strict `RpcErrorCode<'replace_courier_document'> | 'INTERNAL_ERROR'`.
 */
export function mapReplaceCourierDocumentRpcError(
  error: SupabaseRpcErrorLike,
): RpcErrorCode<'replace_courier_document'> | 'INTERNAL_ERROR' {
  const trimmedMessage = error.message.trim();

  if (isAllowedReplaceError(trimmedMessage)) {
    return trimmedMessage;
  }

  for (const allowedCode of RPC_CONTRACTS.replace_courier_document.errorCodes) {
    if (trimmedMessage.includes(allowedCode)) {
      return allowedCode as RpcErrorCode<'replace_courier_document'>;
    }
  }

  if (
    (error.code === '42501' ||
      error.code === '28000' ||
      trimmedMessage.includes('CONSENT_REQUIRED')) &&
    isAllowedReplaceError('UNAUTHORIZED_ACTOR')
  ) {
    return 'UNAUTHORIZED_ACTOR';
  }

  return 'INTERNAL_ERROR';
}

/**
 * Typed server wrapper for `public.replace_courier_document(p_payload jsonb)`.
 * CC-025: Reemplazo transaccional de un documento rechazado del repartidor.
 */
export async function replaceCourierDocumentRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    ReplaceCourierDocumentResult,
    RpcErrorCode<'replace_courier_document'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput =
    RPC_CONTRACTS.replace_courier_document.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    return err('VALIDATION_ERROR');
  }

  try {
    const { data, error } = await client.rpc('replace_courier_document', {
      p_payload: {
        kind: parsedInput.data.kind,
        storagePath: parsedInput.data.storagePath,
        ...(parsedInput.data.idempotencyKey
          ? { idempotencyKey: parsedInput.data.idempotencyKey }
          : {}),
        // CC-042: vehículo de la licencia o el seguro; sin él, la RPC usa el activo.
        ...(parsedInput.data.vehicleId ? { vehicleId: parsedInput.data.vehicleId } : {}),
      },
    });

    if (error) {
      return err(mapReplaceCourierDocumentRpcError(error));
    }

    const parsedOutput =
      RPC_CONTRACTS.replace_courier_document.outputSchema.safeParse(data);
    if (!parsedOutput.success) {
      return err('INTERNAL_ERROR');
    }

    return ok(parsedOutput.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}

export type AddCourierOptionalDocumentResult = RpcOutput<'add_courier_optional_document'>;

function isAllowedAddOptionalDocumentError(
  candidate: string,
): candidate is RpcErrorCode<'add_courier_optional_document'> {
  const allowedCodes: readonly string[] =
    RPC_CONTRACTS.add_courier_optional_document.errorCodes;
  return allowedCodes.includes(candidate as RpcErrorCode<'add_courier_optional_document'>);
}

/** Maps PostgREST / Postgres errors returned by `add_courier_optional_document`. */
export function mapAddCourierOptionalDocumentRpcError(
  error: SupabaseRpcErrorLike,
): RpcErrorCode<'add_courier_optional_document'> | 'INTERNAL_ERROR' {
  const trimmedMessage = error.message.trim();

  if (isAllowedAddOptionalDocumentError(trimmedMessage)) return trimmedMessage;

  for (const allowedCode of RPC_CONTRACTS.add_courier_optional_document.errorCodes) {
    if (trimmedMessage.includes(allowedCode)) {
      return allowedCode as RpcErrorCode<'add_courier_optional_document'>;
    }
  }

  if (
    (error.code === '42501' ||
      error.code === '28000' ||
      trimmedMessage.includes('CONSENT_REQUIRED')) &&
    isAllowedAddOptionalDocumentError('UNAUTHORIZED_ACTOR')
  ) {
    return 'UNAUTHORIZED_ACTOR';
  }

  return 'INTERNAL_ERROR';
}

/** Typed server wrapper for `public.add_courier_optional_document(p_payload jsonb)`. */
export async function addCourierOptionalDocumentRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<
  ActionResult<
    AddCourierOptionalDocumentResult,
    RpcErrorCode<'add_courier_optional_document'> | 'INTERNAL_ERROR'
  >
> {
  const parsedInput = RPC_CONTRACTS.add_courier_optional_document.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('add_courier_optional_document', {
      p_payload: {
        kind: parsedInput.data.kind,
        storagePath: parsedInput.data.storagePath,
        ...(parsedInput.data.idempotencyKey
          ? { idempotencyKey: parsedInput.data.idempotencyKey }
          : {}),
        // CC-042: vehículo de la licencia o el seguro; sin él, la RPC usa el activo.
        ...(parsedInput.data.vehicleId ? { vehicleId: parsedInput.data.vehicleId } : {}),
      },
    });

    if (error) return err(mapAddCourierOptionalDocumentRpcError(error));

    const parsedOutput = RPC_CONTRACTS.add_courier_optional_document.outputSchema.safeParse(data);
    if (!parsedOutput.success) return err('INTERNAL_ERROR');

    return ok(parsedOutput.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}

// CC-042: vehículos del repartidor.
export type CourierVehicleRpcName =
  | 'get_my_courier_vehicles'
  | 'add_courier_vehicle'
  | 'update_courier_vehicle'
  | 'remove_courier_vehicle'
  | 'set_active_courier_vehicle';

/** Maps PostgREST / Postgres errors of a CC-042 vehicle RPC into its contract codes. */
export function mapCourierVehicleRpcError<K extends CourierVehicleRpcName>(
  rpcName: K,
  error: SupabaseRpcErrorLike,
): RpcErrorCode<K> | 'INTERNAL_ERROR' {
  const allowedCodes: readonly string[] = RPC_CONTRACTS[rpcName].errorCodes;
  const trimmedMessage = error.message.trim();
  const matched = allowedCodes.find((code) => trimmedMessage === code || trimmedMessage.includes(code));
  if (matched) return matched as RpcErrorCode<K>;
  if ((error.code === '42501' || error.code === '28000') && allowedCodes.includes('UNAUTHORIZED_ACTOR')) {
    return 'UNAUTHORIZED_ACTOR' as RpcErrorCode<K>;
  }
  return 'INTERNAL_ERROR';
}

function toCourierVehicleArgs<K extends CourierVehicleRpcName>(
  rpcName: K,
  input: RpcInput<K>,
): Record<string, unknown> {
  switch (rpcName) {
    case 'add_courier_vehicle': {
      const add = input as RpcInput<'add_courier_vehicle'>;
      return { p_vehicle_type: add.vehicleType, p_plate: add.plate, p_make_active: add.makeActive };
    }
    case 'update_courier_vehicle': {
      const update = input as RpcInput<'update_courier_vehicle'>;
      return { p_vehicle_id: update.vehicleId, p_plate: update.plate };
    }
    case 'remove_courier_vehicle':
    case 'set_active_courier_vehicle':
      return { p_vehicle_id: (input as RpcInput<'remove_courier_vehicle'>).vehicleId };
    default:
      return {};
  }
}

/** Typed server wrapper for the CC-042 vehicle RPCs (session client: the RPC checks the actor). */
export async function courierVehicleRpc<K extends CourierVehicleRpcName>(
  client: SupabaseRpcCaller,
  rpcName: K,
  rawInput: unknown,
): Promise<ActionResult<RpcOutput<K>, RpcErrorCode<K> | 'INTERNAL_ERROR'>> {
  const parsedInput = RPC_CONTRACTS[rpcName].inputSchema.safeParse(rawInput);
  if (!parsedInput.success) return err('VALIDATION_ERROR' as RpcErrorCode<K>);

  try {
    const { data, error } = await client.rpc(
      rpcName,
      toCourierVehicleArgs(rpcName, parsedInput.data as RpcInput<K>),
    );
    if (error) return err(mapCourierVehicleRpcError(rpcName, error));

    const parsedOutput = RPC_CONTRACTS[rpcName].outputSchema.safeParse(data);
    if (!parsedOutput.success) return err('INTERNAL_ERROR');

    return ok(parsedOutput.data as RpcOutput<K>);
  } catch {
    return err('INTERNAL_ERROR');
  }
}

export type ResubmitCourierRequiredDocumentResult = RpcOutput<'resubmit_courier_required_document'>;
type ResubmitErrorCode = RpcErrorCode<'resubmit_courier_required_document'>;

/** Maps PostgREST / Postgres errors returned by `resubmit_courier_required_document`. */
export function mapResubmitCourierRequiredDocumentRpcError(
  error: SupabaseRpcErrorLike,
): ResubmitErrorCode | 'INTERNAL_ERROR' {
  const message = error.message.trim();
  const allowed: readonly ResubmitErrorCode[] = RPC_CONTRACTS.resubmit_courier_required_document.errorCodes;
  const exact = allowed.find((code) => code === message);
  if (exact) return exact;
  const contained = allowed.find((code) => message.includes(code));
  if (contained) return contained;
  if (error.code === '42501' || error.code === '28000') return 'UNAUTHORIZED_ACTOR';
  return 'INTERNAL_ERROR';
}

/**
 * Typed server wrapper for `public.resubmit_courier_required_document(p_payload jsonb)`.
 * CC-052 (D5-A): un rechazado o suspendido vuelve a presentar un obligatorio en `submitted`, sin rehabilitarse.
 */
export async function resubmitCourierRequiredDocumentRpc(
  client: SupabaseRpcCaller,
  rawInput: unknown,
): Promise<ActionResult<ResubmitCourierRequiredDocumentResult, ResubmitErrorCode | 'INTERNAL_ERROR'>> {
  const parsedInput = RPC_CONTRACTS.resubmit_courier_required_document.inputSchema.safeParse(rawInput);
  if (!parsedInput.success) return err('VALIDATION_ERROR');

  try {
    const { data, error } = await client.rpc('resubmit_courier_required_document', {
      p_payload: parsedInput.data,
    });
    if (error) return err(mapResubmitCourierRequiredDocumentRpcError(error));

    const parsedOutput = RPC_CONTRACTS.resubmit_courier_required_document.outputSchema.safeParse(data);
    if (!parsedOutput.success) return err('INTERNAL_ERROR');
    return ok(parsedOutput.data);
  } catch {
    return err('INTERNAL_ERROR');
  }
}
