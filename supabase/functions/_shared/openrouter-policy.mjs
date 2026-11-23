// Data-handling policy and request-body builders for every OpenRouter call.
//
// Kept as plain JS (no Deno APIs) so it can be unit-tested with `node --test`
// and so there is exactly one place that decides what leaves the system.
//
// Policy (issue LL-002): every request must route only to zero-data-retention
// endpoints (`zdr: true`) and exclude providers that store or train on user data
// (`data_collection: 'deny'`). There is deliberately NO opt-out switch: if the
// configured model has no ZDR endpoint the request fails closed rather than
// sending user content to a provider that may retain it.

export const PROVIDER_DATA_POLICY = Object.freeze({
  zdr: true,
  data_collection: 'deny',
})

export function buildChatBody(model, request) {
  return {
    model,
    messages: request.messages,
    max_tokens: request.maxTokens,
    ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
    provider: { ...PROVIDER_DATA_POLICY },
  }
}

export function buildEmbeddingBody(model, input) {
  return {
    model,
    input,
    provider: { ...PROVIDER_DATA_POLICY },
  }
}

// OpenRouter returns 404 when no endpoint satisfies the routing constraints.
// Surfacing that distinctly makes a mis-chosen model easy to diagnose.
export function describePolicyFailure(status, model) {
  if (status === 404) {
    return `OpenRouter has no zero-data-retention endpoint for model "${model}". ` +
      'Choose a ZDR-eligible model (see OpenRouter ZDR endpoint list) or fix the account privacy settings.'
  }
  return null
}
