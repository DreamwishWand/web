import test from 'node:test';
import assert from 'node:assert/strict';

class CommunityHarness {
  constructor() {
    this.seq = 0;
    this.accounts = new Map();
    this.creators = new Map();
    this.entities = new Map();
    this.works = new Map();
    this.revisions = new Map();
    this.presets = new Map();
    this.saves = new Set();
    this.follows = new Set();
    this.reactions = new Set();
    this.comments = new Map();
    this.notifications = [];
    this.reports = new Map();
    this.moderationActions = [];
    this.search = new Set();
    this.outbox = [];
    this.idempotency = new Map();
  }

  id(prefix) {
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  createUser(name, { staff = false } = {}) {
    const accountId = this.id('account');
    const creatorProfileId = this.id('creator');
    this.accounts.set(accountId, { accountId, status: 'active', staff });
    this.entities.set(creatorProfileId, { type: 'creator_profile', deleted: false });
    this.creators.set(creatorProfileId, { creatorProfileId, ownerAccountId: accountId, name });
    return { accountId, creatorProfileId };
  }

  ownerOf(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) return null;
    if (entity.type === 'community_work') return this.works.get(entityId)?.ownerAccountId ?? null;
    if (entity.type === 'preset_artifact') return this.presets.get(entityId)?.ownerAccountId ?? null;
    if (entity.type === 'comment') return this.comments.get(entityId)?.authorAccountId ?? null;
    if (entity.type === 'creator_profile') return this.creators.get(entityId)?.ownerAccountId ?? null;
    return null;
  }

  canRead(entityId, requesterAccountId) {
    const account = requesterAccountId ? this.accounts.get(requesterAccountId) : null;
    if (account?.staff || this.ownerOf(entityId) === requesterAccountId) return true;
    const entity = this.entities.get(entityId);
    if (!entity || entity.deleted) return false;

    if (entity.type === 'community_work') {
      const w = this.works.get(entityId);
      return Boolean(
        w &&
          w.lifecycle === 'published' &&
          w.currentRevisionId &&
          w.moderation === 'clear' &&
          (w.visibility === 'public' || w.visibility === 'unlisted')
      );
    }

    if (entity.type === 'preset_artifact') {
      const p = this.presets.get(entityId);
      return Boolean(p?.publicationWorkId && this.canRead(p.publicationWorkId, requesterAccountId));
    }

    if (entity.type === 'comment') {
      const c = this.comments.get(entityId);
      return Boolean(
        c &&
          c.lifecycle !== 'deleted' &&
          c.moderation === 'clear' &&
          this.canRead(c.targetEntityId, requesterAccountId)
      );
    }

    if (entity.type === 'creator_profile') return true;
    return false;
  }

  isDiscoverable(workId) {
    const w = this.works.get(workId);
    return Boolean(
      w &&
        w.lifecycle === 'published' &&
        w.visibility === 'public' &&
        w.moderation === 'clear' &&
        w.currentRevisionId
    );
  }

  syncSearch(workId) {
    if (this.isDiscoverable(workId)) this.search.add(workId);
    else this.search.delete(workId);
  }

  notify(recipient, actor, type, target) {
    if (recipient === actor) return;
    this.notifications.push({ recipient, actor, type, target });
  }

  once(actor, key, fn) {
    const k = `${actor}:${key}`;
    if (this.idempotency.has(k)) return this.idempotency.get(k);
    const result = fn();
    this.idempotency.set(k, result);
    return result;
  }

  createDraft(owner, creatorProfileId, visibility = 'private') {
    assert.equal(this.creators.get(creatorProfileId)?.ownerAccountId, owner);
    const workId = this.id('work');
    this.entities.set(workId, { type: 'community_work', deleted: false });
    this.works.set(workId, {
      workId,
      ownerAccountId: owner,
      creatorProfileId,
      lifecycle: 'draft',
      visibility,
      moderation: 'clear',
      currentRevisionId: null,
      rowVersion: 1
    });
    return workId;
  }

  publish(owner, workId, expectedVersion, idempotencyKey, { subtypeValid = true, mediaReady = true } = {}) {
    return this.once(owner, idempotencyKey, () => {
      const w = this.works.get(workId);
      assert.ok(w);
      assert.equal(w.ownerAccountId, owner, 'only owner may publish');
      assert.equal(w.rowVersion, expectedVersion, 'optimistic concurrency');
      assert.equal(subtypeValid, true, 'subtype preflight');
      assert.equal(mediaReady, true, 'media preflight');
      assert.equal(w.moderation, 'clear', 'moderation preflight');

      const revisionId = this.id('revision');
      const revision = Object.freeze({ revisionId, workId, number: 1, createdBy: owner });
      this.revisions.set(revisionId, revision);
      w.lifecycle = 'published';
      w.currentRevisionId = revisionId;
      w.rowVersion += 1;
      this.outbox.push({ type: 'work.published', aggregateId: workId, dispatched: false });
      this.syncSearch(workId);
      return { workId, revisionId, rowVersion: w.rowVersion };
    });
  }

