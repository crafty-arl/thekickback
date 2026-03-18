import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Link,
  Hr,
} from "@react-email/components";
import * as React from "react";

interface LayoutProps {
  preview: string;
  children: React.ReactNode;
  venueSlug?: string;
}

export function EmailLayout({ preview, children, venueSlug }: LayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {children}

          {/* Footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>powered by theKickBack</Text>
            <Text style={footerLinks}>
              {venueSlug && (
                <>
                  <Link href={`https://join.thekickback.net/${venueSlug}`} style={footerLink}>
                    View venue
                  </Link>
                  {" · "}
                </>
              )}
              <Link href="https://thekickback.net" style={footerLink}>
                thekickback.net
              </Link>
              {" · "}
              <Link href="#" style={footerLink}>
                Unsubscribe
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#000000",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  backgroundColor: "#000000",
};

const hr: React.CSSProperties = {
  borderColor: "rgba(255,255,255,0.08)",
  margin: "32px 0 16px",
};

const footer: React.CSSProperties = {
  padding: "0 24px 32px",
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  color: "rgba(255,255,255,0.2)",
  fontSize: "11px",
  margin: "0 0 8px",
};

const footerLinks: React.CSSProperties = {
  color: "rgba(255,255,255,0.2)",
  fontSize: "11px",
  margin: 0,
};

const footerLink: React.CSSProperties = {
  color: "rgba(255,255,255,0.3)",
  textDecoration: "underline",
};
