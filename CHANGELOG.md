# bedrock-resource-restriction ChangeLog

## 16.0.0 - 2025-03-xx

### Changed
- **BREAKING**: Require Node.js >=20.
- Update dependencies.
  - `moment@2.30.1`.
- Update peer dependencies.
  - `@bedrock/core@6.3.0`.
  - `@bedrock/https-agent@4.1.0`.
  - `@bedrock/jsonld-document-loader@5.2.0`.
  - **BREAKING**: `@bedrock/mongodb@11`.
    - Use MongoDB driver 6.x and update error names and details.
    - See changelog for details.
  - **BREAKING**: `@bedrock/tokenizer@11`.
    - Updated for `@bedrock/mongodb@11`.
- Update dev dependencies.
- Update test dependencies.

## 15.1.2 - 2025-03-05

### Fixed
- Return passed `records` instead of `result.ops` resulting from bulk
  write mongodb calls to enable using newer mongodb driver.

## 15.1.1 - 2025-03-04

### Fixed
- Return passed `record` instead of resulting record from mongodb calls to
  enable using newer mongodb driver.
- Use `result.modifiedCount`, etc. to enable newer mongodb driver.
- Remove unused `background` option from mongodb index creation.

## 15.1.0 - 2025-02-25

### Added
- Add two new features for restrictions to use:
  - Restriction functions will now receive `getAcquisitionMap({resourceIds})`
    to enable requesting specific, well-known (to the restriction
    implementation), and previously acquired resources that might
    not be in the current acquisition request but are relevant to it.
  - Restriction functions can now return an optional `trackedResources` array
    that, if present, must specify all the resources in the request that are
    to be tracked (this must include the resource that triggered the
    restriction if that is desirable, otherwise it will not be tracked). If
    this feature is not used, `trackedResources` will default to an array
    containing only the resource that triggered the restriction, as was
    done in previous versions.

## 15.0.0 - 2023-09-25

### Changed
- **BREAKING**: Update peer deps:
  - Use `@bedrock/jsonld-document-loader@4`. This version requires Node.js 18+.
  - Use `@bedrock/tokenizer@10`. This version requires Node.js 18+.

## 14.0.0 - 2023-08-30

### Changed
- **BREAKING**: Drop support for Node.js 16.

### Removed
- Remove usage of deprecated `database.writeOptions`.

## 13.0.0 - 2023-05-25

### Changed
- **BREAKING**: Update `getAll()` API to take `query` param instead of `zone`
  and `resource`.
- **BREAKING**: Update the return value of restrictions `getAll()` API to
  include propertes `records`, `limit`, `offset`, and `count`.
- **BREAKING**: Paginate results of restrictions `getAll()` API using `skip()`
  and `limit()` methods. If no `limit` and `offset` params are specified in
  `getAll()`, then default values 10 and 0 will be used respectively.

## 12.1.1 - 2023-01-15

### Fixed
- Do not modify internal structure of acquisition `record` once
  returned to convert `expires` into ms since the epoch.

## 12.1.0 - 2022-08-12

### Added
- Add optional `now` parameters to acquire/release/check API to assist
  in unit testing.

### Fixed
- Fix max restriction TTL calculation, ensuring that acquired resources
  will be tracked for the longest applicable TTL.

## 12.0.0 - 2022-08-04

### Changed
- **BREAKING**: Require node 16.x.
- **BREAKING**: Update peer deps:
  - `@bedrock/tokenizer@9`.

## 11.1.0 - 2022-07-08

### Added
- Add backwards-compatible `sequence` value to acquisition records for
  better optimized change tracking.

## 11.0.0 - 2022-04-29

### Changed
- **BREAKING**: Update peer deps:
  - `@bedrock/core@6`
  - `@bedrock/https-agent@4`
  - `@bedrock/jsonld-document-loader@3`
  - `@bedrock/mongodb@10`
  - `@bedrock/tokenizer@8`.

## 10.0.0 - 2022-04-21

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
