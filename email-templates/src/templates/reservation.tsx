import {
  Section,
  Text,
  Row,
  Column,
  Button,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/layout";

interface ReservationEmailProps {
  venueName: string;
  venueSlug: string;
  themeColor: string;
  boothName: string;
  date: string;
  time: string;
  partySize: number;
  confirmationId: string;
  walletPassUrl: string;
}

export default function ReservationEmail({
  venueName = "The Rooftop",
  venueSlug = "the-rooftop",
  themeColor = "#F97316",
  boothName = "Booth 4 — Window",
  date = "Friday, March 20",
  time = "8:00 PM",
  partySize = 4,
  confirmationId = "KB-RES-0320-001",
  walletPassUrl = "https://thekickback.net/wallet/pass/demo/guest",
}: ReservationEmailProps) {
  return (
    <EmailLayout preview={`Reservation confirmed — ${venueName} ${date} at ${time}`} venueSlug={venueSlug}>
      {/* Header */}
      <Section style={{ padding: "32px 24px 0" }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          backgroundColor: themeColor,
          marginBottom: "16px",
          fontSize: "20px",
          textAlign: "center" as const,
          lineHeight: "48px",
        }}>
          ◎
        </div>

        <Text style={{ color: "#fff", fontSize: "24px", fontWeight: 700, margin: "0 0 4px" }}>
          You&apos;re booked.
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: 0 }}>
          {venueName} · {confirmationId}
        </Text>
      </Section>

      {/* Reservation Card */}
      <Section style={{ padding: "24px" }}>
        <div style={{
          backgroundColor: "#111",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "20px",
        }}>
          <Row style={{ marginBottom: "16px" }}>
            <Column>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px", margin: "0 0 4px" }}>
                WHERE
              </Text>
              <Text style={{ color: "#fff", fontSize: "16px", fontWeight: 700, margin: 0 }}>
                {boothName}
              </Text>
            </Column>
          </Row>

          <Row>
            <Column style={{ width: "33%" }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px", margin: "0 0 4px" }}>
                DATE
              </Text>
              <Text style={{ color: "#fff", fontSize: "14px", fontWeight: 600, margin: 0 }}>
                {date}
              </Text>
            </Column>
            <Column style={{ width: "33%" }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px", margin: "0 0 4px" }}>
                TIME
              </Text>
              <Text style={{ color: "#fff", fontSize: "14px", fontWeight: 600, margin: 0 }}>
                {time}
              </Text>
            </Column>
            <Column style={{ width: "33%" }}>
              <Text style={{ color: "rgba(255,255,255,0.35)", fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px", margin: "0 0 4px" }}>
                PARTY
              </Text>
              <Text style={{ color: "#fff", fontSize: "14px", fontWeight: 600, margin: 0 }}>
                {partySize} people
              </Text>
            </Column>
          </Row>
        </div>
      </Section>

      {/* Add to Wallet */}
      <Section style={{ padding: "0 24px" }}>
        <Button href={walletPassUrl} style={{
          display: "block",
          width: "100%",
          backgroundColor: themeColor,
          borderRadius: "12px",
          padding: "14px 0",
          color: "#000",
          fontSize: "14px",
          fontWeight: 700,
          textDecoration: "none",
          textAlign: "center" as const,
        }}>
          📲 Add to Wallet
        </Button>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", textAlign: "center" as const, margin: "8px 0 0" }}>
          Your pass will update when the reservation is ready
        </Text>
      </Section>

      {/* Modify / Cancel */}
      <Section style={{ padding: "20px 24px 0" }}>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", textAlign: "center" as const, lineHeight: "1.5" }}>
          Reply CANCEL to cancel · Reply MODIFY to change details
        </Text>
      </Section>
    </EmailLayout>
  );
}
