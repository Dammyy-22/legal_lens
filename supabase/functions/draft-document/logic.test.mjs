import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTemplateFallback, isFormalCorrespondence } from './logic.mjs'

test('builds a repair template without changing sender-provided facts', () => {
  const facts = 'I bought a radio and repaired it, but it is not working well.'
  const draft = buildTemplateFallback('repair_request', '', facts)

  assert.match(draft, /^RE: REQUEST FOR INSPECTION \/ REPAIR$/m)
  assert.match(draft, /Dear Sir\/Madam,/)
  assert.match(draft, /2\. The relevant facts, as provided, are as follows:/)
  assert.ok(draft.includes(facts))
  assert.match(draft, /3\. I respectfully request that you: \[State the specific inspection or repair requested\]\./)
  assert.match(draft, /Yours faithfully,/)
  assert.doesNotMatch(draft, /legal|statutory|liable|breach/i)
  assert.equal(isFormalCorrespondence(draft), true)
})

test('uses the supplied recipient in the template', () => {
  const draft = buildTemplateFallback('information_request', 'Amina', 'Please send the invoice copy.')

  assert.match(draft, /Dear Amina,/)
  assert.match(draft, /^RE: REQUEST FOR INFORMATION \/ RECORDS$/m)
})

test('uses a type-specific requested-action placeholder for every supported draft', () => {
  const cases = [
    ['information_request', '[Identify the information or records requested]'],
    ['repair_request', '[State the specific inspection or repair requested]'],
    ['consumer_complaint', '[State the resolution or response requested]'],
    ['workplace_records', '[Identify the records or clarification requested]'],
    ['meeting_follow_up', '[List the points you want the recipient to confirm]'],
  ]

  for (const [draftType, placeholder] of cases) {
    assert.ok(buildTemplateFallback(draftType, '', 'Facts supplied by the sender.').includes(placeholder))
  }
})

test('rejects unsupported correspondence types', () => {
  assert.throws(() => buildTemplateFallback('court_filing', '', 'Facts go here.'), /Unsupported/)
})

test('rejects generated copy without the required formal letter structure', () => {
  assert.equal(
    isFormalCorrespondence('Subject: Repair request\nPlease respond.'),
    false,
  )
})
