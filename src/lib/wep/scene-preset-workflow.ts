export interface WorkflowEditorDocument {
  objects: unknown[];
  [key: string]: unknown;
}

export interface WorkflowCaptureOptions {
  selectionIds: string[];
  title?: string;
  [key: string]: unknown;
}

export interface SceneCaptureResult {
  artifact: unknown;
  publicationReady: boolean;
  issues: unknown[];
  [key: string]: unknown;
}

export type SceneCaptureFunction = (
  document: WorkflowEditorDocument,
  options: WorkflowCaptureOptions,
  publicationValidator: ((artifact: unknown) => {
    ok: boolean;
    issues: Array<Record<string, unknown>>;
    [key: string]: unknown;
  }) | null
) => SceneCaptureResult;

export interface ScenePresetPublisher {
  publishScene(options: {
    artifact: unknown;
    creatorProfileId: string;
    visibility?: string;
    title: string;
    description?: string | null;
    metadata?: Record<string, unknown>;
    idempotencyKey: string;
  }): Promise<unknown>;
}

export interface PublishCapturedSceneOptions {
  document: WorkflowEditorDocument;
  capture: WorkflowCaptureOptions;
  creatorProfileId: string;
  visibility?: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export class WepSceneWorkflowError extends Error {
  readonly stage: 'capture' | 'publication';
  readonly issues: unknown[];

  constructor(
    code: string,
    stage: 'capture' | 'publication',
    issues: unknown[] = []
  ) {
    super(code);
    this.name = 'WepSceneWorkflowError';
    this.stage = stage;
    this.issues = issues;
  }
}

export function createScenePresetWorkflow({
  publisher,
  captureScene,
  publicationValidator
}: {
  publisher: ScenePresetPublisher;
  captureScene: SceneCaptureFunction;
  publicationValidator: (artifact: unknown) => {
    ok: boolean;
    issues: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}) {
  if (!publisher || typeof publisher.publishScene !== 'function') {
    throw new WepSceneWorkflowError(
      'WEP_SCENE_PUBLISHER_REQUIRED',
      'publication'
    );
  }
  if (typeof captureScene !== 'function') {
    throw new WepSceneWorkflowError(
      'WEP_SCENE_CAPTURE_REQUIRED',
      'capture'
    );
  }
  if (typeof publicationValidator !== 'function') {
    throw new WepSceneWorkflowError(
      'WEP_SCENE_PUBLICATION_VALIDATOR_REQUIRED',
      'capture'
    );
  }

  function capture(
    document: WorkflowEditorDocument,
    options: WorkflowCaptureOptions
  ) {
    let result: SceneCaptureResult;
    try {
      result = captureScene(
        document,
        options,
        publicationValidator
      );
    } catch (error) {
      if (error instanceof WepSceneWorkflowError) throw error;
      const wrapped = new WepSceneWorkflowError(
        'WEP_SCENE_CAPTURE_FAILED',
        'capture'
      );
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }

    if (!result.publicationReady) {
      throw new WepSceneWorkflowError(
        'WEP_SCENE_CAPTURE_NOT_PUBLISHABLE',
        'capture',
        result.issues
      );
    }
    return result;
  }

  async function publishCapturedScene({
    document,
    capture: captureOptions,
    creatorProfileId,
    visibility = 'unlisted',
    title,
    description = null,
    metadata = {},
    idempotencyKey
  }: PublishCapturedSceneOptions) {
    const captured = capture(document, {
      ...captureOptions,
      title
    });

    let published: unknown;
    try {
      published = await publisher.publishScene({
        artifact: captured.artifact,
        creatorProfileId,
        visibility,
        title,
        description,
        metadata,
        idempotencyKey
      });
    } catch (error) {
      if (error instanceof WepSceneWorkflowError) throw error;
      const wrapped = new WepSceneWorkflowError(
        'WEP_SCENE_PUBLICATION_FAILED',
        'publication'
      );
      (wrapped as Error & { cause?: unknown }).cause = error;
      throw wrapped;
    }

    return {
      captured,
      published
    };
  }

  return Object.freeze({
    capture,
    publishCapturedScene
  });
}
