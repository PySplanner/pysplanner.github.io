/// <reference types="@types/web-bluetooth" />
export async function connectToSpike(): Promise<BluetoothRemoteGATTServer | null> {
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true, // Allow selecting any BLE device
      optionalServices: ['battery_service', '00001623-1212-efde-1623-785feabcd123'] // PyBricks LEGO Hub Service
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Failed to connect to GATT server');

    console.log('Connected to Spike PRIME');
    return server;
  } catch (error) {
    console.error('Error connecting to Spike PRIME:', error);
    return null;
  }
}