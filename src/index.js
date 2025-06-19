// This file is the entry point using ESM. However, on build. time,
// the script will consist of only one file, and it will run in the context of a Google Sheets document
// using Google Apps Script. Note that async code is not supported. CommonJs ("require")
// or ESM ("import") are not supported either (but are removed by the build process). For similar
// reasons, no dependency should be added, to keep this script as simple as possible.
// As part of the build, everything ends up in a big plain javascript file (out.js).
// That script can be copied into a Google App Script and should run without any change.
// The output script is not minified to it is easier to debug in the Google App Script editor.
import { createEvmTunnelingVolume } from "./evmTunnelVolume";
import { createStakeTvl } from "./stakeTvl";

// This is the main entry point for Google App Script. Do not remove it
// Google App Script needs the declaration only to use it as an entry point
// eslint-disable-next-line no-unused-vars
function updateMetrics() {
  const { addEvmTunnelVolume } = createEvmTunnelingVolume();
  const { addTvlInfo } = createStakeTvl();

  // Update the Stake TVL
  addTvlInfo();
  // Add daily tunnel information from Ethereum
  addEvmTunnelVolume();
}
