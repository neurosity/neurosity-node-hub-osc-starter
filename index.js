const noble = require("@stoprocent/noble");
const osc = require("osc");

let deviceRSSIHistory = {};

// Set up an OSC UDP port listening on port 9000
const udpPort = new osc.UDPPort({
  localAddress: "0.0.0.0",
  localPort: 9000,
});
const fs = require('fs');

udpPort.on("message", (oscMessage) => {
  // console.log("Received OSC message:", oscMessage);
  fs.appendFileSync('osc_messages.log', JSON.stringify(oscMessage) + '\n');
});

udpPort.open();

function calculateSlope(rssiValues) {
  if (rssiValues.length < 2) return 0;
  const [rssi1, rssi2, rssi3] = rssiValues.slice(-3);
  return (rssi3 - rssi1) / 2; // Simple slope calculation
}

function printDeviceInfo() {
  const sortedDevices = Object.entries(deviceRSSIHistory).sort(
    ([_, a], [__, b]) =>
      b.rssiValues[b.rssiValues.length - 1] -
      a.rssiValues[a.rssiValues.length - 1]
  );

  console.clear(); // Clear the console for a fresh display
  sortedDevices.forEach(([localName, { rssiValues }]) => {
    const currentRSSI = rssiValues[rssiValues.length - 1];
    const slope = calculateSlope(rssiValues);
    const stars = "*".repeat(
      Math.max(0, Math.floor((currentRSSI + 100) / 2.5))
    ); // Convert RSSI to stars
    console.log(`Device: ${localName}`);
    console.log(`Current RSSI: ${currentRSSI} ${stars}`);
    console.log(`Last 3 RSSI: ${rssiValues.slice(-3).join(", ")}`);
    console.log(`Slope: ${slope > 0 ? "Positive" : "Negative"} (${slope})`);
  });
}

noble.on("stateChange", async (state) => {
  if (state === "poweredOn") {
    setInterval(async () => {
      await noble.startScanningAsync([], false);
      console.log("Scanning for devices...");
      setTimeout(async () => {
        await noble.stopScanningAsync();
      }, 5000); // Scan for 5 seconds
    }, 10000); // Repeat every 10 seconds

    setInterval(printDeviceInfo, 1000); // Print device info every second
  } else {
    await noble.stopScanningAsync();
  }
});

noble.on("discover", (peripheral) => {
  const localName = peripheral.advertisement.localName;
  if (localName && localName.startsWith("Crown-")) {
    if (!deviceRSSIHistory[localName]) {
      deviceRSSIHistory[localName] = { rssiValues: [] };
    }
    const rssiValues = deviceRSSIHistory[localName].rssiValues;
    rssiValues.push(peripheral.rssi);
    if (rssiValues.length > 3) {
      rssiValues.shift(); // Keep only the last 3 RSSI values
    }
  }
});
