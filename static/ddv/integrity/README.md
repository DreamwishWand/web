# Canonical Baseline Integrity

This directory contains the repository-side machine-readable mirror of the DDVRE canonical integrity policy.

The authoritative policy and registry live in Google Drive:
- Policy: 1Hf-RlE915rmuSD_HgKQCsRLPHfqUJbJV4htSOlomWN0
- Registry: 1bg391mzViHRJwtO9FCBSInWVKIbLxh6QSe3icuew3U4

## Rule

A PROMOTED baseline is immutable. A semantic change requires:
1. new version;
2. explicit supersession;
3. new evidence and regression;
4. explicit promotion marker.

The verifier intentionally protects the currently promoted v1.7/v1.8/v1.9 GridData contracts. It does not authorize persistent save writing.

Changes to the protected registry without an explicit promotion marker fail CI.


Initial registry establishment is an explicit promotion event: [PROMOTE] establishes the repository mirror for already-promoted DDVRE baselines; it does not promote new game semantics.
