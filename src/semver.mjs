// Semantic Versioning 2.0.0 grammar, from
// https://semver.org/#is-there-a-suggested-regular-expression-regex-to-check-a-semver-string
// Exact versions only: no leading "v", ranges, or dist-tags.
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

export function isExactSemver(value) {
  return typeof value === 'string' && SEMVER.test(value);
}
