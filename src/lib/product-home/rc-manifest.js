// INTERNAL RC scope registry. UI metadata only; never use as server authorization.
// RC_REQUIRED identifies planned internal coverage, NOT a verified/enabled operation.
export const RC_ROUTE_STATUS = Object.freeze({
  REQUIRED: 'RC_REQUIRED',
  CONDITIONAL: 'CONDITIONAL',
  OFF: 'OFF'
});
const job = (name, href, status, boundary) => Object.freeze({ name, href, status, boundary });
export const WAND_RC_PRODUCTS = Object.freeze([
  Object.freeze({ id:'decorate', name:'Decorate', href:'/decorate/', jobs:Object.freeze([
    job('Explore','/explore/','RC_REQUIRED','Reference discovery only'),
    job('Moodboards','/moodboards/','RC_REQUIRED','Local creative state; never remote publish'),
    job('World Editor','/editor/world/','CONDITIONAL','Local inspect/preview only; persistent Grid/Road/Fence/Apply OFF')
  ])}),
  Object.freeze({ id:'collection', name:'Collection', href:'/collection/', jobs:Object.freeze([
    job('Category-first workspace','/collection/','RC_REQUIRED','Reference-only; ownership and percentages not inferred; unsupported version blocked')
  ])}),
  Object.freeze({ id:'guide', name:'Guide', href:'/guide/', jobs:Object.freeze([
    job('Quests, Star Paths, Events, Systems','/guide/','RC_REQUIRED','Curated reference only; unreviewed articles and claims not published')
  ])}),
  Object.freeze({ id:'presets', name:'Presets', href:'/presets/', jobs:Object.freeze([
    job('Discover and Library','/presets/','CONDITIONAL','Remote public discovery and Save require independent permission/Provider QA'),
    job('In-game presets','/presets/','RC_REQUIRED','Read/inspect boundaries only; game Save Writer OFF'),
    job('Scene creation preview','/editor/world/','CONDITIONAL','Local preview only; native Apply and persistent export OFF')
  ])}),
  Object.freeze({ id:'gallery', name:'Gallery', href:'/gallery/', jobs:Object.freeze([
    job('Discover works','/gallery/','CONDITIONAL','Public read requires phase, rights, privacy and managed acceptance'),
    job('My Gallery','/gallery/my/','OFF','Account/Work ownership and private media not enabled'),
    job('Publish','/gallery/publish/','OFF','Rights, signed Publisher, Provider and moderation not accepted')
  ])}),
  Object.freeze({ id:'dreamsnaps', name:'DreamSnaps', href:'/dreamsnaps/', jobs:Object.freeze([
    job('Community DreamSnaps','/dreamsnaps/community/','OFF','Active submission embargo/phase, old bearer and typed Work privacy unaccepted'),
    job('Submit','/dreamsnaps/submit/','OFF','Public submission and Media Publisher OFF'),
    job('Judge','/dreamsnaps/judge/','OFF','Anonymous competition and votes require independent acceptance'),
    job('Results','/dreamsnaps/results/','OFF','Official Account-global consent defaults PRIVATE; no historical disclosure'),
    job('My DreamSnaps','/dreamsnaps/my/','CONDITIONAL','Owner metadata/private projection only after signed and managed gates')
  ])}),
  Object.freeze({ id:'help', name:'Community Help Center', href:'/help/', participationSurface:true, jobs:Object.freeze([
    job('Questions','/help/questions/','CONDITIONAL','Public Q&A reads gated; authorship verified before posts'),
    job('Tips','/help/tips/','CONDITIONAL','Public tips reads gated; moderation/rights before posts'),
    job('Issues','/help/issues/','OFF','Normalized public Issue authority not yet accepted'),
    job('My Activity','/help/my/','OFF','Account-private activity requires managed owner authorization')
  ])})
]);
export const WAND_RC_RESTRICTED_OPERATIONS = Object.freeze([
  'Product Owner Auth and server-first Logout',
  'Community Source156 signed Owner consumer and private cache',
  'Publish, Comments/Replies and public moderation actions',
  'Cloud, Provider or old-bearer/CDN media URLs',
  'DDV Save Writer, Native Apply, Road/Fence persistent edit',
  'Official DreamSnaps result publication and active-vote disclosure'
].map((name)=>Object.freeze({name,status:'OFF'})));
export const WAND_RC_TARGET = Object.freeze({
  internalRcDate:'2026-11-30',
  initialLocalReleaseTarget:'2026-11-30',
  acceptance:'NOT_ACCEPTED',
  release:'PUBLIC_NO_GO',
  writer:'OFF',
  ownerConsumer:'OFF',
  managedIngress:'I01-I14_NOT_ACCEPTED',
  communitySource:'Source156_INDEPENDENT_TARGETED_PASS_MANAGED_OFF',
  referenceVersion:'Nintendo Switch 1.25.0 (reference-only); other versions require independent validation'
});