  setVisibility(owner, workId, visibility) {
    const w = this.works.get(workId);
    assert.equal(w?.ownerAccountId, owner);
    w.visibility = visibility;
    w.rowVersion += 1;
    this.outbox.push({ type: 'work.visibility_changed', aggregateId: workId, dispatched: false });
    this.syncSearch(workId);
  }

  save(actor, target, key = `save:${target}`) {
    return this.once(actor, key, () => {
      assert.equal(this.canRead(target, actor), true, 'save requires current access');
      this.saves.add(`${actor}:${target}`);
      return { target };
    });
  }

  follow(actor, creatorProfileId, key = `follow:${creatorProfileId}`) {
    return this.once(actor, key, () => {
      const owner = this.creators.get(creatorProfileId)?.ownerAccountId;
      assert.ok(owner);
      assert.notEqual(actor, owner, 'self-follow is invalid');
      this.follows.add(`${actor}:${creatorProfileId}`);
      this.notify(owner, actor, 'follow', creatorProfileId);
      return { creatorProfileId };
    });
  }

  react(actor, target, kind, key = `react:${target}:${kind}`) {
    return this.once(actor, key, () => {
      assert.equal(this.canRead(target, actor), true);
      this.reactions.add(`${actor}:${target}:${kind}`);
      this.notify(this.ownerOf(target), actor, 'reaction', target);
      return { target, kind };
    });
  }

  comment(actor, creatorProfileId, target, body, parentCommentId = null, key = this.id('comment-command')) {
    return this.once(actor, key, () => {
      assert.equal(this.creators.get(creatorProfileId)?.ownerAccountId, actor);
      assert.equal(this.canRead(target, actor), true);
      if (parentCommentId) assert.equal(this.comments.get(parentCommentId)?.targetEntityId, target);
      const commentId = this.id('comment');
      this.entities.set(commentId, { type: 'comment', deleted: false });
      this.comments.set(commentId, {
        commentId,
        targetEntityId: target,
        authorAccountId: actor,
        creatorProfileId,
        parentCommentId,
        body,
        lifecycle: 'active',
        moderation: 'clear'
      });
      const recipient = parentCommentId
        ? this.comments.get(parentCommentId).authorAccountId
        : this.ownerOf(target);
      this.notify(recipient, actor, parentCommentId ? 'reply' : 'comment', commentId);
      return commentId;
    });
  }

  publishPreset(owner, creatorProfileId) {
    const presetArtifactId = this.id('preset');
    const presetWorkId = this.createDraft(owner, creatorProfileId, 'public');
    this.entities.set(presetArtifactId, { type: 'preset_artifact', deleted: false });
    this.presets.set(presetArtifactId, {
      presetArtifactId,
      ownerAccountId: owner,
      creatorProfileId,
      publicationWorkId: presetWorkId
    });
    const publication = this.publish(owner, presetWorkId, 1, `publish:${presetWorkId}`);
    return { presetArtifactId, presetRevisionId: this.id('preset-revision'), publication };
  }

  report(actor, target, key = `report:${target}`) {
    return this.once(actor, key, () => {
      assert.equal(this.canRead(target, actor), true);
      const reportId = this.id('report');
      this.reports.set(reportId, { reportId, reporter: actor, target, status: 'open' });
      return reportId;
    });
  }

  moderate(staffAccountId, target, action) {
    assert.equal(this.accounts.get(staffAccountId)?.staff, true);
    const w = this.works.get(target);
    assert.ok(w);
    const prior = w.moderation;
    if (action === 'restrict') w.moderation = 'restricted';
    else if (action === 'remove') w.moderation = 'removed';
    else if (action === 'restore') w.moderation = 'clear';
    else throw new Error('unsupported action');
    this.moderationActions.push({ staffAccountId, target, action, prior, resulting: w.moderation });
    this.outbox.push({ type: `moderation.${action}`, aggregateId: target, dispatched: false });
    this.syncSearch(target);
  }

  processOutbox({ fail = false } = {}) {
    for (const event of this.outbox) {
      if (event.dispatched) continue;
      if (fail) throw new Error('simulated worker failure');
      event.dispatched = true;
    }
  }
}

