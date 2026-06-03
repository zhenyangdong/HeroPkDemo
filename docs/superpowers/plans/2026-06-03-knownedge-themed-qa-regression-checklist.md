# knownedge Themed QA Regression Checklist

## Scope

- Workspace: knownedge (exclude hero-pk and electronppt)
- Goal: verify topic-aware upload/list/QA and evidence-first response rendering

## Pre-check

- [ ] `npm install`
- [ ] `npm start`
- [ ] Open `http://localhost:3000`
- [ ] Login with a valid account

## API Checks

- [ ] `node scripts/check-topics.mjs` prints `TOPIC_STORE_OK`
- [ ] `node scripts/check-retrieval.mjs` prints `RETRIEVAL_BASE_OK`
- [ ] `node scripts/check-qa-contract.mjs` prints `QA_CONTRACT_OK`
- [ ] `node scripts/check-topic-api.mjs` prints `TOPIC_API_OK` (requires server running)

## Upload Flow

- [ ] Upload area shows topic selector
- [ ] Upload without selecting files is blocked as before
- [ ] Upload request contains `topicId`
- [ ] Upload succeeds and newly uploaded article can be listed

## List Filtering

- [ ] `/api/articles?topic=work` returns only mapped work-topic articles
- [ ] `/api/articles?topic=food` returns only mapped food-topic articles
- [ ] Existing category/tag filters still work with topic filter

## QA Flow

- [ ] QA panel shows topic selector
- [ ] Ask question without topic is blocked
- [ ] Ask question with topic sends `{ question, topicId }`
- [ ] Response includes `answer`, `confidence`, `topicId`, `insufficient`, `evidence`
- [ ] UI shows evidence cards first when `evidence` exists
- [ ] UI falls back to `sources` list when `evidence` is empty

## Backward Compatibility

- [ ] Legacy `answer` field still renders correctly
- [ ] Legacy `sources` click-to-open behavior still works
- [ ] Article detail rendering and comments remain functional

## Known Risks

- `scripts/check-topic-api.mjs` fails with `fetch failed` if server is not running.
- Topic mapping quality depends on upload-time `topicId` correctness.
