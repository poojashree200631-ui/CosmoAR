import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const handLandmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const trailCanvasRef = useRef(null);
  const lastTipsRef = useRef(new Map());
  const lastPlanetAtRef = useRef(new Map());

  const [status, setStatus] = useState("Starting camera...");
  const [tracking, setTracking] = useState(false);

  useEffect(() => {
    let stream = null;
    let stopped = false;

    function getTrailCanvas(width, height) {
      let trail = trailCanvasRef.current;

      if (!trail) {
        trail = document.createElement("canvas");
        trailCanvasRef.current = trail;
      }

      if (trail.width !== width || trail.height !== height) {
        trail.width = width;
        trail.height = height;
        lastTipsRef.current.clear();
      }

      return trail;
    }

    function isOpenHand(landmarks) {
      const fingers = [
        [8, 5],
        [12, 9],
        [16, 13],
        [20, 17],
      ];

      return (
        fingers.filter(([tip, base]) => {
          const dx = landmarks[tip].x - landmarks[base].x;
          const dy = landmarks[tip].y - landmarks[base].y;
          return Math.hypot(dx, dy) > 0.1;
        }).length >= 3
      );
    }

    function drawPaintedStar(ctx, x, y, size, color) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = color;
      ctx.shadowBlur = size * 4;
      ctx.fillStyle = color;

      ctx.beginPath();
      ctx.arc(x, y, size * 0.45, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 0.28, y - size * 0.28);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x + size * 0.28, y + size * 0.28);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size * 0.28, y + size * 0.28);
      ctx.lineTo(x - size, y);
      ctx.lineTo(x - size * 0.28, y - size * 0.28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function drawPaintedPlanet(ctx, x, y, radius, color, ringColor) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = color;
      ctx.shadowBlur = radius * 3;

      const planet = ctx.createRadialGradient(
        x - radius * 0.35,
        y - radius * 0.45,
        radius * 0.08,
        x,
        y,
        radius
      );
      planet.addColorStop(0, "#ffffff");
      planet.addColorStop(0.18, color);
      planet.addColorStop(1, "#312e81");

      ctx.fillStyle = planet;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      // Small crater details make each planet feel illustrated.
      ctx.fillStyle = "rgba(49, 46, 129, 0.38)";
      [[-0.25, 0.16, 0.17], [0.3, -0.12, 0.1], [0.12, 0.34, 0.08]].forEach(
        ([offsetX, offsetY, scale]) => {
          ctx.beginPath();
          ctx.arc(x + offsetX * radius, y + offsetY * radius, radius * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      );

      // Give some planets a Saturn-like ring.
      ctx.strokeStyle = ringColor;
      ctx.lineWidth = Math.max(1.5, radius * 0.16);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.6, radius * 0.48, -0.25, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function paintGalaxyWithFingers(ctx, landmarks, handNumber) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const fingertips = [4, 8, 12, 16, 20];
      const colors = ["#ffffff", "#a78bfa", "#60a5fa", "#f472b6", "#67e8f9"];
      const planetColors = ["#f9a8d4", "#93c5fd", "#c4b5fd", "#fde68a", "#67e8f9"];
      const open = isOpenHand(landmarks);

      fingertips.forEach((tip, index) => {
        const key = `${handNumber}-${tip}`;

        if (!open) {
          lastTipsRef.current.delete(key);
          return;
        }

        const point = landmarks[tip];
        const x = point.x * canvas.width;
        const y = point.y * canvas.height;
        const previous = lastTipsRef.current.get(key);

        if (previous) {
          const distance = Math.hypot(x - previous.x, y - previous.y);
          const steps = Math.min(10, Math.max(1, Math.floor(distance / 7)));

          for (let step = 1; step <= steps; step++) {
            const progress = step / steps;
            drawPaintedStar(
              ctx,
              previous.x + (x - previous.x) * progress + (Math.random() - 0.5) * 5,
              previous.y + (y - previous.y) * progress + (Math.random() - 0.5) * 5,
              2 + Math.random() * 4,
              colors[index]
            );
          }

          // A planet appears only occasionally, so each gesture builds a galaxy.
          const now = performance.now();
          const lastPlanetAt = lastPlanetAtRef.current.get(key) || 0;
          if (distance > 9 && now - lastPlanetAt > 2600 && Math.random() > 0.72) {
            drawPaintedPlanet(
              ctx,
              x + (Math.random() - 0.5) * 22,
              y + (Math.random() - 0.5) * 22,
              9 + Math.random() * 7,
              planetColors[index],
              colors[(index + 2) % colors.length]
            );
            lastPlanetAtRef.current.set(key, now);
          }
        } else {
          drawPaintedStar(ctx, x, y, 5, colors[index]);
        }

        lastTipsRef.current.set(key, { x, y });
      });
    }

    function drawGalaxyStar(ctx, x, y) {
      ctx.save();
      ctx.shadowColor = "#8b5cf6";
      ctx.shadowBlur = 25;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, 22);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.3, "rgba(192,132,252,0.85)");
      gradient.addColorStop(1, "rgba(139,92,246,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawHand(ctx, landmarks) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const height = canvas.height;
      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20],
        [5, 9], [9, 13], [13, 17],
      ];

      ctx.save();
      ctx.strokeStyle = "#a855f7";
      ctx.lineWidth = 4;
      ctx.shadowColor = "#c084fc";
      ctx.shadowBlur = 18;
      connections.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(landmarks[a].x * width, landmarks[a].y * height);
        ctx.lineTo(landmarks[b].x * width, landmarks[b].y * height);
        ctx.stroke();
      });
      ctx.restore();

      landmarks.forEach((point) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(point.x * width, point.y * height, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "#c084fc";
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.restore();
      });

      [4, 8, 12, 16, 20].forEach((index) => {
        drawGalaxyStar(ctx, landmarks[index].x * width, landmarks[index].y * height);
      });
    }

    async function start() {
      try {
        setStatus("📷 Starting camera...");
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not supported by this browser.");
        }

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;

        const video = videoRef.current;
        if (!video) throw new Error("Video element was not found.");
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;

        await new Promise((resolve, reject) => {
          if (video.readyState >= 1) return resolve();
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error("Failed to load camera video."));
        });
        await video.play();
        if (stopped) return;

        setStatus("🧠 Loading hand tracking...");
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        if (stopped) return;

        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        if (stopped) {
          handLandmarker.close();
          return;
        }

        handLandmarkerRef.current = handLandmarker;
        setTracking(true);
        setStatus("🎉 Open your hand and paint stars!");
        detectHands();
      } catch (error) {
        console.error("COSMO AR ERROR:", error);
        setTracking(false);
        setStatus(`❌ ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    function detectHands() {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = handLandmarkerRef.current;
      if (!video || !canvas || !detector || video.readyState < 2) {
        animationRef.current = requestAnimationFrame(detectHands);
        return;
      }

      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext("2d");
      const trailCanvas = getTrailCanvas(canvas.width, canvas.height);
      const trailCtx = trailCanvas.getContext("2d");
      if (!ctx || !trailCtx) {
        animationRef.current = requestAnimationFrame(detectHands);
        return;
      }

      try {
        trailCtx.save();
        trailCtx.globalCompositeOperation = "destination-out";
        trailCtx.fillStyle = "rgba(0, 0, 0, 0.025)";
        trailCtx.fillRect(0, 0, trailCanvas.width, trailCanvas.height);
        trailCtx.restore();

        const results = detector.detectForVideo(video, performance.now());
        if (results?.landmarks?.length) {
          results.landmarks.forEach((landmarks, handNumber) => {
            paintGalaxyWithFingers(trailCtx, landmarks, handNumber);
          });
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(trailCanvas, 0, 0);

        if (results?.landmarks?.length) {
          results.landmarks.forEach((landmarks) => drawHand(ctx, landmarks));
        }
      } catch (error) {
        console.error("HAND DETECTION ERROR:", error);
      }

      animationRef.current = requestAnimationFrame(detectHands);
    }

    start();

    return () => {
      stopped = true;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      stream?.getTracks().forEach((track) => track.stop());
      handLandmarkerRef.current?.close();
      handLandmarkerRef.current = null;
    };
  }, []);

  return (
    <div className="app">
      <div className="stars" />
      <header className="header">
        <div className="logo">🌌</div>
        <div>
          <h1>CosmoAR</h1>
          <p>Hold the universe in your hands</p>
        </div>
      </header>

      <div className={`status ${tracking ? "ready" : ""}`}>
        <span className={`status-dot ${tracking ? "active" : ""}`} />
        {status}
      </div>

      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={canvasRef} />
      </div>

      <div className="instructions">
        <h2>✨ Paint your own galaxy</h2>
        <p>Open your hand and move your fingers through the air.</p>
        <p>Each fingertip paints glowing stars into your galaxy.</p>
        <p>Each fingertip paints glowing stars and occasional planets.</p>
      </div>
    </div>
  );
}

export default App;