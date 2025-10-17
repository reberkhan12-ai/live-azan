// ESP32 WebSocket PCM Player for MAX98357A (I2S)
// Connects to WiFi, registers to the server, receives Int16 LE PCM frames over WebSocket,
// buffers a small jitter buffer (2-3 chunks), and plays via I2S to the MAX98357A DAC.

#include <WiFi.h>
#include <ArduinoWebsockets.h>
#include "driver/i2s.h"
#include <ArduinoJson.h>

// --------- CONFIG ---------
// Replace with your WiFi credentials
const char* WIFI_SSID = "YOUR_SSID";
const char* WIFI_PASS = "YOUR_PASSWORD";

// Server WebSocket URL (use ws:// for local dev, wss:// for TLS)
// From user: https://redesigned-barnacle-x5gxrwwq76prhpvpj-5000.app.github.dev
// We will open ws://<host>/ (server expects ws on same host port 5000). If you run server with TLS,
// change to wss:// and ensure certificate handling.
const char* WS_HOST = "redesigned-barnacle-x5gxrwwq76prhpvpj-5000.app.github.dev";
const uint16_t WS_PORT = 5000; // adjust if your server uses a different port
const char* WS_PATH = "/"; // base path for websockets

// Device registration info
const char* MASJID_ID = "test-masjid-1"; // set to your masjidId
const char* DEVICE_ID = "esp32-devkit-1"; // unique per device
const char* AUTH_KEY = ""; // optional shared key if server expects it

// Audio parameters (must match sender)
const int SAMPLE_RATE = 16000; // Hz (frontend sends 16kHz Int16 LE)
const i2s_bits_per_sample_t I2S_BITS = I2S_BITS_PER_SAMPLE_16BIT;
const i2s_channel_t I2S_CHANNEL_FMT = I2S_CHANNEL_FMT_RIGHT_LEFT; // stereo frame expected by I2S driver

// I2S pins for ESP32 DevKit; these work with many boards and MAX98357A
const int I2S_WS = 25;   // LRCLK (word select)
const int I2S_BCK = 26;  // BCLK (bit clock)
const int I2S_DOUT = 22; // DIN -> DATA OUT to DAC

// Jitter buffer config
const int CHUNK_MS = 100; // expected chunk duration in ms (frontend uses 100ms)
const int CHUNK_SAMPLES = (SAMPLE_RATE * CHUNK_MS) / 1000; // e.g., 1600 samples
const int BYTES_PER_SAMPLE = 2; // Int16
const int CHUNK_BYTES = CHUNK_SAMPLES * BYTES_PER_SAMPLE; // e.g., 3200 bytes
const int JITTER_BUFFER_SLOTS = 4; // store up to 4 chunks (2-3 recommended)

// Websocket client
static websockets::WebsocketsClient wsClient;

// Jitter buffer (simple circular FIFO of byte arrays)
uint8_t* jitterBuffer[JITTER_BUFFER_SLOTS];
volatile int jb_head = 0; // index to push next
volatile int jb_tail = 0; // index to pop next
volatile int jb_count = 0;
portMUX_TYPE jbMux = portMUX_INITIALIZER_UNLOCKED;

// I2S configuration handle
void i2s_init_player() {
  i2s_config_t i2s_config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS,
    .channel_format = I2S_CHANNEL_FMT, // stereo
    .communication_format = I2S_COMM_FORMAT_I2S_MSB,
    .intr_alloc_flags = 0, // default interrupt priority
    .dma_buf_count = 8,
    .dma_buf_len = 512, // buffer length in samples
    .use_apll = false
  };

  i2s_pin_config_t pin_config = {
    .bck_io_num = I2S_BCK,
    .ws_io_num = I2S_WS,
    .data_out_num = I2S_DOUT,
    .data_in_num = -1 // not used
  };

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_set_clk(I2S_NUM_0, SAMPLE_RATE, I2S_BITS_PER_SAMPLE_16BIT, I2S_CHANNEL_STEREO);
}

// Push PCM chunk into jitter buffer (caller takes ownership of buf)
void jb_push(uint8_t* buf) {
  portENTER_CRITICAL(&jbMux);
  if (jb_count < JITTER_BUFFER_SLOTS) {
    jitterBuffer[jb_head] = buf;
    jb_head = (jb_head + 1) % JITTER_BUFFER_SLOTS;
    jb_count++;
  } else {
    // buffer full: drop oldest and push new
    free(jitterBuffer[jb_tail]);
    jitterBuffer[jb_tail] = buf;
    jb_tail = (jb_tail + 1) % JITTER_BUFFER_SLOTS;
    jb_head = (jb_tail + jb_count) % JITTER_BUFFER_SLOTS;
  }
  portEXIT_CRITICAL(&jbMux);
}

// Pop next chunk from jitter buffer; returns pointer or NULL
uint8_t* jb_pop() {
  uint8_t* buf = NULL;
  portENTER_CRITICAL(&jbMux);
  if (jb_count > 0) {
    buf = jitterBuffer[jb_tail];
    jitterBuffer[jb_tail] = NULL;
    jb_tail = (jb_tail + 1) % JITTER_BUFFER_SLOTS;
    jb_count--;
  }
  portEXIT_CRITICAL(&jbMux);
  return buf;
}

