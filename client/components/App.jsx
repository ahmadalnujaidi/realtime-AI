import { useEffect, useRef, useState } from "react";
import logo from "/assets/openai-logomark.svg";
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import ThreeAnimation from "./ThreeAnimation";
import * as THREE from "three";
import companyLogo from "./assets/companylogo1.png";
import companyLogo2 from "./assets/companylogo2.png";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);
  const [showEvents, setShowEvents] = useState(false); // New state to control visibility
  const [analyzer, setAnalyzer] = useState(null);

  async function startSession() {
    // 1. Get an ephemeral key
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    // 2. Create a peer connection
    const pc = new RTCPeerConnection();

    // 3. When the remote track arrives:
    pc.ontrack = (e) => {
      // If you still want to hear the audio in the browser:
      audioElement.current = document.createElement("audio");
      audioElement.current.srcObject = e.streams[0];
      audioElement.current.autoplay = true;

      // Create an AudioContext + AnalyserNode
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(e.streams[0]);
      const analyserNode = audioContext.createAnalyser();
      analyserNode.fftSize = 32;

      source.connect(analyserNode);
      setAnalyzer(analyserNode);
    };

    // 4. Add local microphone track
    const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    pc.addTrack(ms.getTracks()[0]);

    // 5. Data channel for sending/receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // 6. Create SDP offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // 7. Send offer to OpenAI Realtime
    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    // 8. Get answer and set remote description
    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    // 9. Keep a ref to the PeerConnection
    peerConnection.current = pc;
  }

  // Stop current session, clean up peer connection and data channel
  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  // Send a message to the model
  function sendClientEvent(message) {
    if (dataChannel) {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error(
        "Failed to send message - no data channel available",
        message,
      );
    }
  }

  // Send a text message to the model
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  // Attach event listeners to the data channel when a new one is created
  useEffect(() => {
    if (dataChannel) {
      // Append new server events to the list
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });

      // Set session active when the data channel is opened
      dataChannel.addEventListener("open", async () => {
        setIsSessionActive(true);
        setEvents([]);

        // Update the session to use a custom voice before any audio is produced.
        const updateEvent = {
          type: "session.update",
          session: {
            voice: "ash", // Choose from: alloy, ash, ballad, coral, echo sage, shimmer, verse
            // You can update additional settings here if desired.
            instructions:
              "You are a tech consultant specializing in artificial intelligence. you may only speak about technology and AI. if the conversation goes off-topic, bring it back to technology.",
          },
        };
        sendClientEvent(updateEvent);

        const prompt = `say the following: "Hello. Marhaba would you like to speak in English? ولا تفضل اننا نتكلم عربي؟"
        Then ask what their name is.`;
        const event = {
          type: "response.create",
          response: {
            input: [],
            instructions: prompt,
          },
        };
        dataChannel.send(JSON.stringify(event));
      });
    }
  }, [dataChannel]);

  return (
    <>
      <nav className="absolute top-0 left-0 right-0 h-24 flex items-center text-2xl bg-transparent">
        <div className="flex items-center gap-4 w-full m-4 pb-2">
          <img style={{ width: "42px" }} src={logo} />
          <img
            src={companyLogo}
            alt="comapny logo"
            style={{ width: "220px", height: "80px", zIndex: "100" }}
          />
        </div>
      </nav>

      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-0 bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <ThreeAnimation analyzer={analyzer} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4 bg-transparent border-0">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              // events={events}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
      </main>
    </>
  );
}
