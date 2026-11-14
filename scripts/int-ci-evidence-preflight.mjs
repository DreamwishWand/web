// Read-only evidence validation. Caller must obtain snapshots from trusted GitHub API.
// No workflow execution, authorization, merge, deployment, or flag changes.
const SHA = /^[0-9a-f]{40}$/;
const positive = n => Number.isSafeInteger(n) && n > 0;
const deny = reason => { throw new Error(reason); };
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const sha = x => typeof x === 'string' && SHA.test(x);
const validRepo = x => object(x) && positive(x.id);
const exactKeys = (x, keys) => object(x) && Object.keys(x).sort().join(',') === [...keys].sort().join(',');
const workflowPath = x => typeof x === 'string' && /^\.github\/workflows\/[A-Za-z0-9_.-]+\.ya?ml$/.test(x);
const safeJob = x => typeof x === 'string' && x.length > 0 && x.length <= 160 && !/[\x00-\x1f\x7f]/.test(x);

export function inspectRunEvidence(expected, run, jobsResponse) {
  if (!exactKeys(expected, ['repositoryId','workflowId','workflowPath','head','event','base','pr','runId','attempt','jobs']) ||
      !positive(expected.repositoryId) || !positive(expected.workflowId) || !positive(expected.runId) ||
      !positive(expected.attempt) || !workflowPath(expected.workflowPath) || !sha(expected.head) ||
      !['pull_request','push'].includes(expected.event) ||
      !Array.isArray(expected.jobs) || expected.jobs.length < 1 || expected.jobs.length > 100 ||
      !Array.from({length:expected.jobs.length}, (_,i)=>Object.hasOwn(expected.jobs,i) && safeJob(expected.jobs[i])).every(Boolean) || new Set(expected.jobs).size !== expected.jobs.length ||
      (expected.event === 'pull_request' ? (!positive(expected.pr) || !sha(expected.base)) :
        (expected.pr !== null || expected.base !== null))) deny('INVALID_EXPECTATION');
  if (!object(run) || run.id !== expected.runId || run.workflow_id !== expected.workflowId ||
      run.path !== expected.workflowPath || run.head_sha !== expected.head ||
      run.event !== expected.event || run.run_attempt !== expected.attempt ||
      !validRepo(run.repository) || run.repository.id !== expected.repositoryId ||
      !validRepo(run.head_repository) || run.head_repository.id !== expected.repositoryId)
    deny('RUN_IDENTITY_MISMATCH');
  if (run.status !== 'completed' || run.conclusion !== 'success') deny('RUN_NOT_SUCCESS');
  if (expected.event === 'pull_request') {
    if (!Array.isArray(run.pull_requests) || run.pull_requests.length !== 1) deny('PR_BINDING_MISSING_OR_AMBIGUOUS');
    const p = run.pull_requests[0];
    if (!object(p) || p.number !== expected.pr || p.head?.sha !== expected.head ||
        p.head?.repo?.id !== expected.repositoryId || p.base?.sha !== expected.base ||
        p.base?.repo?.id !== expected.repositoryId || p.base?.ref !== 'main') deny('PR_BINDING_MISMATCH');
  } else if (run.head_branch !== 'main') deny('PUSH_NOT_MAIN');
  if (!object(jobsResponse) || !Array.isArray(jobsResponse.jobs) ||
      jobsResponse.total_count !== jobsResponse.jobs.length ||
      jobsResponse.jobs.length !== expected.jobs.length) deny('JOB_SET_INCOMPLETE_OR_UNEXPECTED');
  const seen = new Set(), ids = new Set();
  for (const j of jobsResponse.jobs) {
    if (!object(j) || !Object.hasOwn(j,'name') || !safeJob(j.name) || !positive(j.id) || ids.has(j.id) || seen.has(j.name) ||
        !expected.jobs.includes(j.name) || j.run_id !== run.id ||
        j.run_attempt !== run.run_attempt || j.head_sha !== expected.head) deny('JOB_IDENTITY_MISMATCH');
    if (j.status !== 'completed' || j.conclusion !== 'success') deny('JOB_NOT_SUCCESS');
    seen.add(j.name); ids.add(j.id);
  }
  return {version:1, status:'CI_EVIDENCE_MATCH_ONLY', repositoryId:expected.repositoryId,
    workflowId:expected.workflowId, workflowPath:expected.workflowPath, runId:run.id,
    attempt:run.run_attempt, head:expected.head, base:expected.base, pr:expected.pr, event:expected.event,
    jobs:jobsResponse.jobs.map(j=>({id:j.id,name:j.name})).sort((a,b)=>a.name.localeCompare(b.name)),
    mergeAuthorized:false, acceptanceVerified:false, remoteFreshnessVerified:false};
}
