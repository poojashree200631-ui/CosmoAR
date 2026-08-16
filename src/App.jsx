import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
} from "@mediapipe/tasks-vision";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const animationRef = useRef(null);

  const [status, setStatus] = useState("Starting camera...");
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    let stream = null;
    let stopped = false;

    async function start() {
      try {
        // =========================
        // 1. CAMERA
        // =========================

        setStatus("📷 Starting camera...");

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            "Camera is not supported by this browser."
          );
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (stopped) return;

        const video = videoRef.current;

        if (!video) {
          throw new Error("Video element was not found.");
        }

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        await new Promise((resolve, reject) => {
          if (video.readyState >= 1) {
            resolve();
            return;
          }

          video.onloadedmetadata = resolve;
          video.onerror = () =>
            reject(new Error("Failed to load camera video."));
        });

        await video.play();

        if (stopped) return;

        setStatus("📷 Camera working ✓");

        // =========================
        // 2. MEDIAPIPE VISION
        // =========================

        setStatus("🧠 Loading hand tracking...");

        const vision = await FilesetResolver.forVisionTasks("/wasm");
      

        if (stopped) return;

        setStatus("🧠 MediaPipe loaded ✓");

        // =========================
        // 3. HAND LANDMARKER
        // =========================

        const handLandmarker =
          await HandLandmarker.createFromOptions(
            vision,
            {
              baseOptions: {
                modelAssetPath:
                  "/models/hand_landmarker.task",
                delegate: "CPU",
              },

              runningMode: "VIDEO",

              numHands: 2,

              minHandDetectionConfidence: 0.5,
              minHandPresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            }
          );

        if (stopped) {
          handLandmarker.close();
          return;
        }

        handLandmarkerRef.current = handLandmarker;

        setTracking(true);
        setStatus("🎉 HAND TRACKING READY!");

        detectHands();
      } catch (error) {
        console.error("=================================");
        console.error("COSMO AR ERROR");
        console.error("=================================");
        console.error(error);
        console.error("Type:", typeof error);
        console.error("Name:", error?.name);
        console.error("Message:", error?.message);
        console.error("Stack:", error?.stack);
        console.error("=================================");

        setTracking(false);

        let message = "Unknown error";

        if (error instanceof Error) {
          message = `${error.name}: ${
            error.message || "No error message"
          }`;
        } else if (
          error &&
          typeof error === "object"
        ) {
          if (error.message) {
            message = String(error.message);
          } else if (error.type) {
            message = String(error.type);
          } else if (error.name) {
            message = String(error.name);
          } else {
            try {
              message = JSON.stringify(error);
            } catch {
              message = "An unknown object error occurred.";
            }
          }
        } else {
          message = String(error);
        }

        setStatus(`❌ ${message}`);
      }
    }

    // =========================
    // HAND DETECTION
    // =========================

    function detectHands() {
      if (stopped) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = handLandmarkerRef.current;

      if (!video || !canvas || !detector) {
        animationRef.current =
          requestAnimationFrame(detectHands);
        return;
      }

      if (
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        animationRef.current =
          requestAnimationFrame(detectHands);
        return;
      }

      // Keep canvas matched to video
      if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
      ) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        animationRef.current =
          requestAnimationFrame(detectHands);
        return;
      }

      try {
        const now = performance.now();

        const results = detector.detectForVideo(
          video,
          now
        );

        ctx.clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );

        if (
          results &&
          results.landmarks &&
          results.landmarks.length > 0
        ) {
          for (const landmarks of results.landmarks) {
            drawHand(ctx, landmarks);
          }
        }
      } catch (error) {
        console.error(
          "HAND DETECTION ERROR:",
          error
        );
      }

      animationRef.current =
        requestAnimationFrame(detectHands);
    }

    // =========================
    // DRAW GALAXY HAND
    // =========================

    function drawHand(ctx, landmarks) {
      const canvas = canvasRef.current;

      if (!canvas) return;

      const width = canvas.width;
      const height = canvas.height;

      const connections = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],

        [0, 5],
        [5, 6],
        [6, 7],
        [7, 8],

        [0, 9],
        [9, 10],
        [10, 11],
        [11, 12],

        [0, 13],
        [13, 14],
        [14, 15],
        [15, 16],

        [0, 17],
        [17, 18],
        [18, 19],
        [19, 20],

        [5, 9],
        [9, 13],
        [13, 17],
      ];

      // =========================
      // GALAXY HAND LINES
      // =========================

      ctx.save();

      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 18;

      for (const [a, b] of connections) {
        const p1 = landmarks[a];
        const p2 = landmarks[b];

        if (!p1 || !p2) continue;

        ctx.beginPath();

        ctx.moveTo(
          p1.x * width,
          p1.y * height
        );

        ctx.lineTo(
          p2.x * width,
          p2.y * height
        );

        ctx.stroke();
      }

      ctx.restore();

      // =========================
      // HAND JOINTS
      // =========================

      for (const point of landmarks) {
        const x = point.x * width;
        const y = point.y * height;

        ctx.save();

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          5,
          0,
          Math.PI * 2
        );

        ctx.fillStyle = "#ffffff";

        ctx.shadowColor = "#c084fc";
        ctx.shadowBlur = 20;

        ctx.fill();

        ctx.restore();
      }

      // =========================
      // FINGERTIP STARS
      // =========================

      const fingertips = [
        4,
        8,
        12,
        16,
        20,
      ];

      for (const index of fingertips) {
        const point = landmarks[index];

        if (!point) continue;

        const x = point.x * width;
        const y = point.y * height;

        drawGalaxyStar(
          ctx,
          x,
          y
        );
      }
    }

    // =========================
    // GALAXY STAR
    // =========================

    function drawGalaxyStar(ctx, x, y) {
      ctx.save();

      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 35;

      // Glow
      const gradient =
        ctx.createRadialGradient(
          x,
          y,
          0,
          x,
          y,
          30
        );

      gradient.addColorStop(
        0,
        "rgba(255,255,255,1)"
      );

      gradient.addColorStop(
        0.3,
        "rgba(192,132,252,0.9)"
      );

      gradient.addColorStop(
        1,
        "rgba(139,92,246,0)"
      );

      ctx.fillStyle = gradient;

      ctx.beginPath();

      ctx.arc(
        x,
        y,
        30,
        0,
        Math.PI * 2
      );

      ctx.fill();

      // =========================
      // STAR SHAPE
      // =========================

      ctx.fillStyle = "#ffffff";

      ctx.beginPath();

      ctx.moveTo(
        x,
        y - 13
      );

      ctx.lineTo(
        x + 4,
        y - 4
      );

      ctx.lineTo(
        x + 13,
        y
      );

      ctx.lineTo(
        x + 4,
        y + 4
      );

      ctx.lineTo(
        x,
        y + 13
      );

      ctx.lineTo(
        x - 4,
        y + 4
      );

      ctx.lineTo(
        x - 13,
        y
      );

      ctx.lineTo(
        x - 4,
        y - 4
      );

      ctx.closePath();

      ctx.fill();

      ctx.restore();
    }

    // =========================
    // START
    // =========================

    start();

    // =========================
    // CLEANUP
    // =========================

    return () => {
      stopped = true;

      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current
        );
      }

      if (stream) {
        stream
          .getTracks()
          .forEach((track) => track.stop());
      }

      if (handLandmarkerRef.current) {
        try {
          handLandmarkerRef.current.close();
        } catch (error) {
          console.warn(
            "Could not close HandLandmarker:",
            error
          );
        }

        handLandmarkerRef.current = null;
      }
    };
  }, []);

  return (
    <div className="app">
      <div className="stars"></div>

      {/* =========================
          HEADER
      ========================= */}

      <header className="header">
        <div className="logo">
          🌌
        </div>

        <div>
          <h1>CosmoAR</h1>

          <p>
            Hold the universe in your hands
          </p>
        </div>
      </header>

      {/* =========================
          STATUS
      ========================= */}

      <div
        className={`status ${
          tracking ? "ready" : ""
        }`}
      >
        <span
          className={`status-dot ${
            tracking ? "active" : ""
          }`}
        ></span>

        {status}
      </div>

      {/* =========================
          CAMERA
      ========================= */}

      <div className="camera-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
        />

        <canvas
          ref={canvasRef}
        />
      </div>

      {/* =========================
          INSTRUCTIONS
      ========================= */}

      <div className="instructions">
        <h2>
          ✨ Your galaxy is waiting
        </h2>

        <p>
          Show your hand to the camera.
        </p>

        <p>
          Your fingertips will glow like
          stars when detected.
        </p>
      </div>
    </div>
  );
}

export default App;