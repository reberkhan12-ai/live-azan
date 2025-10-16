// ESP32 Live Azan Device Firmware
// Features: MQTT subscribe to masjid topic, OTA update, device ID config
// Dependencies: WiFi, PubSubClient, ArduinoOTA

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoOTA.h>

// --- CONFIG ---
#define WIFI_SSID     "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define MQTT_SERVER   "a0ab9898f49a43919aca936d7105d6d6.s1.eu.hivemq.cloud"
#define MQTT_PORT     8884
#define MQTT_USER     "liveazan"
#define MQTT_PASS     "Munoza@#$123"
#define DEVICE_ID     "YOUR_DEVICE_ID" // Set this to match your dashboard
#define MASJID_ID     "YOUR_MASJID_ID" // Set this to match your dashboard

WiFiClientSecure espClient;
PubSubClient client(espClient);

void setup_wifi() {
  delay(10);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
}

void mqtt_callback(char* topic, byte* payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  if (String(topic) == "munova/azan/" + String(MASJID_ID)) {
    if (msg.indexOf("start") >= 0) {
      // Play Azan (implement your audio logic here)
      // ...
    }
    if (msg.indexOf("ota_update") >= 0) {
      // Trigger OTA update
      ArduinoOTA.handle();
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect(DEVICE_ID, MQTT_USER, MQTT_PASS)) {
      client.subscribe(("munova/azan/" + String(MASJID_ID)).c_str());
      client.publish(("munova/deviceStatus/" + String(DEVICE_ID)).c_str(), "online");
    } else {
      delay(5000);
    }
  }
}

void setup_ota() {
  ArduinoOTA.setHostname(DEVICE_ID);
  ArduinoOTA.onStart([]() {
    // OTA start
  });
  ArduinoOTA.onEnd([]() {
    // OTA end
  });
  ArduinoOTA.onError([](ota_error_t error) {
    // OTA error
  });
  ArduinoOTA.begin();
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  espClient.setInsecure();
  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(mqtt_callback);
  setup_ota();
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();
  ArduinoOTA.handle();
}
