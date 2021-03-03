# bedrock-resource-restriction ChangeLog

## 2.0.0 - 2021-03-xx

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
