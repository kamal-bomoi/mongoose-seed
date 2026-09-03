# Changelog

## [2.1.1] - 2026-09-04

### Fixed

- Custom `generators` for a path now always take precedence over the schema
  `default` and are no longer skipped by `optional_field_probability`.
  Previously a generator on a path with a `default` (including
  `default: null`) was silently ignored.

### Added

- Added `spinner` option to `SeedConfig` to enable or disable ora spinners.

## [2.0.0] - 2026-01-30

### Changed

- **BREAKING**: Removed OpenAI integration.
- **BREAKING**: Dropped support for Mongoose versions < 9. Now requires `mongoose >= 9`.
