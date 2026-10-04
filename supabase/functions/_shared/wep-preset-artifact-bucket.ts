export const WEP_PRESET_ARTIFACT_BUCKET_ENV =
  'WEP_PRESET_ARTIFACT_BUCKET';

export const WEP_PRESET_ARTIFACT_STAGING_BUCKET =
  'wand-preset-artifacts-staging';

export const WEP_PRESET_KNOWN_STAGING_PROJECT_REF =
  'ptpdoxhrqopvczpclcij';

function projectRefFromSupabaseUrl(value: string | null | undefined) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  try {
    const hostname = new URL(raw).hostname.toLowerCase();
    const suffix = '.supabase.co';
    if (!hostname.endsWith(suffix)) return null;
    const candidate = hostname.slice(0, -suffix.length);
    if (!candidate || candidate.includes('.')) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function resolveWepPresetArtifactBucket({
  explicitBucket = null,
  supabaseUrl = null
}: {
  explicitBucket?: string | null;
  supabaseUrl?: string | null;
} = {}) {
  const explicit = String(explicitBucket ?? '').trim();
  const projectRef = projectRefFromSupabaseUrl(supabaseUrl);
  const knownStaging =
    projectRef === WEP_PRESET_KNOWN_STAGING_PROJECT_REF;

  if (explicit) {
    if (
      !knownStaging &&
      explicit === WEP_PRESET_ARTIFACT_STAGING_BUCKET
    ) {
      throw new Error(
        'WEP_PRESET_ARTIFACT_BUCKET_STAGING_FORBIDDEN_OUTSIDE_KNOWN_STAGING'
      );
    }
    return explicit;
  }

  if (knownStaging) {
    return WEP_PRESET_ARTIFACT_STAGING_BUCKET;
  }

  throw new Error(
    'WEP_PRESET_ARTIFACT_BUCKET_REQUIRED_OUTSIDE_KNOWN_STAGING'
  );
}

export function resolveRuntimeWepPresetArtifactBucket() {
  return resolveWepPresetArtifactBucket({
    explicitBucket: Deno.env.get(WEP_PRESET_ARTIFACT_BUCKET_ENV),
    supabaseUrl: Deno.env.get('SUPABASE_URL')
  });
}
