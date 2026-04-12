# Dashboard data sources

The dashboard controller is a thin aggregator: it calls `runAll(profile)` from
`sourceRegistry.ts` and returns the result as-is. Each source is an independent
`CommuteDataSource` (see `dataSource.ts`) with its own `fetch(profile)` and
timeout. A failure in one source never affects another.

## Response envelope

Every source ends up in `DashboardResponse.sources` as a `SourceResult`:

```ts
{ status: 'ok', data: <source-specific payload> }
// or
{ status: 'error', error: '<message>' }
```

## Key-naming convention

Keys are `<domain>.<role>` strings. Current keys:

| Key                        | Payload                                    |
| -------------------------- | ------------------------------------------ |
| `rail.outbound`            | `{ services: TrainService[], messages }`   |
| `rail.return`              | `{ services: TrainService[], messages }`   |
| `weather.outboundOrigin`   | `WeatherSummary`                           |
| `weather.destination`      | `WeatherSummary`                           |
| `weather.returnDestination`| `WeatherSummary`                           |
| `tfl`                      | `TflLineSummary[]` (omitted if not configured) |

## Adding a source

1. Add a `CommuteDataSource` entry in `buildSources()` with a unique key.
2. Mirror the payload type in `frontend/src/api/types.ts` if the UI needs it.
3. Render it in `DashboardPage` by reading `sources['your.key']`.
