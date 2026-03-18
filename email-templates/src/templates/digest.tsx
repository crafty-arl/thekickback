import {
  Section,
  Text,
  Button,
  Row,
  Column,
  Hr,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/layout";

interface VenueDigest {
  name: string;
  slug: string;
  vibe: string;
  occupancy: number;
  maxOccupancy: number;
  themeColor: string;
  highlight: string;
  event?: string;
}

interface DigestEmailProps {
  venues: VenueDigest[];
  totalVisits: number;
}

export default function DigestEmail({
  venues = [
    { name: "The Rooftop", slug: "the-rooftop", vibe: "quiet", occupancy: 14, maxOccupancy: 50, themeColor: "#F97316", highlight: "New menu items: Spiced Cider, Fall Bowl", event: "DJ set Friday 9 PM" },
    { name: "Daily Grind", slug: "daily-grind", vibe: "busy", occupancy: 25, maxOccupancy: 40, themeColor: "#F97316", highlight: "Member special: Free pastry with coffee", event: "Extended hours this week" },
    { name: "The Loft", slug: "the-loft", vibe: "quiet", occupancy: 8, maxOccupancy: 30, themeColor: "#F97316", highlight: "New: Private room bookings available", event: "Wine tasting Saturday" },
  ],
  totalVisits = 12,
}: DigestEmailProps) {
  const vibeColor = (v: string) => v === "quiet" ? "#4ADE80" : v === "moderate" ? "#FACC15" : v === "busy" ? "#F97316" : "#EF4444";

  return (
    <EmailLayout preview={`What's happening at your ${venues.length} venues this week`}>
      {/* Header */}
      <Section style={{ padding: "32px 24px 0" }}>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", fontWeight: 600, letterSpacing: "2px", margin: "0 0 8px" }}>
          YOUR WEEKLY DIGEST
        </Text>
        <Text style={{ color: "#fff", fontSize: "24px", fontWeight: 700, margin: "0 0 4px", lineHeight: "1.2" }}>
          What&apos;s happening at your spots
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: "0 0 8px" }}>
          {venues.length} venues · {totalVisits} visits this month
        </Text>
      </Section>

      {/* Venue Cards */}
      {venues.map((v, i) => (
        <React.Fragment key={v.slug}>
          {i > 0 && <Hr style={{ borderColor: "rgba(255,255,255,0.06)", margin: "0 24px" }} />}
          <Section style={{ padding: "20px 24px" }}>
            {/* Venue header */}
            <Row style={{ marginBottom: "12px" }}>
              <Column>
                <Text style={{ color: "#fff", fontSize: "18px", fontWeight: 700, margin: 0 }}>
                  {v.name}
                </Text>
              </Column>
              <Column style={{ textAlign: "right" as const }}>
                <div style={{
                  display: "inline-block",
                  backgroundColor: "rgba(255,255,255,0.06)",
                  borderRadius: "999px",
                  padding: "2px 10px",
                }}>
                  <Text style={{ color: vibeColor(v.vibe), fontSize: "12px", fontWeight: 600, margin: 0 }}>
                    ● {v.vibe.charAt(0).toUpperCase() + v.vibe.slice(1)}
                  </Text>
                </div>
              </Column>
            </Row>

            {/* Event */}
            {v.event && (
              <div style={{
                backgroundColor: "rgba(255,255,255,0.04)",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "10px",
                borderLeft: `3px solid ${v.themeColor}`,
              }}>
                <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", margin: 0 }}>
                  {v.event}
                </Text>
              </div>
            )}

            {/* Highlight */}
            <Text style={{ color: "rgba(255,255,255,0.45)", fontSize: "13px", margin: "0 0 12px", lineHeight: "1.5" }}>
              {v.highlight}
            </Text>

            {/* CTA */}
            <Button
              href={`https://join.thekickback.net/${v.slug}`}
              style={{
                display: "inline-block",
                backgroundColor: "#111",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                padding: "10px 20px",
                color: "rgba(255,255,255,0.6)",
                fontSize: "13px",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              Open {v.name} →
            </Button>
          </Section>
        </React.Fragment>
      ))}
    </EmailLayout>
  );
}
