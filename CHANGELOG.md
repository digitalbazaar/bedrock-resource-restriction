# bedrock-resource-restriction ChangeLog

## 10.0.0 - 2022-04-xx

### Changed
- **BREAKING**: Rename package to `@bedrock/resource-restriction`.
- **BREAKING**: Convert to module (ESM).
- **BREAKING**: Remove default export.
- **BREAKING**: Require node 14.x.

## 9.0.0 - 2022-03-17

### Changed
- **BREAKING**: Update peer dependencies:
  - `bedrock-tokenizer@6`.

## 8.0.0 - 2022-03-12

### Changed
- **BREAKING**: Update peer dependencies:
  - `bedrock-tokenizer@5`.

## 7.0.0 - 2022-03-01

### Changed
- **BREAKING**: Update peer dependencies:
  - `bedrock-tokenizer@4`

## 6.0.0 - 2022-01-14

### Changed
- **BREAKING**: Update peer dependencies.
  - Update `bedrock-tokenizer` to `v3.0`.
  - Update `bedrock` to `v4.4.3`.
  - Update `bedrock-mongodb` to `v8.4.1`.
- Update test dependencies.

### Added
- Add missing packages `base64url-universal` and `esm`.

### Removed
- Remove unnecessary `promisify`.
- Remove unused dependency `pako`.

## 5.1.0 - 2021-11-12

### Added
- Added optional `explain` param to get more details about database performance.
- Added database tests in order to check database performance.

### Changed
- Exposed helper functions in order to properly test database calls.

## 5.0.0 - 2021-09-09

### Changed
- **BREAKING**: Updated `bedrock-tokenizer` to `v2.0.0` which nows requires a
  meter to be configured for use with the WebKMS Service.

## 4.0.1 - 2021-07-10

### Fixed
- Remove unused peer dependency:
  - `bedrock-account`

## 4.0.0 - 2021-06-16

### Added
- **BREAKING**: Acquisition records now include `ttl` with a milliseconds since
  the epoch value. This value is used to automatically prune previously
  acquired resources prior to acquiring/releasing new ones. This relative
  value is needed in additional to the `expires` field to perform this
  selective pruning. The `expires` field continues to be used to clean up
  an entire acquisition record (a blunt instrument that runs automatically
  in mongodb after it is known that all resource acquisitions have expired
  vs. `ttl` that runs on demand and is applied granularly).

### Changed
- **BREAKING**: Updated property `expires` in `resource-restriction-acquisition`
  table from seconds since the epoch to a Date Object. The
  `resource-restriction-acquisition` collection MUST be dropped to upgrade.
- **BREAKING**: As this module only tracks acquistions when restrictions apply,
  a new `ttl` value in milliseconds may be returned when applying a restriction
  to enable acquisitions to expire as soon as restrictions would no longer
  apply. If applied restrictions return such a TTL, then it will be used when
  calculating both a single `ttl` that will be used for each acquisition and
  the overall `expires` time for the entire acquisition record. The parameter,
  `acquisitionTtl`, will now be used as a default for any restrictions that do
  not specify a `ttl`.
- **BREAKING**: `release()` no longer requires `acquisitionTtl` to be passed.
  Nothing new is being acquired and the previously stored `ttl` will be used
  to determine the new `expires` for the relevant acquisition record once any
  resources have been released.

## 3.0.0 - 2021-05-06

### Changed
- **BREAKING**: `restrictions.get()` now takes an `id` parameter, instead of
  `zone` and `resource`.
- **BREAKING**: `restrictions.remove()` now takes an `id` parameter, instead of
  `zone` and `resource`.

### Added
- Added `getAll()` and `removeAll()` to `restrictions`.

## 2.0.0 - 2021-03-16

### Added
- **BREAKING**: Ids are now required when inserting restrictions.
- Implement support for multiple and different durations.

## 1.3.1 - 2020-12-10

### Fixed
- Ensure existing record's data is not mutated when applying requests.
- Better handle duplicate `upsert` errors that surfaced from a bug
  that was erroneously mutating existing record data. When existing
  record data does not match during an upsert a duplicate error
  occurs -- this is now treated the same way as a non-matching
  query instead of as a duplicate error.
- Do not `upsert` when releasing resources, only when acquiring.
- Remove old comparison code in the event that no update occurred
  as the update includes setting `meta.updated` which should
  eliminate the case where there was no actual change.

## 1.3.0 - 2020-10-19

### Added
- Improve `DuplicateError` handling in the `bulkInsert` API.

## 1.2.0 - 2020-10-14

### Added
- Implement `bulkInsert()` and `remove()` restrictions operations.

## 1.1.0 - 2020-10-09

### Added
- Improve documentation.

### Changed
- Update peer and test deps.

## 1.0.1 - 2020-10-05

### Changed
- Fix bug with `excessResources` count for release.
- Add assertions that `acquirerId` is a string.

## 1.0.0 - 2020-08-22

### Added
- Added core files.
- See git history for changes.
