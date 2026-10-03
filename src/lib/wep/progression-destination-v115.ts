type AnyRecord = Record<string, any>;

export const PROGRESSION_DESTINATION_V115_ARTIFACT =
  'DDV-PROGRESSION-DESTINATION-VETO-V125-V1_15';

export function evaluateProgressionDestinationConflicts({
  projection,
  destinationGridId,
  conflicts
}: {
  projection: AnyRecord | null | undefined;
  destinationGridId: number;
  conflicts: AnyRecord[];
}) {
  if (!projection) {
    return {
      status: 'PROJECTION_NOT_BOUND',
      blocked: false,
      blockerCode: null,
      positivePermissionGranted: false,
      persistentWriteAuthorized: false
    };
  }

  if (
    projection?.schema !== 'ddv.progression-destination-veto-projection@1' ||
    projection?.version !== 'v1.15' ||
    projection?.semantics?.absenceOfVetoIsPermission !== false ||
    projection?.semantics?.positivePermission !== false ||
    projection?.writerBoundary?.persistentWriteAuthorized !== false
  ) {
    throw new Error('WEP_PROGRESSION_DESTINATION_V115_PROJECTION_MISMATCH');
  }

  const gid = Number(destinationGridId);
  if (!Number.isSafeInteger(gid)) {
    throw new Error('WEP_PROGRESSION_DESTINATION_V115_GRID_ID_INVALID');
  }

  const matchedRecords = [];
  for (const conflict of Array.isArray(conflicts) ? conflicts : []) {
    const oid = Number(conflict?.editorId);
    if (!Number.isSafeInteger(oid)) continue;
    const record = projection?.byAddress?.[`${gid}:${oid}`];
    if (!record) continue;
    matchedRecords.push(record);
  }

  const protectedRecord = matchedRecords.find(
    (record: AnyRecord) =>
      Array.isArray(record?.operationVetoes?.DESTINATION_OVERWRITE) &&
      record.operationVetoes.DESTINATION_OVERWRITE.includes(
        'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
      )
  );

  return {
    status: protectedRecord
      ? 'BLOCKED'
      : 'NO_PROTECTED_CONFLICT_OBSERVED',
    blocked: Boolean(protectedRecord),
    blockerCode: protectedRecord
      ? 'PROTECTED_PROGRESSION_OBJECT_CONFLICT'
      : null,
    matchedRecords: structuredClone(matchedRecords),
    positivePermissionGranted: false,
    persistentWriteAuthorized: false
  };
}
