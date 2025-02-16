require("dotenv").config();
const express = require("express");
const WebSocket = require("ws");
const axios = require("axios");
const fs = require("fs"); 
 
const app = express();
const port = process.env.PORT || 8181;

// Funktion til at logge til fil
function logToFile(message) {
  const logMessage = `${new Date().toISOString()} - ${message}\n`;
  fs.appendFileSync("/home/LogFiles/server.log", logMessage);
}

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  logToFile(`Server listening at http://localhost:${port}`);
});

// Route til Twilio TwiML XML
app.get("/twiml.xml", (req, res) => {
  logToFile("Received GET request for /twiml.xml");
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
  logToFile("Received POST request for /twiml.xml");
  res.type("text/xml");
  res.send(
    `<Response>
      <Start>
       <Stream url="wss://klinikken-bkghdgakfne5efhn.swedencentral-01.azurewebsites.net/websocket" />

      </Start>
    </Response>`
  );
});

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  console.log("Twilio WebSocket connected");
  logToFile("Twilio WebSocket connected");
  let streamSid = null;
  let elevenWs = null;

  ws.on("message", (message) => {
    try {
      message = JSON.parse(message);
      logToFile(`Received WebSocket message: ${JSON.stringify(message)}`);

      if (message.event === "connected") {
        console.log("Connected to Twilio");
        logToFile("Connected to Twilio");
      } else if (message.event === "start") {
        streamSid = message.start.streamSid;
        console.log("Stream started with SID:", streamSid);
        logToFile(`Stream started with SID: ${streamSid}`);
      } else if (message.event === "media" && message.media && message.media.payload) {
        logToFile(`Media payload received: ${message.media.payload.substring(0, 50)}...`);
        console.log("Media payload received");

        if (!elevenWs || elevenWs.readyState !== WebSocket.OPEN) {
          console.log("Trying to connect to Eleven Labs");
          logToFile("Trying to connect to Eleven Labs");
          elevenWs = new WebSocket("wss://api.elevenlabs.io/v1/text-to-speech/stream");

          elevenWs.on("open", () => {
            console.log("Connected to Eleven Labs");
            logToFile("Connected to Eleven Labs");
          });

          elevenWs.on("message", (data) => {
            try {
              const response = JSON.parse(data);
              const audioPayload =
                response.audio?.chunk || response.audio_event?.audio_base_64 || "";
              if (audioPayload) {
                ws.send(JSON.stringify({ audio: audioPayload }));
                logToFile("Audio payload sent to Twilio");
              }
            } catch (err) {
              console.error("Error processing Eleven Labs message:", err);
              logToFile(`Error processing Eleven Labs message: ${err.message}`);
            }
          });

          elevenWs.on("close", () => {
            console.log("Eleven Labs WebSocket closed");
            logToFile("Eleven Labs WebSocket closed");
          });

          elevenWs.on("error", (err) => {
            console.error("Eleven Labs WebSocket error:", err);
            logToFile(`Eleven Labs WebSocket error: ${err.message}`);
          });
        }

        console.log("Sending to Eleven Labs:", message.media.payload.substring(0, 50));
        logToFile(`Sending to Eleven Labs: ${message.media.payload.substring(0, 50)}`);
        elevenWs.send(JSON.stringify({ text: message.media.payload }));
      }
    } catch (err) {
      console.error("Error processing Twilio message:", err);
      logToFile(`Error processing Twilio message: ${err.message}`);
    }
  });

  ws.on("close", () => {
    console.log("Connection closed by Twilio");
    logToFile("Connection closed by Twilio");
    if (elevenWs?.readyState === WebSocket.OPEN) elevenWs.close();
    ws.terminate();
  });
});
