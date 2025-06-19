# metrics-utilities

Collection of utility scripts to calculate different metrics for Hemi

## Setup

Before running any scripts, make sure to set up the required environment variables:

```sh
SUBGRAPH_API_KEY=<api_key>
```

## Scripts

### src/stakeTvl.js

This Script takes a snapshot of the Stake TVL and records it on Google Spreadsheets.

- Entry point: `addTvlInfo`

### src/evmTunnelVolume.js

This script records EVM tunnel volume metrics on Google Spreadsheets (daily Inflows and Outflows).

- Entry point: `addEvmTunnelVolume`

## Known issues

### Spreadsheets precision with large token values

There is a known issue when handling large token values (such as those with 18 decimals) in the Spreadsheets integration. Google Sheets uses 64-bit floating point numbers (double), which can lead to precision loss in the last 3 digits of these large values. As this tool is intended for metrics and reporting, this can be considered a rounding issue and does not affect the overall utility of the data.
