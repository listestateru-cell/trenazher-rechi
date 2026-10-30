'use strict';
/* Подтверждённый разбор остаётся текстом; незавершённые записи не трогаем. */
window.TrainerAudioRetention = (() => {
  const sending = new Set();
  const active = attempt => ['processing', 'reviewing', 'running', 'queued', 'waiting', 'pending'].includes(attempt.status);
  function ready(session) {
    if (!session || session.demonstration || session.audio_removed && !session.conversation) return false;
    if (session.assessment) return session.assessment.phase === 'confirmed' && !!session.assessment.confirmed_at
      && !!(session.assessment.result || {}).usable && (session.takes || []).length === 1
      && session.takes[0].status === 'done';
    const thoughts = session.thoughts || [];
    if (thoughts.some(thought => (thought.attempts || []).some(active))) return false;
    if (session.lesson) {
      const attempts = session.lesson.attempts || [], last = attempts[attempts.length - 1];
      return session.lesson.phase === 'complete' && last && last.status === 'done' && !!last.review && !attempts.some(active);
    }
    if (session.learning_kind) {
      const answered = thoughts.filter(thought => (thought.attempts || []).length);
      return answered.length > 0 && answered.every(thought => {
        const attempts = thought.attempts || [], last = attempts[attempts.length - 1];
        return last && last.status === 'done' && !!last.review;
      });
    }
    const takes = session.takes || [], plan = session.plan || [], analysis = session.analysis || {};
    if (!takes.length || !session.conversation && !plan.length || !session.summary || analysis.status !== 'done' || analysis.transcript_stale) return false;
    if (session.conversation && session.conversation.phase !== 'finished') return false;
    if (!session.conversation && takes.length !== plan.length) return false;
    const revision = session.transcript_revision || 0;
    if ((analysis.source_revision || 0) !== revision || (analysis.requested_revision ?? revision) !== revision) return false;
    const expected = session.conversation ? takes : plan;
    const indexes = analysis.takes || [];
    if (indexes.length !== expected.length || new Set(indexes).size !== expected.length || indexes.some(index => !Number.isInteger(index) || index < 0 || index >= expected.length)) return false;
    return expected.every((_, index) => takes[index] && takes[index].status === 'done' && (analysis.takes || []).includes(index))
      && (analysis.result && analysis.result.takes || []).length === expected.length;
  }
  function sameView(sid, hash = location.hash) {
    return new RegExp(`^#/(?:s|conversation)/${sid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[/?]|$)`).test(hash);
  }
  async function send(record) {
    const drafts = window.TrainerDrafts;
    if (!drafts || record.profile !== drafts.profile() || sameView(record.sid) || sending.has(record.key)) return;
    sending.add(record.key);
    try {
      const result = await api(`/api/sessions/${encodeURIComponent(record.sid)}/finish`, { method: 'POST', body: {}, requestId: record.requestId,
        onRequestId: id => { record.requestId = id; drafts.put(record.id, record, record.profile).catch(() => {}); } });
      if ((result.audio_retention || {}).status === 'pending') {
        record.requestId = null;
        await drafts.put(record.id, record, record.profile);
      } else await drafts.remove(record.id, record.requestId, record.profile);
    } catch (error) {
      if ([400, 403, 404, 409].includes(error.status)) await drafts.remove(record.id, record.requestId, record.profile);
      else {
        if (error.status >= 500 || error.status === 429) record.requestId = null;
        else if (error.requestId) record.requestId = error.requestId;
        await drafts.put(record.id, record, record.profile);
      }
    } finally { sending.delete(record.key); }
  }
  async function leave(session, nextHash = location.hash, expectedOwner = null) {
    if (!ready(session) || sameView(session.id, nextHash) || !window.TrainerDrafts) return;
    const owner = expectedOwner || TrainerDrafts.profile();
    if (TrainerDrafts.profile() !== owner) return;
    const id = `finish-audio:${session.id}`;
    const previous = await TrainerDrafts.get(id, owner);
    if (TrainerDrafts.profile() !== owner) return;
    const record = previous || await TrainerDrafts.put(id, { kind: 'finish-audio', sid: session.id, requestId: null }, owner);
    await send(record);
  }
  async function retry() {
    if (!window.TrainerDrafts || typeof api !== 'function') return;
    for (const record of (await TrainerDrafts.list()).filter(record => record.kind === 'finish-audio')) await send(record);
  }
  window.addEventListener('trainer:backendchange', () => retry().catch(() => {}));
  window.addEventListener('trainer:connectionrestored', () => retry().catch(() => {}));
  return { ready, leave, retry };
})();