// WS message handlers
void onMessageCallback(websockets::WebsocketsMessage message) {
  if (message.isBinary()) {
    // Received binary PCM frame (Int16 LE). Copy to heap and push to jitter buffer.
    size_t len = message.length();
    // Ignore frames that are not expected size, but allow partials (some servers may split)
    if (len == 0) return;

    uint8_t* buf = (uint8_t*)malloc(len);
    if (!buf) return;
    memcpy(buf, message.raw(), len);
    jb_push(buf);
  } else {
    // Handle JSON text messages (presence etc) if needed
    String txt = message.toString();
    Serial.printf("WS Text: %s\n", txt.c_str());
  }
}

void onEventCallback(websockets::WebsocketsEvent event, String data) {
  switch (event) {
    case websockets::WebsocketsEvent::ConnectionOpened:
      Serial.println("WS: Connected");
      // After connect, register device
      {
        DynamicJsonDocument doc(256);
        doc["type"] = "register";
        doc["masjidId"] = MASJID_ID;
        doc["deviceId"] = DEVICE_ID;
        if (strlen(AUTH_KEY) > 0) doc["key"] = AUTH_KEY;
        String out;
        serializeJson(doc, out);
        wsClient.send(out);
      }
      break;

    case websockets::WebsocketsEvent::ConnectionClosed:
      Serial.println("WS: Disconnected");
      break;

    case websockets::WebsocketsEvent::GotPing:
      Serial.println("WS: Ping");
      break;

    case websockets::WebsocketsEvent::GotPong:
      Serial.println("WS: Pong");
      break;

    default:
      break;
  }
}

// Background task: feed I2S with data from jitter buffer
void i2s_play_task(void* param) {
  (void)param;
  // To play stereo, we will duplicate mono samples into left/right
  while (true) {
    uint8_t* chunk = jb_pop();
    if (!chunk) {
      // no data: sleep briefly
      vTaskDelay(pdMS_TO_TICKS(5));
      continue;
    }

    size_t bytesToWrite = CHUNK_BYTES;
    // If received chunk size differs, adapt: write min(len, CHUNK_BYTES)
    // We assume sender sends full CHUNK_BYTES; otherwise write what we have.

    // For I2S stereo, we need to convert interleaved LR samples. Our data is mono Int16 LE.
    // We'll produce a stereo buffer by duplicating each sample to left and right (LRLR...)
    int samples = bytesToWrite / 2; // number of Int16 samples
    int stereoSamples = samples * 2; // left+right per mono sample
    int stereoBytes = stereoSamples * 2; // Int16

    uint8_t* stereoBuf = (uint8_t*)malloc(stereoBytes);
    if (!stereoBuf) {
      free(chunk);
      continue;
    }

    // Duplicate
    for (int i = 0; i < samples; ++i) {
      // little-endian sample
      stereoBuf[i * 4 + 0] = chunk[i * 2 + 0];
      stereoBuf[i * 4 + 1] = chunk[i * 2 + 1];
      stereoBuf[i * 4 + 2] = chunk[i * 2 + 0];
      stereoBuf[i * 4 + 3] = chunk[i * 2 + 1];
    }

    free(chunk);

    size_t written = 0;
    esp_err_t res = i2s_write(I2S_NUM_0, stereoBuf, stereoBytes, &written, portMAX_DELAY);
    if (res != ESP_OK) {
      Serial.printf("i2s_write error: %d\n", res);
    }
    free(stereoBuf);
  }
}


void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("ESP32 PCM WebSocket Player starting...");

  // allocate jitter buffer slots
  for (int i = 0; i < JITTER_BUFFER_SLOTS; ++i) {
    jitterBuffer[i] = NULL;
  }

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.printf("Connecting to WiFi '%s'...\n", WIFI_SSID);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print('.');
    attempts++;
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Failed to connect to WiFi");
    // continue anyway to allow offline testing
  } else {
    Serial.printf("WiFi connected, IP: %s\n", WiFi.localIP().toString().c_str());
  }

  i2s_init_player();

  // Start I2S play task
  xTaskCreatePinnedToCore(i2s_play_task, "i2s_play_task", 4096, NULL, 1, NULL, 1);

  // Setup websocket client
  String wsUrl = String("ws://") + WS_HOST + ":" + String(WS_PORT) + String(WS_PATH);
  Serial.printf("Connecting to WS: %s\n", wsUrl.c_str());

  wsClient.onMessage(onMessageCallback);
  wsClient.onEvent(onEventCallback);

  // connect (non-blocking connect with retries)
  bool connected = false;
  for (int i = 0; i < 5; ++i) {
    if (wsClient.connect(wsUrl)) {
      connected = true;
      break;
    }
    Serial.println("WS connect failed, retrying...");
    delay(1000);
  }

  if (!connected) {
    Serial.println("Failed to open WebSocket connection");
  }
}

void loop() {
  // Maintain WS connection; client needs to poll
  wsClient.poll();
  delay(10);
}
