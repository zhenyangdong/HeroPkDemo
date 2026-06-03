const body = {
  answer: 'x',
  evidence: [{ snippet: 's', source: 'a.md#p1', score: 3 }],
  sources: ['a.md'],
  supplementalInference: [],
};

if (!Array.isArray(body.evidence) || !Array.isArray(body.sources)) {
  throw new Error('QA contract invalid');
}

console.log('QA_CONTRACT_OK');
