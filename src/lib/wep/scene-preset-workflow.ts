import {
  captureScenePreset,
  type CaptureSceneOptions,
  type EditorDocument
} from './scene-capture-runtime';

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
  document: EditorDocument;
  capture: CaptureSceneOptions;
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

export function createScenePresetWorkflow(publisher: ScenePresetPublisher) {
  if (!publisher || typeof publisher.publishScene !== 'function') {
    throw new WepSceneWorkflowError(
      'WEP_SCENE_PUBLISHER_REQUIRED',
      'publication'
    );
  }

  function capture(
    document: EditorDocument,
    options: CaptureSceneOptions
  ) {
    const result = captureScenePreset(document, options);
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
