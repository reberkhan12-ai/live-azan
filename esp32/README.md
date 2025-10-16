# ESP32 Live Azan Device Firmware

This firmware allows your ESP32 device to:
- Connect to WiFi and MQTT broker
- Subscribe to your masjid's azan topic
- Receive and play azan commands
- Report online status to the dashboard
- Support OTA (Over-the-Air) firmware updates

## Setup
1. Edit `main.cpp` and set:
   - `WIFI_SSID` and `WIFI_PASSWORD` to your WiFi credentials
   - `DEVICE_ID` to your unique device ID (as entered in the Momin dashboard)
   - `MASJID_ID` to the masjid you want to subscribe to (as selected in the dashboard)
2. Flash the code to your ESP32 using Arduino IDE or PlatformIO.
3. To update firmware OTA, send an MQTT message with `{ "action": "ota_update" }` to `munova/azan/<MASJID_ID>`.

## MQTT Topics
- Device subscribes to: `munova/azan/<MASJID_ID>`
- Device status published to: `munova/deviceStatus/<DEVICE_ID>`

## OTA Update
- OTA is enabled by default. You can push new firmware using Arduino IDE or PlatformIO when the device is online.
- To trigger OTA from MQTT, send `{ "action": "ota_update" }` to the masjid topic.

## Notes
- Make sure your ESP32 has enough memory for OTA (minimum 1MB flash recommended).
- You can extend the azan playback logic as needed for your hardware.

## Security
- MQTT uses username/password and TLS (setInsecure for demo, use proper CA cert for production).

---

For questions or improvements, see your main project documentation.
