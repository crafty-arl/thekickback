import {
  Section,
  Text,
  Button,
  Row,
  Column,
  Hr,
  Img,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/layout";

interface WelcomeEmailProps {
  venueName: string;
  venueSlug: string;
  tagline: string;
  themeColor: string;
  vibe: string;
  occupancy: number;
  maxOccupancy: number;
  rules: string[];
  walletPassUrl: string;
  heroImageUrl?: string;
}

export default function WelcomeEmail({
  venueName = "The Rooftop",
  venueSlug = "the-rooftop",
  tagline = "A rooftop for people who pay attention",
  themeColor = "#F97316",
  vibe = "quiet",
  occupancy = 14,
  maxOccupancy = 50,
  rules = ["Quiet after 6 PM", "Members get priority booths", "Free Wi-Fi for all guests"],
  walletPassUrl = "https://thekickback.net/wallet/pass/demo/guest",
  heroImageUrl,
}: WelcomeEmailProps) {
  const vibeLabel = vibe.charAt(0).toUpperCase() + vibe.slice(1);
  const vibeColor = vibe === "quiet" ? "#4ADE80" : vibe === "moderate" ? "#FACC15" : vibe === "busy" ? "#F97316" : "#EF4444";
  const spotsOpen = Math.max(0, maxOccupancy - occupancy);

  return (
    <EmailLayout preview={`Welcome to ${venueName} — you're in`} venueSlug={venueSlug}>
      {/* Hero */}
      <Section style={{
        background: heroImageUrl
          ? `url(${heroImageUrl}) center/cover no-repeat`
          : `linear-gradient(to bottom, transparent 0%, ${themeColor} 100%)`,
        height: "200px",
        borderRadius: "0 0 16px 16px",
        position: "relative" as const,
      }}>
        <div style={{
          background: "linear-gradient(to top, #000000 0%, rgba(0,0,0,0.6) 50%, transparent 100%)",
          position: "absolute" as const,
          inset: 0,
          borderRadius: "0 0 16px 16px",
        }} />
      </Section>

      {/* LIVE Badge + Venue Name */}
      <Section style={{ padding: "0 24px" }}>
        <div style={{
          display: "inline-block",
          backgroundColor: themeColor,
          borderRadius: "999px",
          padding: "3px 10px",
          marginBottom: "8px",
        }}>
          <Text style={{ color: "#000", fontSize: "10px", fontWeight: 700, letterSpacing: "1.5px", margin: 0 }}>
            ● LIVE
          </Text>
        </div>

        <Text style={{
          color: "#fff",
          fontSize: "28px",
          fontWeight: 700,
          margin: "0 0 4px",
          lineHeight: "1.1",
        }}>
          {venueName}
        </Text>

        <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", margin: "0 0 4px" }}>
          {tagline}
        </Text>
      </Section>

      {/* Live Stats */}
      <Section style={{ padding: "16px 24px" }}>
        <Row>
          <Column style={statCard}>
            <Text style={statLabel}>VIBE</Text>
            <Text style={{ ...statValue, color: vibeColor }}>{vibeLabel}</Text>
          </Column>
          <Column style={{ width: "12px" }} />
          <Column style={statCard}>
            <Text style={statLabel}>PEOPLE</Text>
            <Text style={statValue}>{occupancy} / {maxOccupancy}</Text>
          </Column>
          <Column style={{ width: "12px" }} />
          <Column style={statCard}>
            <Text style={statLabel}>OPEN</Text>
            <Text style={statValue}>{spotsOpen} spots</Text>
          </Column>
        </Row>
      </Section>

      {/* Welcome Message */}
      <Section style={{ padding: "0 24px" }}>
        <Text style={{
          color: "#fff",
          fontSize: "18px",
          fontWeight: 600,
          margin: "0 0 8px",
        }}>
          You&apos;re in.
        </Text>
        <Text style={{
          color: "rgba(255,255,255,0.5)",
          fontSize: "14px",
          lineHeight: "1.6",
          margin: "0 0 20px",
        }}>
          Reply to this email anytime to interact with {venueName}. Just type a command and we&apos;ll handle the rest.
        </Text>
      </Section>

      {/* Action Buttons */}
      <Section style={{ padding: "0 24px" }}>
        <Row>
          <Column style={{ width: "50%", paddingRight: "6px" }}>
            <Button href={`mailto:join@thekickback.net?subject=MENU&body=MENU`} style={primaryBtn(themeColor)}>
              Menu
            </Button>
          </Column>
          <Column style={{ width: "50%", paddingLeft: "6px" }}>
            <Button href={`mailto:join@thekickback.net?subject=REQUEST&body=REQUEST a booth`} style={secondaryBtn}>
              Reserve
            </Button>
          </Column>
        </Row>
        <Row style={{ marginTop: "12px" }}>
          <Column style={{ width: "50%", paddingRight: "6px" }}>
            <Button href={`mailto:join@thekickback.net?subject=ASK&body=ASK `} style={secondaryBtn}>
              Ask Anything
            </Button>
          </Column>
          <Column style={{ width: "50%", paddingLeft: "6px" }}>
            <Button href={`mailto:join@thekickback.net?subject=STATUS&body=STATUS`} style={secondaryBtn}>
              Status
            </Button>
          </Column>
        </Row>
      </Section>

      {/* Wallet Pass */}
      <Section style={{ padding: "20px 24px" }}>
        <Button href={walletPassUrl} style={{
          display: "block",
          width: "100%",
          backgroundColor: "#111",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          padding: "14px 16px",
          color: "#fff",
          fontSize: "14px",
          fontWeight: 600,
          textDecoration: "none",
          textAlign: "center" as const,
        }}>
          📲 Add to Apple / Google Wallet
        </Button>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", textAlign: "center" as const, margin: "8px 0 0" }}>
          Live updates on your lock screen
        </Text>
      </Section>

      {/* Commands Reference */}
      <Section style={{ padding: "0 24px" }}>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 600, letterSpacing: "1.5px", margin: "0 0 8px" }}>
          REPLY WITH ANY COMMAND
        </Text>
        <Row>
          {["MENU", "ASK", "REQUEST", "STATUS", "LEAVE", "MEMBERSHIP"].map((cmd) => (
            <Column key={cmd} style={{ paddingRight: "6px", paddingBottom: "6px" }}>
              <div style={{
                display: "inline-block",
                backgroundColor: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "8px",
                padding: "4px 10px",
              }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", fontFamily: "monospace", margin: 0 }}>
                  {cmd}
                </Text>
              </div>
            </Column>
          ))}
        </Row>
      </Section>

      {/* House Rules */}
      {rules.length > 0 && (
        <Section style={{ padding: "20px 24px" }}>
          <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 600, letterSpacing: "1.5px", margin: "0 0 12px" }}>
            HOUSE RULES
          </Text>
          {rules.map((rule) => (
            <Row key={rule} style={{ marginBottom: "6px" }}>
              <Column style={{ width: "16px", verticalAlign: "top" }}>
                <Text style={{ color: themeColor, fontSize: "14px", margin: 0, lineHeight: "1.4" }}>•</Text>
              </Column>
              <Column>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", margin: 0, lineHeight: "1.4" }}>
                  {rule}
                </Text>
              </Column>
            </Row>
          ))}
        </Section>
      )}
    </EmailLayout>
  );
}

// Styles

const statCard: React.CSSProperties = {
  backgroundColor: "#1A1A1A",
  borderRadius: "12px",
  padding: "12px",
};

const statLabel: React.CSSProperties = {
  color: "rgba(255,255,255,0.35)",
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "1.5px",
  margin: "0 0 4px",
};

const statValue: React.CSSProperties = {
  color: "#fff",
  fontSize: "18px",
  fontWeight: 700,
  margin: 0,
};

function primaryBtn(color: string): React.CSSProperties {
  return {
    display: "block",
    width: "100%",
    backgroundColor: color,
    borderRadius: "12px",
    padding: "14px 0",
    color: "#000",
    fontSize: "14px",
    fontWeight: 700,
    textDecoration: "none",
    textAlign: "center" as const,
  };
}

const secondaryBtn: React.CSSProperties = {
  display: "block",
  width: "100%",
  backgroundColor: "#111",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "12px",
  padding: "14px 0",
  color: "rgba(255,255,255,0.5)",
  fontSize: "14px",
  fontWeight: 500,
  textDecoration: "none",
  textAlign: "center" as const,
};
