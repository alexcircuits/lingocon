import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "LingoCon — The free platform for conlang creators"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
          fontFamily: "system-ui, sans-serif",
          color: "white",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-120px",
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            left: "-100px",
            width: "340px",
            height: "340px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              borderRadius: "18px",
              background: "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "44px",
              fontWeight: 800,
            }}
          >
            L
          </div>
          <div
            style={{
              fontSize: "56px",
              fontWeight: 800,
              letterSpacing: "-2px",
              display: "flex",
            }}
          >
            LingoCon
          </div>
        </div>

        <div
          style={{
            fontSize: "40px",
            fontWeight: 700,
            letterSpacing: "-1px",
            textAlign: "center",
            maxWidth: "900px",
            background: "linear-gradient(135deg, #ffffff 0%, #c4b5fd 100%)",
            backgroundClip: "text",
            color: "transparent",
            display: "flex",
          }}
        >
          The free platform for conlang creators
        </div>

        <div
          style={{
            fontSize: "24px",
            color: "rgba(148, 163, 184, 0.85)",
            marginTop: "20px",
            textAlign: "center",
            maxWidth: "820px",
            display: "flex",
          }}
        >
          Build lexicons · Write grammar docs · Design custom scripts · Share constructed languages
        </div>
      </div>
    ),
    { ...size }
  )
}
