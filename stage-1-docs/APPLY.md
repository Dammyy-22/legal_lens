# Applying the Stage 1 docs to your repo

Option A (copy): copy the `docs/` folder from this bundle into the root of `legal_lens`, then:

    git checkout -b audit/stage-1-docs
    git add docs && git commit -m "docs: Stage 1 audit and plan"
    git push -u origin audit/stage-1-docs

Option B (patch, keeps the commit): from the repo root

    git checkout -b audit/stage-1-docs
    git am stage1-docs.patch
    git push -u origin audit/stage-1-docs

The push from my sandbox failed with "could not read Username for https://github.com" (no credentials available to me).
