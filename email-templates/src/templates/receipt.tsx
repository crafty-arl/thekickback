import {
  Section,
  Text,
  Row,
  Column,
  Hr,
  Button,
} from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "../components/layout";

interface ReceiptEmailProps {
  venueName: string;
  venueSlug: string;
  themeColor: string;
  type: "membership" | "reservation" | "order";
  title: string;
  items: { label: string; value: string }[];
  total?: string;
  date: string;
  confirmationId: string;
  walletPassUrl: string;
}

export default function ReceiptEmail({
  venueName = "The Rooftop",
  venueSlug = "the-rooftop",
  themeColor = "#F97316",
  type = "membership",
  title = "Membership Confirmed",
  items = [
    { label: "Plan", value: "Member" },
    { label: "Price", value: "$25/month" },
    { label: "Perks", value: "Priority booths, skip the wait, members-only events" },
  ],
  total = "$25.00",
  date = "March 18, 2026",
  confirmationId = "KB-2026-0318-001",
  walletPassUrl = "https://thekickback.net/wallet/pass/demo/guest",
}: ReceiptEmailProps) {
  const icon = type === "membership" ? "★" : type === "reservation" ? "◎" : "✓";

  return (
    <EmailLayout preview={`${title} — ${venueName}`} venueSlug={venueSlug}>
      {/* Header */}
      <Section style={{ padding: "32px 24px 0" }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          backgroundColor: themeColor,
          marginBottom: "16px",
          fontSize: "20px",
          textAlign: "center" as const,
          lineHeight: "48px",
        }}>
          {icon}
        </div>

        <Text style={{ color: "#fff", fontSize: "24px", fontWeight: 700, margin: "0 0 4px" }}>
          {title}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: "14px", margin: "0 0 4px" }}>
          {venueName} · {date}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", fontFamily: "monospace", margin: 0 }}>
          {confirmationId}
        </Text>
      </Section>

      {/* Line Items */}
      <Section style={{ padding: "24px" }}>
        <div style={{
          backgroundColor: "#111",
          borderRadius: "16px",
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}>
          {items.map((item, i) => (
            <React.Fragment key={item.label}>
              {i > 0 && <Hr style={{ borderColor: "rgba(255,255,255,0.06)", margin: 0 }} />}
              <Row style={{ padding: "14px 16px" }}>
                <Column>
                  <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", margin: 0 }}>
                    {item.label}
                  </Text>
                </Column>
                <Column style={{ textAlign: "right" as const }}>
                  <Text style={{ color: "#fff", fontSize: "13px", fontWeight: 600, margin: 0 }}>
                    {item.value}
                  </Text>
                </Column>
              </Row>
            </React.Fragment>
          ))}

          {total && (
            <>
              <Hr style={{ borderColor: "rgba(255,255,255,0.1)", margin: 0 }} />
              <Row style={{ padding: "14px 16px" }}>
                <Column>
                  <Text style={{ color: "#fff", fontSize: "14px", fontWeight: 700, margin: 0 }}>
                    Total
                  </Text>
                </Column>
                <Column style={{ textAlign: "right" as const }}>
                  <Text style={{ color: themeColor, fontSize: "14px", fontWeight: 700, margin: 0 }}>
                    {total}
                  </Text>
                </Column>
              </Row>
            </>
          )}
        </div>
      </Section>

      {/* Wallet Pass */}
      <Section style={{ padding: "0 24px 8px" }}>
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
          📲 Update Wallet Pass
        </Button>
      </Section>

      {/* Help text */}
      <Section style={{ padding: "0 24px" }}>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", textAlign: "center" as const, lineHeight: "1.5" }}>
          Reply to this email with CANCEL to cancel anytime.
          Questions? Reply ASK followed by your question.
        </Text>
      </Section>
    </EmailLayout>
  );
}
