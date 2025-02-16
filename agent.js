require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");

const app = express();
const port = process.env.PORT || 8080;

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`); 
});

// Route til Twilio TwiML XML
app.get("/twiml.xml", (req, res) => {
  res.type("text/xml");
  res.send(
    `<Response>
      <Start>
        <Stream url="wss://klinikken-bkghdgakfne5efhn.swedencentral-01.azurewebsites.net/websocket" />
      </Start>
    </Response>`
  );
});

app.post("/twiml.xml", (req, res) => {
  res.type("text/xml");
  res.send(
    `<Response>
      <Start>
        <Stream url="wss://klinikken-bkghdgakfne5efhn.swedencentral-01.azurewebsites.net/websocket" />
      </Start>
    </Response>`
  );
});  // 🔹 **LUKKER `app.post("/twiml.xml")` korrekt**

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Twilio WebSocket connected");
  let streamSid = null;
  let elevenWs = null;

  ws.on("message", (message) => {
    try {
      message = JSON.parse(message);

      if (message.event === "connected") {
        console.log("Connected to Twilio");
      } else if (message.event === "start") {
        streamSid = message.start.streamSid;
        console.log("Stream started with SID:", streamSid);
      } else if (message.event === "media" && message.media && message.media.payload) {
        if (!elevenWs || elevenWs.readyState !== WebSocket.OPEN) {
          elevenWs = new WebSocket("wss://api.elevenlabs.io/v1/text-to-speech/stream");

          elevenWs.on("open", () => {
            console.log("Connected to Eleven Labs");
          });

          elevenWs.on("message", (data) => {
            try {
              const response = JSON.parse(data);
              const audioPayload =
                response.audio?.chunk || response.audio_event?.audio_base_64 || "";
              if (audioPayload) {
                ws.send(JSON.stringify({ audio: audioPayload }));
              }
            } catch (err) {
              console.error("Error processing Eleven Labs message:", err);
            }
          });

          elevenWs.on("close", () => {
            console.log("Eleven Labs WebSocket closed");
          });

          elevenWs.on("error", (err) => {
            console.error("Eleven Labs WebSocket error:", err);
          });
        }

        elevenWs.send(JSON.stringify({ text: message.media.payload }));
      }
    } catch (err) {
      console.error("Error processing Twilio message:", err);
    }
  });

  ws.on("close", () => {
    console.log("Connection closed by Twilio");
    if (elevenWs?.readyState === WebSocket.OPEN) elevenWs.close();
    ws.terminate();
  });
});