test('VS end-to-end: A publishes; B discovers, interacts, saves Preset, reports; moderator acts', () => {
  const h = new CommunityHarness();
  const a = h.createUser('A');
  const b = h.createUser('B');
  const mod = h.createUser('M', { staff: true });

  const workId = h.createDraft(a.accountId, a.creatorProfileId, 'public');
  const published = h.publish(a.accountId, workId, 1, 'publish-gallery');
  assert.ok(published.revisionId);
  assert.equal(h.search.has(workId), true);

  h.save(b.accountId, workId);
  h.follow(b.accountId, a.creatorProfileId);
  h.react(b.accountId, workId, 'like');
  const commentId = h.comment(b.accountId, b.creatorProfileId, workId, 'Great layout');
  h.comment(a.accountId, a.creatorProfileId, workId, 'Thanks', commentId);

  const preset = h.publishPreset(a.accountId, a.creatorProfileId);
  h.save(b.accountId, preset.presetArtifactId);
  assert.equal(h.ownerOf(preset.presetArtifactId), a.accountId);

  const reportId = h.report(b.accountId, workId);
  assert.equal(h.reports.get(reportId).target, workId);

  h.moderate(mod.accountId, workId, 'restrict');
  assert.equal(h.search.has(workId), false);
  assert.equal(h.canRead(workId, b.accountId), false);
  h.moderate(mod.accountId, workId, 'restore');
  assert.equal(h.search.has(workId), true);

  assert.ok(h.notifications.some((n) => n.type === 'follow' && n.recipient === a.accountId));
  assert.ok(h.notifications.some((n) => n.type === 'comment' && n.recipient === a.accountId));
  assert.ok(h.notifications.some((n) => n.type === 'reply' && n.recipient === b.accountId));
  assert.ok(h.notifications.some((n) => n.type === 'reaction' && n.recipient === a.accountId));
});

test('VS privacy/authorization: stale save is not access and B cannot mutate A content', () => {
  const h = new CommunityHarness();
  const a = h.createUser('A');
  const b = h.createUser('B');
  const workId = h.createDraft(a.accountId, a.creatorProfileId, 'public');
  h.publish(a.accountId, workId, 1, 'publish');
  h.save(b.accountId, workId);

  assert.throws(() => h.publish(b.accountId, workId, 2, 'steal'), /only owner/);

  h.setVisibility(a.accountId, workId, 'private');
  assert.equal(h.search.has(workId), false);
  assert.equal(h.canRead(workId, b.accountId), false);
  assert.equal(h.saves.has(`${b.accountId}:${workId}`), true, 'saved reference remains');
  assert.throws(() => h.save(b.accountId, workId, 'save-again'), /current access/);

  h.setVisibility(a.accountId, workId, 'unlisted');
  assert.equal(h.search.has(workId), false);
  assert.equal(h.canRead(workId, b.accountId), true);
});

test('VS retries are idempotent and self-notifications are suppressed', () => {
  const h = new CommunityHarness();
  const a = h.createUser('A');
  const b = h.createUser('B');
  const workId = h.createDraft(a.accountId, a.creatorProfileId, 'public');

  const one = h.publish(a.accountId, workId, 1, 'publish-once');
  const two = h.publish(a.accountId, workId, 1, 'publish-once');
  assert.deepEqual(two, one);
  assert.equal(h.revisions.size, 1);

  h.save(b.accountId, workId, 'same-save');
  h.save(b.accountId, workId, 'same-save');
  assert.equal([...h.saves].filter((x) => x === `${b.accountId}:${workId}`).length, 1);

  h.react(b.accountId, workId, 'like', 'same-reaction');
  h.react(b.accountId, workId, 'like', 'same-reaction');
  assert.equal([...h.reactions].filter((x) => x.includes(workId)).length, 1);

  h.comment(a.accountId, a.creatorProfileId, workId, 'owner note');
  assert.equal(h.notifications.some((n) => n.actor === a.accountId && n.recipient === a.accountId), false);
});

test('VS outbox failure does not revoke committed publication and remains retryable', () => {
  const h = new CommunityHarness();
  const a = h.createUser('A');
  const workId = h.createDraft(a.accountId, a.creatorProfileId, 'public');
  h.publish(a.accountId, workId, 1, 'publish');

  assert.equal(h.works.get(workId).lifecycle, 'published');
  assert.throws(() => h.processOutbox({ fail: true }), /simulated worker failure/);
  assert.equal(h.works.get(workId).lifecycle, 'published');
  assert.equal(h.outbox.some((e) => !e.dispatched), true);

  h.processOutbox();
  assert.equal(h.outbox.every((e) => e.dispatched), true);
});
