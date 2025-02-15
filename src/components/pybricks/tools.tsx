/// <reference types="@types/web-bluetooth" />

export async function connectToSpike(): Promise<BluetoothRemoteGATTServer | null> {
  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['battery_service', '00001623-1212-efde-1623-785feabcd123'] // PyBricks LEGO Hub Service
    });

    const server = await device.gatt?.connect();
    if (!server) throw new Error('Failed to connect to GATT server');

    console.log('Connected to Spike');
    return server;
  } catch (error) {
    console.error('Error connecting to Spike:', error);
    return null;
  }
}

export async function sendCodeToSpike(server: BluetoothRemoteGATTServer, code: string) {
    try {
      const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
      const txCharacteristic = await service.getCharacteristic('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
  
      // Convert the Python code string to a Uint8Array
      const encoder = new TextEncoder();
      const commandBytes = encoder.encode(code + '\r'); // Ensure newline for execution
  
      // Send the code
      await txCharacteristic.writeValue(commandBytes);
      console.log('Code sent to Spike');
    } catch (error) {
      console.error('Error sending code:', error);
    }
}

export async function readResponseFromSpike(server: BluetoothRemoteGATTServer) {
    try {
      const service = await server.getPrimaryService('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
      const rxCharacteristic = await service.getCharacteristic('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
  
      await rxCharacteristic.startNotifications();
      rxCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
        const decoder = new TextDecoder();
        const value = decoder.decode((event.target as BluetoothRemoteGATTCharacteristic).value);
        console.log('Received:', value);
      });
  
      console.log('Listening for responses...');
    } catch (error) {
      console.error('Error reading response:', error);
    }
}
  