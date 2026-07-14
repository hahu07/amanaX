# Vendored: Canton Token Standard (CIP-0056) Daml interfaces

Source: https://github.com/canton-network/splice (formerly hyperledger-labs/splice)
Path: `token-standard/` in that repo
Pinned tag: `0.6.11` (the TestNet-aligned bundle per the Canton token-standard docs)
Commit: fd93f86ac42ce3a08985dcd0baae530b4f235f60
License: Apache-2.0 (see upstream repo)

Packages vendored (v1 interfaces only — sufficient for the AmanaX MVP; v2 packages,
examples/, cli/ were not vendored):

- splice-api-token-metadata-v1
- splice-api-token-holding-v1
- splice-api-token-transfer-instruction-v1
- splice-api-token-allocation-v1
- splice-api-token-allocation-instruction-v1
- splice-api-token-allocation-request-v1

Each package's own `daml.yaml` pins `sdk-version: 3.5.2` (set upstream, not by us) —
this is why the AmanaX `daml/` packages also target SDK 3.5.2 (see daml/main/daml.yaml),
rather than the 3.4.11 baseline this project started on. Daml-LF target is 2.1 for all
of them (`build-options: [--target=2.1]`), which is what AmanaX's own packages must
also target to consume these as data-dependencies without an LF mismatch.

Build order (each depends on the previous via relative-path data-dependencies baked
into their daml.yaml, so build from the top down):
metadata-v1 -> holding-v1 -> {transfer-instruction-v1, allocation-v1} -> {allocation-instruction-v1, allocation-request-v1}

Update procedure: re-run the sparse-checkout of `token-standard/` at a newer tag,
diff against this directory, replace, re-record the tag/commit here.
