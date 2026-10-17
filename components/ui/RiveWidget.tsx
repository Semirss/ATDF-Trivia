"use client";

import { motion, useAnimationFrame, useMotionValue, animate, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Mood = "idle" | "happy" | "thinking";
type Phase = "idle" | "dance" | "wave" | "throw";

function anim(...args: Parameters<typeof animate>) {
  return animate(...args) as unknown as Promise<void>;
}
function wait(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
async function seq(fns: Array<() => Promise<void>>) { for (const fn of fns) await fn(); }

export function RiveWidget({ mood = "idle" }: { mood?: Mood }) {
  /* ── blink ───────────────────────────────────────── */
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    function scheduleBlink() {
      const delay = 2200 + Math.random() * 1800;
      return setTimeout(() => {
        setBlink(true);
        setTimeout(() => { setBlink(false); scheduleBlink(); }, 130);
      }, delay);
    }
    const id = scheduleBlink();
    return () => clearTimeout(id);
  }, []);

  /* ── leg/dance tick ──────────────────────────────── */
  const [tick, setTick] = useState(0);
  const lastTickRef = useRef(0);
  useAnimationFrame((time) => {
    if (time - lastTickRef.current < 40) {
      return;
    }

    lastTickRef.current = time;
    setTick(time);
  });

  /* ── motion values ───────────────────────────────── */
  const y       = useMotionValue(0);
  const bodyRot = useMotionValue(0);
  const headRot = useMotionValue(0);
  
  /* ── question mark motion values ─────────────────── */
  const qX       = useMotionValue(0);
  const qY       = useMotionValue(0);
  const qRot     = useMotionValue(0);
  const qScale   = useMotionValue(0);
  const qOpacity = useMotionValue(0);

  // Magic trail effects using framer-motion springs that follow the main values
  const qX2 = useSpring(qX, { stiffness: 350, damping: 25 });
  const qY2 = useSpring(qY, { stiffness: 350, damping: 25 });
  const qRot2 = useSpring(qRot, { stiffness: 350, damping: 25 });

  const qX3 = useSpring(qX, { stiffness: 200, damping: 22 });
  const qY3 = useSpring(qY, { stiffness: 200, damping: 22 });
  const qRot3 = useSpring(qRot, { stiffness: 200, damping: 22 });

  const [phase, setPhase] = useState<Phase>("idle");

  /* ── main choreography loop ──────────────────────── */
  useEffect(() => {
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        /* ① Idle - look left */
        setPhase("idle");
        await seq([
          () => anim(bodyRot, 0, { duration: 0.4 }),
          () => anim(y, 0, { duration: 0.4 }),
          () => anim(headRot, -18, { duration: 0.5, ease: "easeInOut" }),
        ]);
        await wait(1500 + Math.random() * 1500);
        if (cancelled) break;

        /* ② Idle - look right */
        await anim(headRot, 18, { duration: 0.6, ease: "easeInOut" });
        await wait(1500 + Math.random() * 1500);
        if (cancelled) break;

        /* ③ Idle - look center */
        await anim(headRot, 0, { duration: 0.4, ease: "easeInOut" });
        await wait(1000 + Math.random() * 1000);
        if (cancelled) break;

        /* ④ Wave */
        setPhase("wave");
        await wait(1500);
        if (cancelled) break;

        /* ⑤ Dance */
        setPhase("dance");
        await seq([
          () => anim(bodyRot, 12, { duration: 0.18 }),
          () => anim(bodyRot, -12, { duration: 0.18 }),
          () => anim(bodyRot, 12, { duration: 0.18 }),
          () => anim(bodyRot, -12, { duration: 0.18 }),
          () => anim(bodyRot, 0, { duration: 0.18 }),
        ]);
        await wait(800);
        if (cancelled) break;

        /* ⑥ Throw question mark to the LEFT */
        setPhase("throw");
        
        // 1. Pop up the question mark
        await seq([
          () => anim(qX, 0, { duration: 0 }),
          () => anim(qY, 20, { duration: 0 }), 
          () => anim(qRot, 15, { duration: 0 }),
          () => anim(qScale, 0, { duration: 0 }),
          () => anim(qOpacity, 1, { duration: 0 }),
        ]);

        await Promise.all([
          anim(qScale, 1.3, { type: "spring", stiffness: 300, damping: 15 }),
          anim(qY, -35, { type: "spring", stiffness: 300, damping: 15 }),
          anim(headRot, 15, { duration: 0.2 }), // look right slightly
        ]);
        await wait(600);
        if (cancelled) break;

        // 2. Wind up (lean right, left arm winds back)
        await anim(bodyRot, 16, { duration: 0.3 }); 
        await wait(200);
        if (cancelled) break;

        // 3. Throw left!
        await Promise.all([
          anim(bodyRot, -32, { duration: 0.3, ease: "easeOut" }), // lean left forcefully
          anim(headRot, -25, { duration: 0.3 }),
          // Throw the mark FAR LEFT and UP
          anim(qX, -450, { duration: 0.8, ease: [0.4, 0, 1, 1] }),
          anim(qY, -300, { duration: 0.8, ease: "easeOut" }),
          anim(qRot, -450, { duration: 0.8, ease: "linear" }),
          anim(qOpacity, 0, { duration: 0.8, delay: 0.2 }), // fade out main and trail together
        ]);
        
        await wait(500);
        if (cancelled) break;
        
        // 4. Reset posture
        await Promise.all([
          anim(bodyRot, 0, { duration: 0.4, ease: "easeInOut" }),
          anim(headRot, 0, { duration: 0.4, ease: "easeInOut" })
        ]);
        await wait(1000);
      }
    }

    loop();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── derived visuals ─────────────────────────────── */
  const isDancing  = phase === "dance";
  const isWaving   = phase === "wave";
  const isThrowing = phase === "throw";
  
  const dancePhase = (tick / 1000) * Math.PI * 6; // fast tick for dancing
  const idlePhase  = (tick / 1000) * Math.PI * 1.5; // slow tick for breathing

  const leftLeg   = isDancing ? Math.sin(dancePhase) * 25 : Math.sin(idlePhase) * 4;
  const rightLeg  = isDancing ? Math.sin(dancePhase + Math.PI) * 25 : Math.sin(idlePhase + Math.PI) * 4;
  
  // Left arm winds up and swings during left-throw, waves if waving, swings if dancing
  const leftArm   = isThrowing 
    ? bodyRot.get() * -5 // lean right (16) -> arm back (-80). lean left (-32) -> arm swings forward (160)
    : isWaving ? 0 : (isDancing ? Math.sin(dancePhase + Math.PI) * 35 : Math.sin(idlePhase) * 6);
  
  // Right arm swings if dancing, stays mostly still otherwise
  const rightArm  = isDancing ? Math.sin(dancePhase) * 35 : Math.sin(idlePhase + Math.PI) * 6;

  const eyeColor     = mood === "happy" ? "#69d9b5" : mood === "thinking" ? "#f2b84b" : "#ffffff";
  const mouthW       = mood === "happy" ? 22 : mood === "thinking" ? 10 : 16;
  const mouthH       = mood === "happy" ? 5  : 3;
  const antennaColor = mood === "happy" ? "#69d9b5" : mood === "thinking" ? "#f2b84b" : "#ffffff";

  return (
    <motion.div
      style={{ y, rotate: bodyRot }}
      className="relative flex flex-col items-center select-none cursor-pointer"
    >
      {/* ── Magic trailing question marks ── */}
      <motion.div
        style={{ x: qX3, y: qY3, rotate: qRot3, scale: qScale, opacity: qOpacity }}
        className="absolute top-[-10px] z-30 text-[56px] leading-none font-display font-black text-honey/30 blur-[4px] pointer-events-none"
      >
        ?
      </motion.div>
      <motion.div
        style={{ x: qX2, y: qY2, rotate: qRot2, scale: qScale, opacity: qOpacity }}
        className="absolute top-[-10px] z-40 text-[56px] leading-none font-display font-black text-honey/60 blur-[2px] pointer-events-none"
      >
        ?
      </motion.div>
      <motion.div
        style={{
          x: qX, y: qY, rotate: qRot, scale: qScale, opacity: qOpacity,
          WebkitTextStroke: "2px rgba(255, 255, 255, 0.9)"
        }}
        className="absolute top-[-10px] z-50 text-[56px] leading-none font-display font-black text-honey drop-shadow-md pointer-events-none"
      >
        ?
      </motion.div>

      {/* shadow blob */}
      <motion.div
        className="absolute bottom-[-4px] h-3 w-14 rounded-full bg-black/20 blur-md pointer-events-none"
        animate={{ scaleX: [1, 0.78, 1], opacity: [0.28, 0.12, 0.28] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* body float wrapper */}
      <motion.div
        className="relative flex flex-col items-center"
        animate={isDancing ? { y: [0, -8, 0] } : { y: [0, -4, 0] }}
        transition={{ duration: isDancing ? 0.36 : 1.9, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* antenna */}
        <div className="relative flex flex-col items-center mb-[-2px] z-10">
          <motion.div
            className="h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: antennaColor,
              boxShadow: `0 0 7px 3px ${antennaColor}88`,
            }}
            animate={{ scale: [1, 1.55, 1], opacity: [1, 0.45, 1] }}
            transition={{ duration: 1.0, repeat: Infinity, ease: "easeInOut" }}
          />
          <div className="h-3 w-[2.5px] bg-white/50 rounded-full" />
        </div>

        {/* head */}
        <motion.div
          animate={mood === "thinking" ? { rotate: [-4, 4, -4] } : { rotate: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "bottom center" }}
          className="relative z-20"
        >
          <motion.div
            style={{ rotate: headRot }}
            className="relative flex flex-col items-center justify-center w-[68px] h-[58px] rounded-[18px] bg-gradient-to-b from-[#f2f4f2] to-[#d4d8d4] shadow-engine border border-white/80"
          >
            <div className="absolute -left-[5px] top-[16px] h-5 w-[5px] rounded-l-full bg-[#c4c8c4]" />
            <div className="absolute -right-[5px] top-[16px] h-5 w-[5px] rounded-r-full bg-[#c4c8c4]" />

            {/* visor */}
            <div className="w-[50px] h-[34px] rounded-[10px] bg-[#0f1113] flex flex-col items-center justify-center gap-[5px] shadow-inner">
              <div className="flex gap-3 items-center">
                <motion.div
                  className="rounded-full"
                  animate={{ height: blink ? 1.5 : 10, width: 10 }}
                  style={{ backgroundColor: eyeColor }}
                  transition={{ duration: 0.07 }}
                />
                <motion.div
                  className="rounded-full"
                  animate={{ height: blink ? 1.5 : 10, width: 10 }}
                  style={{ backgroundColor: eyeColor }}
                  transition={{ duration: 0.07 }}
                />
              </div>
              <motion.div
                className="rounded-full bg-white/65"
                animate={{ width: mouthW, height: mouthH }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        </motion.div>

        {/* body + arms */}
        <div className="relative z-10 mt-[-2px] flex items-start">
          {/* left arm — throws left, waves when waving */}
          <motion.div
            className="w-[7px] h-[26px] rounded-full bg-gradient-to-b from-[#dde1dd] to-[#b8bcb8] origin-top mt-1"
            animate={isWaving ? { rotate: [-130, -90, -130] } : { rotate: leftArm }}
            transition={isWaving ? { duration: 0.45, repeat: Infinity, ease: "easeInOut" } : { duration: 0 }}
          />

          {/* torso */}
          <div className="relative w-[50px] h-[42px] rounded-[14px] bg-gradient-to-b from-[#eaeeea] to-[#caced0] border border-white/60 shadow-engine flex flex-col items-center justify-center gap-[5px] px-2">
            <motion.div
              className="w-5 h-[3px] rounded-full"
              animate={{
                backgroundColor:
                  mood === "happy"    ? ["#69d9b5","#f2b84b","#69d9b5"] :
                  mood === "thinking" ? ["#f2b84b","#ff7a45","#f2b84b"] :
                                        ["#ffffff","#9ca3af","#ffffff"],
              }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
            <div className="flex gap-1.5">
              {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-black/22" />)}
            </div>
          </div>

          {/* right arm */}
          <motion.div
            className="w-[7px] h-[26px] rounded-full bg-gradient-to-b from-[#dde1dd] to-[#b8bcb8] origin-top mt-1"
            style={{ rotate: rightArm }}
          />
        </div>

        {/* legs — idle sway or dance */}
        <div className="flex gap-[6px] mt-[-2px] z-10">
          {[leftLeg, rightLeg].map((angle, i) => (
            <div
              key={i}
              className="flex flex-col items-center origin-top"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <div className="w-[9px] h-[18px] rounded-full bg-gradient-to-b from-[#d0d4d0] to-[#b0b4b0]" />
              <div className="w-[13px] h-[6px] rounded-b-full bg-[#9ca09c] -mt-[1px]" />
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}
